const protectedSlugs = new Set(["嵩山普寂大照禅师生平略考"]);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = cors(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      await requireAdminPassword(request, env);

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (request.method === "GET" && path === "/posts") {
        return json(await listPosts(env), corsHeaders);
      }

      const postMatch = path.match(/^\/posts\/(.+)$/);
      if (request.method === "GET" && postMatch) {
        return json(await getPost(env, decodeURIComponent(postMatch[1])), corsHeaders);
      }
      if ((request.method === "POST" && path === "/posts") || (request.method === "PUT" && postMatch)) {
        const payload = await request.json();
        const slug = postMatch ? decodeURIComponent(postMatch[1]) : slugify(payload.title || "");
        return json(await savePost(env, slug, payload), corsHeaders);
      }
      if (request.method === "DELETE" && postMatch) {
        return json(await deletePost(env, decodeURIComponent(postMatch[1])), corsHeaders);
      }
      if (request.method === "POST" && path === "/uploads") {
        return json(await uploadImage(env, await request.json()), corsHeaders);
      }

      return json({ error: "接口不存在。" }, corsHeaders, 404);
    } catch (error) {
      const status = Number(error.status || 500);
      console.error(JSON.stringify({ status, message: error.message }));
      return json({ error: error.message || "服务器错误。" }, corsHeaders, status);
    }
  }
};

function cors(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const allowOrigin = allowedOrigin === "*" || origin === allowedOrigin ? (origin || allowedOrigin) : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

async function requireAdminPassword(request, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) throw httpError("Worker 缺少 ADMIN_PASSWORD 环境变量。", 500);

  const actual = request.headers.get("X-Admin-Password") || "";
  if (!(await timingSafeEqual(actual, expected))) {
    throw httpError("后台密码不正确。", 401);
  }
}

async function timingSafeEqual(actual, expected) {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  if (actualBytes.length !== expectedBytes.length) return false;

  const actualDigest = await crypto.subtle.digest("SHA-256", actualBytes);
  const expectedDigest = await crypto.subtle.digest("SHA-256", expectedBytes);
  const a = new Uint8Array(actualDigest);
  const b = new Uint8Array(expectedDigest);
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }
  return diff === 0;
}

function httpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function repo(env) {
  return `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
}

function branch(env) {
  return env.GITHUB_BRANCH || "main";
}

function actionsUrl(env) {
  return `https://github.com/${repo(env)}/actions`;
}

function encodeContentPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest(env, path, options = {}) {
  if (!env.GITHUB_TOKEN) throw httpError("Worker 缺少 GITHUB_TOKEN 环境变量。", 500);

  const response = await fetch(`https://api.github.com/repos/${repo(env)}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "silencegate-blog-admin",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw httpError(result.message || "GitHub 请求失败。", response.status);
  }
  return result;
}

function parseListField(value) {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function parseMarkdown(source, fileName, sha) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw httpError(`${fileName} 缺少 frontmatter。`, 500);

  const data = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    data[key] = value.replace(/^["']|["']$/g, "");
  }

  return {
    title: data.title || fileName.replace(/\.md$/, ""),
    date: data.date || "",
    description: data.description || "",
    readingTime: data.readingTime || "",
    tags: parseListField(data.tags),
    status: data.status || "published",
    publishedAt: data.publishedAt || "",
    slug: fileName.replace(/\.md$/, ""),
    sha,
    body: match[2].trim()
  };
}

function postSortTime(post) {
  const published = Date.parse(post.publishedAt || "");
  if (Number.isFinite(published)) return published;

  const date = Date.parse(`${post.date || "1970-01-01"}T00:00:00`);
  return Number.isFinite(date) ? date : 0;
}

async function listPosts(env) {
  const files = await githubRequest(env, `/contents/content/posts?ref=${encodeURIComponent(branch(env))}`);
  const posts = files
    .filter((file) => file.type === "file" && file.name.endsWith(".md"))
    .map((file) => ({
      slug: file.name.replace(/\.md$/, ""),
      title: file.name.replace(/\.md$/, ""),
      sha: file.sha,
      date: ""
    }));

  const loadedPosts = [];
  for (const post of posts) {
    loadedPosts.push(await getPost(env, post.slug));
  }
  loadedPosts.sort((a, b) => postSortTime(b) - postSortTime(a) || a.title.localeCompare(b.title, "zh-Hans"));
  return { posts: loadedPosts };
}

async function getPost(env, slug) {
  const filePath = `content/posts/${slug}.md`;
  const detail = await githubRequest(env, `/contents/${encodeContentPath(filePath)}?ref=${encodeURIComponent(branch(env))}`);
  return parseMarkdown(decodeBase64(detail.content), `${slug}.md`, detail.sha);
}

function slugify(value) {
  return (
    String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

function serializePost(payload, previous = {}) {
  const tags = String(payload.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const publishedAt = previous.publishedAt || new Date().toISOString();

  return `---
title: ${String(payload.title || "").trim()}
date: ${payload.date}
description: ${String(payload.description || "").trim()}
readingTime: ${String(payload.readingTime || "").trim()}
tags: [${tags.join(", ")}]
status: ${payload.status || "published"}
publishedAt: ${publishedAt}
---

${String(payload.body || "").trim()}
`;
}

async function savePost(env, slug, payload) {
  if (!payload.title || !payload.date || !payload.body) {
    throw httpError("标题、日期、正文不能为空。", 400);
  }

  let previous = null;
  try {
    previous = await getPost(env, slug);
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const content = serializePost(payload, previous || {});
  const filePath = `content/posts/${slug}.md`;
  const result = await githubRequest(env, `/contents/${encodeContentPath(filePath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: previous ? `Update post: ${payload.title}` : `Add post: ${payload.title}`,
      content: encodeBase64(content),
      branch: branch(env),
      ...(previous?.sha ? { sha: previous.sha } : {})
    })
  });

  return {
    slug,
    file: `${slug}.md`,
    commitUrl: result.commit?.html_url || "",
    actionsUrl: actionsUrl(env)
  };
}

async function deletePost(env, slug) {
  if (protectedSlugs.has(slug)) throw httpError("这篇文章已保护，不能删除。", 403);
  const post = await getPost(env, slug);
  const result = await githubRequest(env, `/contents/${encodeContentPath(`content/posts/${slug}.md`)}`, {
    method: "DELETE",
    body: JSON.stringify({
      message: `Delete post: ${slug}`,
      sha: post.sha,
      branch: branch(env)
    })
  });
  return {
    ok: true,
    commitUrl: result.commit?.html_url || "",
    actionsUrl: actionsUrl(env)
  };
}

function safeUploadName(name) {
  const extension = String(name || "").includes(".") ? String(name).split(".").pop().toLowerCase() : "png";
  return `image-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}.${extension}`;
}

async function uploadImage(env, payload) {
  if (!payload.data || !String(payload.data).includes(",")) {
    throw httpError("图片数据无效。", 400);
  }

  const file = safeUploadName(payload.name);
  const content = String(payload.data).split(",")[1];
  const filePath = `uploads/${file}`;
  const result = await githubRequest(env, `/contents/${encodeContentPath(filePath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Upload image: ${file}`,
      content,
      branch: branch(env)
    })
  });

  return {
    file,
    markdown: `![${payload.name || file}](../uploads/${file})`,
    commitUrl: result.commit?.html_url || "",
    actionsUrl: actionsUrl(env)
  };
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(String(value).replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
