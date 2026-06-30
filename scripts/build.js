import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content", "posts");
const distDir = path.join(root, "dist");
const uploadsDir = path.join(root, "uploads");
const siteUrl = "https://lancesn.github.io/personal-blog";
const assetVersion = "20260630-search-tags";
const blogPageSize = 30;
const defaultOgImage = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";
const postOgImages = [
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
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

function shareExcerpt(post, maxLength = 120) {
  const description = (post.description || "").trim();
  if (description && description !== post.title && description.length >= 12) {
    return description;
  }

  const text = (post.plainText || plainTextFromMarkdown(post.body))
    .replace(post.title, "")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function plainTextFromMarkdown(markdown) {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/[*_>#|-]/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseListField(value) {
  if (!value) return [];
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function parseMarkdownFile(source, fileName) {
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
    data[key] = value.replace(/^["']|["']$/g, "");
  }

  for (const key of ["title", "date"]) {
    if (!data[key]) throw new Error(`${fileName} 缺少 ${key}`);
  }

  return {
    ...data,
    description: data.description || excerptFromMarkdown(match[2]),
    publishedAt: data.publishedAt || "",
    tags: parseListField(data.tags),
    status: data.status || "published",
    slug: fileName.replace(/\.md$/, ""),
    body: match[2].trim(),
    plainText: plainTextFromMarkdown(match[2])
  };
}

function sortPosts(posts) {
  posts.sort((a, b) => {
    const byTime = postSortTime(b) - postSortTime(a);
    if (byTime) return byTime;

    return a.title.localeCompare(b.title, "zh-Hans");
  });
}

function postSortTime(post) {
  const published = Date.parse(post.publishedAt || "");
  if (Number.isFinite(published)) return published;

  const modified = Number(post.modifiedTime || 0);
  if (modified) return modified;

  const date = Date.parse(`${post.date || "1970-01-01"}T00:00:00`);
  return Number.isFinite(date) ? date : 0;
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tag";
}

function absoluteUrl(relativePath = "") {
  return `${siteUrl}/${relativePath.replace(/^\.\//, "").replace(/^\//, "")}`;
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function stableIndex(value, length) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function postShareImage(post) {
  const imageMatch = post.body.match(/!\[[^\]]*]\(([^)]+)\)/);
  if (imageMatch) {
    const src = imageMatch[1].trim();
    if (/^https?:\/\//.test(src)) return src;
    return absoluteUrl(src.replace(/^\.\.\//, "").replace(/^\.\//, ""));
  }

  return postOgImages[stableIndex(post.slug, postOgImages.length)];
}

function scriptTag(prefix = ".") {
  return `    <script src="${prefix}/script.js?v=${assetVersion}"></script>`;
}

function stylesheetTag(prefix = ".") {
  return `    <link rel="stylesheet" href="${prefix}/styles.css?v=${assetVersion}" />`;
}

function escapeXml(value) {
  return escapeHtml(String(value)).replaceAll("'", "&apos;");
}

function renderTagLinks(tags, prefix = ".") {
  if (!tags.length) return "";
  return `<div class="tag-list">${tags
    .map((tag) => `<a href="${prefix}/tags/${slugify(tag)}.html">${escapeHtml(tag)}</a>`)
    .join("")}</div>`;
}

function renderPostCard(post) {
  return `<article class="post-card" data-search-card data-title="${escapeHtml(post.title)}" data-tags="${escapeHtml(post.tags.join(" "))}" data-body="${escapeHtml(post.plainText)}">
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <h3><a class="post-title-link" href="./posts/${post.slug}.html">${escapeHtml(post.title)}</a></h3>
            <a class="post-excerpt-link" href="./posts/${post.slug}.html">${escapeHtml(post.description)}</a>
            ${renderTagLinks(post.tags)}
            <a href="./posts/${post.slug}.html">读全文</a>
          </article>`;
}

function imageBlockToHtml(line) {
  const match = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!match) return "";
  const [, alt, src] = match;
  return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" /></figure>`;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  return splitTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableBlock(lines) {
  return lines.length >= 2 && lines[0].includes("|") && isTableDivider(lines[1]);
}

function markdownTableToHtml(lines) {
  const headers = splitTableRow(lines[0]);
  const rows = lines.slice(2).filter((line) => line.trim()).map(splitTableRow);

  return `<div class="table-wrap"><table>
  <thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>
  <tbody>
${rows.map((row) => `    <tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("\n")}
  </tbody>
</table></div>`;
}

function headingId(text) {
  return slugify(text.replace(/[*_`]/g, ""));
}

function markdownToHtml(markdown) {
  const blocks = markdown.split(/\n{2,}/);
  const html = [];
  const toc = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] || "";

    if (isTableBlock(lines)) {
      html.push(markdownTableToHtml(lines));
      continue;
    }

    if (lines.length === 1 && imageBlockToHtml(firstLine)) {
      html.push(imageBlockToHtml(firstLine));
      continue;
    }

    if (firstLine.startsWith("## ")) {
      const text = firstLine.slice(3).trim();
      const id = headingId(text);
      toc.push({ level: 2, id, text });
      html.push(`<h2 id="${id}">${inlineMarkdown(text)}</h2>`);
      continue;
    }

    if (firstLine.startsWith("### ")) {
      const text = firstLine.slice(4).trim();
      const id = headingId(text);
      toc.push({ level: 3, id, text });
      html.push(`<h3 id="${id}">${inlineMarkdown(text)}</h3>`);
      continue;
    }

    if (lines.length === 1 && /^[一二三四五六七八九十]+、/.test(firstLine.trim())) {
      const text = firstLine.trim();
      const id = headingId(text);
      toc.push({ level: 2, id, text });
      html.push(`<h2 id="${id}">${inlineMarkdown(text)}</h2>`);
      continue;
    }

    if (lines.every((line) => line.startsWith("- "))) {
      html.push(
        `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.slice(2).trim())}</li>`).join("")}</ul>`
      );
      continue;
    }

    html.push(`<p>${inlineMarkdown(lines.join(" ").trim())}</p>`);
  }

  return { html: html.join("\n"), toc };
}

function pageShell({ title, description, body, script = "", canonical = "", image = "", ogType = "website" }) {
  const pageUrl = canonical || absoluteUrl("");
  const ogImage = image || defaultOgImage;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <link rel="alternate" type="application/rss+xml" title="我的博客 RSS" href="${escapeHtml(absoluteUrl("rss.xml"))}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <title>${escapeHtml(title)}</title>
${stylesheetTag(".")}
  </head>
  <body>
${body}
${script}
  </body>
</html>
`;
}

function siteNav(current) {
  const items = [
    ["home", "./index.html", "首页"],
    ["blog", "./blog.html", "博客"],
    ["about", "./about.html", "关于"],
    ["archive", "./archive.html", "存档"],
    ["search", "./search.html", "搜索"]
  ];

  return `    <nav class="top-nav" aria-label="主导航">
${items
  .map(([key, href, label]) => `      <a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`)
  .join("\n")}
      <button class="theme-toggle" type="button" aria-label="切换深浅色">☼</button>
    </nav>`;
}

function siteFooter() {
  return `    <footer class="footer">© 2026 Lance Shen. All rights reserved. 未经许可，禁止转载或用于商业用途。</footer>`;
}

function profileAvatar() {
  return `<img class="profile-avatar" src="./uploads/lance-profile.jpg" alt="Lance Shen" />`;
}

function pageAvatar(src = "./uploads/lance-profile.jpg", alt = "Lance Shen") {
  return `<img class="profile-avatar page-avatar" src="${src}" alt="${alt}" />`;
}

function renderHome(posts) {
  const latestPosts = posts
    .slice(0, 10)
    .map(renderPostCard)
    .join("\n          ");

  return pageShell({
    title: "我的博客",
    description: "Lance 的个人博客。记录 AI 工具、独立开发、产品思考和折腾笔记。",
    canonical: absoluteUrl("index.html"),
    script: scriptTag("."),
    body: `${siteNav("home")}

    <main class="site-shell">
      <section class="hero section home-hero" data-hero-carousel>
        <div class="hero-media" aria-hidden="true">
          <img class="is-active" src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1600&q=80" alt="" />
          <img src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1600&q=80" alt="" />
        </div>
        <div class="hero-content">
          ${profileAvatar()}
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <h2>最新文章</h2>
          <p>最近更新的想法和折腾记录。</p>
        </div>
        <div class="post-list">
          ${latestPosts}
        </div>
        <div class="more-posts">
          <a class="button primary more-posts-link" href="./blog.html">更多文章</a>
        </div>
      </section>
    </main>

${siteFooter()}`
  });
}

function blogPagePath(pageNumber, prefix = ".") {
  return pageNumber === 1 ? `${prefix}/blog.html` : `${prefix}/blog/page/${pageNumber}.html`;
}

function renderBlogPagination(currentPage, totalPages) {
  if (totalPages <= 1) return "";

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map((pageNumber) => {
      const href = pageNumber === 1 ? "./blog.html" : `./blog/page/${pageNumber}.html`;
      return `<a href="${href}"${pageNumber === currentPage ? ' aria-current="page"' : ""}>${pageNumber}</a>`;
    })
    .join("");

  const previous = currentPage > 1 ? `<a href="${blogPagePath(currentPage - 1)}">上一页</a>` : `<span>上一页</span>`;
  const next = currentPage < totalPages ? `<a href="${blogPagePath(currentPage + 1)}">下一页</a>` : `<span>下一页</span>`;

  return `<nav class="pagination" aria-label="博客分页">
          ${previous}
          <div>${pages}</div>
          ${next}
        </nav>`;
}

function renderBlog(posts, currentPage = 1) {
  const totalPages = Math.max(1, Math.ceil(posts.length / blogPageSize));
  const pagePosts = posts.slice((currentPage - 1) * blogPageSize, currentPage * blogPageSize);
  const postCards = pagePosts
    .map(renderPostCard)
    .join("\n          ");
  const pageTitle = currentPage === 1 ? "博客" : `博客 - 第 ${currentPage} 页`;
  const prefix = currentPage === 1 ? "." : "../..";
  const pageScript = scriptTag(prefix);
  const nav = currentPage === 1 ? siteNav("blog") : siteNav("blog").replaceAll("./", "../../");
  const avatar = currentPage === 1
    ? pageAvatar("./uploads/blog-avatar.png", "打开的书与怀表")
    : pageAvatar("../../uploads/blog-avatar.png", "打开的书与怀表");
  const cards = currentPage === 1
    ? postCards
    : postCards
        .replaceAll('href="./posts/', 'href="../../posts/')
        .replaceAll('href="./tags/', 'href="../../tags/');
  const pagination = currentPage === 1
    ? renderBlogPagination(currentPage, totalPages)
    : renderBlogPagination(currentPage, totalPages)
        .replaceAll('href="./blog.html"', 'href="../../blog.html"')
        .replaceAll('href="./blog/page/', 'href="./');

  return pageShell({
    title: pageTitle,
    description: "Lance 的博客文章列表。",
    canonical: absoluteUrl(currentPage === 1 ? "blog.html" : `blog/page/${currentPage}.html`),
    script: pageScript,
    body: `${nav}

    <main class="site-shell">
      <section class="hero section">
        ${avatar}
        <h1>博客</h1>
        <p>一些想法、文章和折腾记录。</p>
      </section>

      <section class="section">
        <div class="post-list">
          ${cards}
        </div>
        ${pagination}
      </section>
    </main>

${siteFooter()}`
  }).replace(
    `href="./styles.css?v=${assetVersion}"`,
    currentPage === 1 ? `href="./styles.css?v=${assetVersion}"` : `href="../../styles.css?v=${assetVersion}"`
  );
}

function renderSearch(posts) {
  const tags = collectTags(posts);
  const tagItems = tags
    .map(([tag, tagPosts]) => `<a class="tag-index-item search-tag-item" data-search-card data-title="${escapeHtml(tag)}" data-tags="${escapeHtml(tag)}" data-body="${escapeHtml(tagPosts.map((post) => post.title).join(" "))}" href="./tags/${slugify(tag)}.html">${escapeHtml(tag)}<span>${tagPosts.length}</span></a>`)
    .join("\n          ");

  return pageShell({
    title: "搜索",
    description: "搜索 Lance 的博客文章。",
    canonical: absoluteUrl("search.html"),
    script: scriptTag("."),
    body: `${siteNav("search")}

    <main class="site-shell">
      <section class="hero section">
        ${pageAvatar("./uploads/search-avatar.png", "彩色眼睛图案")}
        <h1>搜索</h1>
        <p>按标题、正文和标签查找文章。</p>
      </section>

      <section class="section">
        <label class="search-box">
          <span>搜索标签</span>
          <input type="search" data-search-input data-search-label="标签" placeholder="输入标签关键词..." />
        </label>
        <p class="search-status" data-search-status></p>
        <div class="tag-index search-tag-grid" data-search-results>
          ${tagItems || '<p class="muted">还没有标签。</p>'}
        </div>
      </section>
    </main>

${siteFooter()}`
  });
}

function collectTags(posts) {
  const tags = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(post);
    }
  }
  return [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hans"));
}

