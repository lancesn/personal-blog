import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";
const postsDir = path.join(root, "content", "posts");
const uploadsDir = path.join(root, "uploads");
const viewsPath = path.join(root, "data", "views.json");
const imageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"]
]);

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type });
  response.end(body);
}

function json(response, status, body) {
  send(response, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function slugify(title) {
  const ascii = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii || `post-${new Date().toISOString().slice(0, 10)}`;
}

function escapeFrontmatter(value) {
  return String(value).replaceAll('"', '\\"').replaceAll("\r\n", "\n").trim();
}

function excerptFromMarkdown(markdown, maxLength = 90) {
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_>#|-]/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function parseListField(value) {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function formatListField(items) {
  return `[${items.map((item) => `"${escapeFrontmatter(item)}"`).join(", ")}]`;
}

function parseMarkdown(source, fileName) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${fileName} 缺少 frontmatter`);
  }

  const data = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    data[key] = value.replace(/^["']|["']$/g, "").replaceAll('\\"', '"');
  }

  return {
    slug: fileName.replace(/\.md$/, ""),
    title: data.title || "",
    date: data.date || "",
    description: data.description || "",
    readingTime: data.readingTime || "",
    publishedAt: data.publishedAt || "",
    tags: parseListField(data.tags),
    status: data.status || "published",
    body: match[2].trim()
  };
}

function renderMarkdown(data) {
  const title = escapeFrontmatter(data.title || "");
  const date = escapeFrontmatter(data.date || "");
  const readingTime = escapeFrontmatter(data.readingTime || "3 分钟阅读");
  const publishedAt = escapeFrontmatter(data.publishedAt || new Date().toISOString());
  const body = String(data.body || "").replaceAll("\r\n", "\n").trim();
  const description = escapeFrontmatter(data.description || excerptFromMarkdown(body));
  const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : parseListField(data.tags || "");
  const status = data.status === "draft" ? "draft" : "published";

  if (!title || !date || !body) {
    throw new Error("标题、日期和正文都要填写。");
  }

  return {
    slug: slugify(title),
    markdown: `---\ntitle: "${title}"\ndate: ${date}\ndescription: "${description}"\nreadingTime: "${readingTime}"\npublishedAt: "${publishedAt}"\ntags: ${formatListField(tags)}\nstatus: ${status}\n---\n\n${body}\n`
  };
}

function postSortTime(post) {
  const published = Date.parse(post.publishedAt || "");
  if (Number.isFinite(published)) return published;

  const date = Date.parse(`${post.date || "1970-01-01"}T00:00:00`);
  if (Number.isFinite(date)) return date;

  return Number(post.modifiedTime || 0);
}

function postPath(slug) {
  const safeSlug = slugify(slug);
  if (safeSlug !== slug) {
    throw new Error("文章地址不合法。");
  }
  return path.join(postsDir, `${safeSlug}.md`);
}

async function readViews() {
  try {
    return JSON.parse(await readFile(viewsPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeViews(views) {
  await mkdir(path.dirname(viewsPath), { recursive: true });
  await writeFile(viewsPath, `${JSON.stringify(views, null, 2)}\n`);
}

async function incrementView(slug, response) {
  try {
    const safeSlug = slugify(slug);
    if (safeSlug !== slug) {
      json(response, 400, { error: "文章地址不合法。" });
      return;
    }

    const views = await readViews();
    views[safeSlug] = Number(views[safeSlug] || 0) + 1;
    await writeViews(views);
    json(response, 200, { slug: safeSlug, views: views[safeSlug] });
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}

async function listViews(response) {
  try {
    json(response, 200, await readViews());
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}

function readRequest(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) {
        reject(new Error("内容太长"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function runBuild() {
  return new Promise((resolve, reject) => {
    execFile("npm", ["run", "build"], { cwd: root }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve();
    });
  });
}

async function createPost(request, response) {
  try {
    const data = JSON.parse(await readRequest(request));
    const { slug, markdown } = renderMarkdown(data);
    const file = `${slug}.md`;
    const targetPath = path.join(postsDir, file);

    await mkdir(postsDir, { recursive: true });
    await writeFile(targetPath, markdown, { flag: "wx" });
    await runBuild();

    json(response, 201, { file: `content/posts/${file}`, slug });
  } catch (error) {
    if (error.code === "EEXIST") {
      json(response, 409, { error: "这篇文章的文件名已经存在，请换一个标题。" });
      return;
    }
    json(response, 500, { error: error.message });
  }
}

async function listPosts(response, url) {
  try {
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
    const views = await readViews();
    const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md"));
    const posts = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(postsDir, file);
        const fileStat = await stat(filePath);
        return { ...parseMarkdown(await readFile(filePath, "utf8"), file), modifiedTime: fileStat.mtimeMs };
      })
    );
    posts.sort((a, b) => {
      const byTime = postSortTime(b) - postSortTime(a);
      if (byTime) return byTime;

      return a.title.localeCompare(b.title, "zh-Hans");
    });
    json(
      response,
      200,
      {
        page,
        pageSize,
        total: posts.length,
        totalPages: Math.max(1, Math.ceil(posts.length / pageSize)),
        posts: posts.slice((page - 1) * pageSize, page * pageSize).map(({ body, modifiedTime, ...post }) => ({
        ...post,
        views: Number(views[post.slug] || 0)
      }))
      }
    );
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}

async function getPost(slug, response) {
  try {
    const filePath = postPath(slug);
    const post = parseMarkdown(await readFile(filePath, "utf8"), `${slug}.md`);
    json(response, 200, post);
  } catch (error) {
    json(response, error.code === "ENOENT" ? 404 : 500, { error: error.message });
  }
}

async function updatePost(slug, request, response) {
  try {
    const currentPath = postPath(slug);
    const currentPost = parseMarkdown(await readFile(currentPath, "utf8"), `${slug}.md`);
    const data = JSON.parse(await readRequest(request));
    const rendered = renderMarkdown({ ...data, title: data.title || slug, publishedAt: data.publishedAt || currentPost.publishedAt });
    const nextSlug = rendered.slug;
    const nextPath = path.join(postsDir, `${nextSlug}.md`);

    if (nextSlug !== slug) {
      try {
        await writeFile(nextPath, rendered.markdown, { flag: "wx" });
      } catch (error) {
        if (error.code === "EEXIST") {
          json(response, 409, { error: "修改后的标题会覆盖另一篇文章，请换一个标题。" });
          return;
        }
        throw error;
      }
      await rm(currentPath);
      const views = await readViews();
      if (views[slug] && !views[nextSlug]) {
        views[nextSlug] = views[slug];
        delete views[slug];
        await writeViews(views);
      }
    } else {
      await writeFile(currentPath, rendered.markdown);
    }

    await runBuild();
    json(response, 200, { file: `content/posts/${nextSlug}.md`, slug: nextSlug });
  } catch (error) {
    json(response, error.code === "ENOENT" ? 404 : 500, { error: error.message });
  }
}

async function deletePost(slug, response) {
  try {
    await rm(postPath(slug));
    const views = await readViews();
    if (views[slug]) {
      delete views[slug];
      await writeViews(views);
    }
    await runBuild();
    json(response, 200, { deleted: slug });
  } catch (error) {
    json(response, error.code === "ENOENT" ? 404 : 500, { error: error.message });
  }
}

function safeImageName(name, type) {
  const extension = imageTypes.get(type);
  if (!extension) {
    throw new Error("只支持 jpg、png、gif、webp、svg 图片。");
  }

  const baseName = path
    .basename(name || "image", path.extname(name || "image"))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

  return `${baseName || "image"}-${stamp}${extension}`;
}

async function uploadImage(request, response) {
  try {
    const data = JSON.parse(await readRequest(request));
    const type = String(data.type || "");
    const base64 = String(data.data || "").replace(/^data:[^;]+;base64,/, "");
    const fileName = safeImageName(data.name, type);
    const buffer = Buffer.from(base64, "base64");

    if (!buffer.length) {
      json(response, 400, { error: "图片内容为空。" });
      return;
    }
    if (buffer.length > 6_000_000) {
      json(response, 413, { error: "图片不能超过 6MB。" });
      return;
    }

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, fileName), buffer, { flag: "wx" });
    await runBuild();

    json(response, 201, {
      file: `uploads/${fileName}`,
      markdown: `![${path.basename(fileName, path.extname(fileName))}](../uploads/${fileName})`
    });
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd: root }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function publishSite(response) {
  try {
    await runBuild();
    await runGit(["add", "."]);
    const status = await runGit(["status", "--porcelain"]);
    if (!status) {
      json(response, 200, { message: "没有需要发布的改动。" });
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    await runGit(["commit", "-m", `Update blog ${timestamp}`]);
    await runGit(["push", "origin", "main"]);
    json(response, 200, { message: "已提交并推送到 GitHub。" });
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/admin/" : url.pathname);
  const filePath = pathname.endsWith("/")
    ? path.join(root, pathname, "index.html")
    : path.join(root, pathname);

  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml"
    };
    send(response, 200, file, types[ext] || "application/octet-stream");
  } catch {
    send(response, 404, "Not found");
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  const postSlug = url.pathname.startsWith("/api/posts/")
    ? decodeURIComponent(url.pathname.slice("/api/posts/".length))
    : "";
  const viewSlug = url.pathname.startsWith("/api/views/")
    ? decodeURIComponent(url.pathname.slice("/api/views/".length))
    : "";

  if (request.method === "GET" && url.pathname === "/api/posts") {
    listPosts(response, url);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/posts") {
    createPost(request, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/uploads") {
    uploadImage(request, response);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/views") {
    listViews(response);
    return;
  }
  if (viewSlug && request.method === "POST") {
    incrementView(viewSlug, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/publish") {
    publishSite(response);
    return;
  }
  if (postSlug && request.method === "GET") {
    getPost(postSlug, response);
    return;
  }
  if (postSlug && request.method === "PUT") {
    updatePost(postSlug, request, response);
    return;
  }
  if (postSlug && request.method === "DELETE") {
    deletePost(postSlug, response);
    return;
  }
  serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Studio ready: http://${host}:${port}/admin/`);
});