function renderTagsIndex(posts) {
  const tags = collectTags(posts);
  const tagItems = tags
    .map(([tag, tagPosts]) => `<a class="tag-index-item" href="./tags/${slugify(tag)}.html">${escapeHtml(tag)}<span>${tagPosts.length}</span></a>`)
    .join("\n          ");

  return pageShell({
    title: "标签",
    description: "Lance 的博客标签。",
    canonical: absoluteUrl("tags.html"),
    script: scriptTag("."),
    body: `${siteNav("blog")}

    <main class="site-shell">
      <section class="hero section">
        <h1>标签</h1>
        <p>按主题浏览文章。</p>
      </section>

      <section class="section tag-index">
        ${tagItems || '<p class="muted">还没有标签。</p>'}
      </section>
    </main>

${siteFooter()}`
  });
}

function renderTagPage(tag, posts) {
  return pageShell({
    title: tag,
    description: `标签 ${tag} 下的文章。`,
    canonical: absoluteUrl(`tags/${slugify(tag)}.html`),
    script: scriptTag(".."),
    body: `${siteNav("blog").replaceAll("./", "../")}

    <main class="site-shell">
      <section class="hero section">
        <h1>${escapeHtml(tag)}</h1>
        <p>${posts.length} 篇文章</p>
      </section>

      <section class="section">
        <div class="post-list">
          ${posts.map(renderPostCard).join("\n          ").replaceAll('href="./posts/', 'href="../posts/').replaceAll('href="./tags/', 'href="../tags/')}
        </div>
      </section>
    </main>

${siteFooter()}`
  }).replace(`href="./styles.css?v=${assetVersion}"`, `href="../styles.css?v=${assetVersion}"`);
}

function renderAbout() {
  return pageShell({
    title: "关于",
    description: "关于 Lance 和这个个人博客。",
    canonical: absoluteUrl("about.html"),
    script: scriptTag("."),
    body: `${siteNav("about")}

    <main class="site-shell">
      <section class="hero section">
        ${pageAvatar()}
        <h1>关于我</h1>
      </section>

      <section class="split section">
        <div>
          <h2>关于我</h2>
          <p>
            月在空庭，不为谁明。人来人去，光自如如。
          </p>
        </div>
        <div>
          <h2>在做的事</h2>
          <ol class="timeline">
            <li><span>2026 - 至今</span><strong>写作 · 分享</strong></li>
            <li><span>2025 - 2026</span><strong>个人站</strong></li>
            <li><span>过往</span><strong>人生如过客</strong></li>
          </ol>
        </div>
      </section>

      <section class="section contact-section">
        <h2>联系我</h2>
        <div class="contact-grid">
          <a class="button primary contact-email" href="#" data-contact-email data-email-user="shenyvu" data-email-domain="gmail.com">Email</a>
          <a class="button primary contact-whatsapp" href="https://wa.me/14025761272" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
      </section>
    </main>

${siteFooter()}`
  });
}

function renderArchive(posts) {
  const monthNames = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" });
  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
  const months = new Map();

  for (const post of posts) {
    const month = post.date.slice(0, 7);
    if (!months.has(month)) months.set(month, new Map());
    const days = months.get(month);
    if (!days.has(post.date)) days.set(post.date, []);
    days.get(post.date).push(post);
  }

  const calendarGroups = [...months.entries()]
    .map(
      ([month, days]) => {
        const [year, monthNumber] = month.split("-").map(Number);
        const firstDay = new Date(year, monthNumber - 1, 1);
        const daysInMonth = new Date(year, monthNumber, 0).getDate();
        const leadingBlanks = (firstDay.getDay() + 6) % 7;
        const cells = [];

        for (let index = 0; index < leadingBlanks; index += 1) {
          cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
          const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayPosts = days.get(date) || [];
          cells.push(`<div class="calendar-day${dayPosts.length ? " has-post" : ""}">
            <time datetime="${date}">${day}</time>
            ${dayPosts
              .map((post) => `<a href="./posts/${post.slug}.html">${escapeHtml(post.title)}</a>`)
              .join("\n            ")}
          </div>`);
        }

        return `<section class="archive-month">
        <h2>${monthNames.format(firstDay)}</h2>
        <div class="calendar-weekdays" aria-hidden="true">
          ${weekDays.map((day) => `<span>${day}</span>`).join("")}
        </div>
        <div class="calendar-grid">
          ${cells.join("\n          ")}
        </div>
      </section>`;
      }
    )
    .join("\n\n      ");

  return pageShell({
    title: "存档",
    description: "Lance 的博客文章存档。",
    canonical: absoluteUrl("archive.html"),
    script: scriptTag("."),
    body: `${siteNav("archive")}

    <main class="site-shell">
      <section class="hero section">
        ${pageAvatar("./uploads/archive-avatar.png", "湖边木船")}
        <h1>存档</h1>
        <p>按时间整理的全部文章。</p>
      </section>

      <section class="section archive">
        ${calendarGroups || '<p class="muted">还没有文章。</p>'}
      </section>
    </main>

${siteFooter()}`
  });
}

function renderPost(post) {
  const { html: content, toc } = markdownToHtml(post.body);
  const postShareExcerpt = shareExcerpt(post);
  const tableOfContents =
    toc.length >= 2
      ? `<nav class="toc" aria-label="文章目录">
        <h2>目录</h2>
        ${toc
          .map((item) => `<a class="toc-level-${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>`)
          .join("\n        ")}
      </nav>`
      : "";

  return pageShell({
    title: post.title,
    description: post.description,
    canonical: absoluteUrl(`posts/${post.slug}.html`),
    script: scriptTag(".."),
    image: postShareImage(post),
    ogType: "article",
    body: `    <main class="article" data-post-slug="${escapeHtml(post.slug)}" data-post-title="${escapeHtml(post.title)}" data-post-description="${escapeHtml(postShareExcerpt)}" data-post-url="${escapeHtml(absoluteUrl(`posts/${post.slug}.html`))}">
      <nav class="article-nav"><a href="../blog.html">← 返回博客</a></nav>
      <aside class="share-bar" aria-label="分享文章">
        <button class="share-trigger" type="button" data-share-toggle aria-expanded="false">分享</button>
        <div class="share-menu" data-share-menu hidden>
          <div class="share-preview">
            <strong data-share-preview-title>${escapeHtml(post.title)}</strong>
            <span data-share-preview-description>${escapeHtml(postShareExcerpt)}</span>
            <small data-share-preview-url></small>
          </div>
          <a data-share-x href="#">X</a>
          <a data-share-mail href="#">Email</a>
          <a data-share-weibo href="#">Weibo</a>
          <button type="button" data-share-wechat>WeChat</button>
          <a data-share-whatsapp href="#">WhatsApp</a>
          <a data-share-facebook href="#">Facebook</a>
          <button type="button" data-share-copy>复制链接</button>
          <p data-share-hint></p>
        </div>
      </aside>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="article-meta">${post.date} · ${escapeHtml(post.readingTime || "1 分钟阅读")}</p>
      ${renderTagLinks(post.tags, "..")}
      ${tableOfContents}
      <article class="article-content">
${content}
      </article>
      <nav class="article-nav article-nav-bottom"><a href="../blog.html">← 返回博客</a></nav>
    </main>`
  }).replace(`href="./styles.css?v=${assetVersion}"`, `href="../styles.css?v=${assetVersion}"`);
}

function renderRss(posts) {
  const items = posts
    .slice(0, 20)
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(absoluteUrl(`posts/${post.slug}.html`))}</link>
      <guid>${escapeXml(absoluteUrl(`posts/${post.slug}.html`))}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>我的博客</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Lance 的个人博客</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>
`;
}

async function syncDistToRoot() {
  const topLevelFiles = ["index.html", "blog.html", "about.html", "archive.html", "search.html", "tags.html", "rss.xml", "styles.css", "script.js", ".nojekyll"];
  for (const file of topLevelFiles) {
    await copyFile(path.join(distDir, file), path.join(root, file));
  }

  await rm(path.join(root, "posts"), { recursive: true, force: true });
  await rm(path.join(root, "tags"), { recursive: true, force: true });
  await rm(path.join(root, "blog", "page"), { recursive: true, force: true });
  await cp(path.join(distDir, "posts"), path.join(root, "posts"), { recursive: true, force: true });
  await cp(path.join(distDir, "tags"), path.join(root, "tags"), { recursive: true, force: true });
  if (await exists(path.join(distDir, "blog", "page"))) {
    await cp(path.join(distDir, "blog"), path.join(root, "blog"), { recursive: true, force: true });
  }
}

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "posts"), { recursive: true });
  await mkdir(path.join(distDir, "tags"), { recursive: true });
  await mkdir(path.join(distDir, "blog", "page"), { recursive: true });

  const files = (await readdir(contentDir)).filter((file) => file.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const source = await readFile(path.join(contentDir, file), "utf8");
    const fileStat = await stat(path.join(contentDir, file));
    posts.push({ ...parseMarkdownFile(source, file), modifiedTime: fileStat.mtimeMs });
  }
  sortPosts(posts);
  const publishedPosts = posts.filter((post) => post.status !== "draft");

  await writeFile(path.join(distDir, "index.html"), renderHome(publishedPosts));
  await writeFile(path.join(distDir, "blog.html"), renderBlog(publishedPosts));
  for (let pageNumber = 2; pageNumber <= Math.ceil(publishedPosts.length / blogPageSize); pageNumber += 1) {
    await writeFile(path.join(distDir, "blog", "page", `${pageNumber}.html`), renderBlog(publishedPosts, pageNumber));
  }
  await writeFile(path.join(distDir, "about.html"), renderAbout());
  await writeFile(path.join(distDir, "archive.html"), renderArchive(publishedPosts));
  await writeFile(path.join(distDir, "search.html"), renderSearch(publishedPosts));
  await writeFile(path.join(distDir, "tags.html"), renderTagsIndex(publishedPosts));
  await writeFile(path.join(distDir, "rss.xml"), renderRss(publishedPosts));
  for (const [tag, tagPosts] of collectTags(publishedPosts)) {
    await writeFile(path.join(distDir, "tags", `${slugify(tag)}.html`), renderTagPage(tag, tagPosts));
  }
  for (const post of publishedPosts) {
    await writeFile(path.join(distDir, "posts", `${post.slug}.html`), renderPost(post));
  }

  await copyFile(path.join(root, "styles.css"), path.join(distDir, "styles.css"));
  await copyFile(path.join(root, "script.js"), path.join(distDir, "script.js"));
  await mkdir(uploadsDir, { recursive: true });
  await cp(uploadsDir, path.join(distDir, "uploads"), { recursive: true, force: true });
  await writeFile(path.join(distDir, ".nojekyll"), "");
  await syncDistToRoot();
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
