import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content", "posts");
const distDir = path.join(root, "dist");

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

  for (const key of ["title", "date", "description"]) {
    if (!data[key]) throw new Error(`${fileName} 缺少 ${key}`);
  }

  return {
    ...data,
    slug: fileName.replace(/\.md$/, ""),
    body: match[2].trim()
  };
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const blocks = markdown.split(/\n{2,}/);
  const html = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] || "";

    if (firstLine.startsWith("## ")) {
      html.push(`<h2>${inlineMarkdown(firstLine.slice(3).trim())}</h2>`);
      continue;
    }

    if (firstLine.startsWith("### ")) {
      html.push(`<h3>${inlineMarkdown(firstLine.slice(4).trim())}</h3>`);
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

  return html.join("\n");
}

function pageShell({ title, description, body, script = "" }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#ffffff" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
${body}
${script}
  </body>
</html>
`;
}

function renderHome(posts) {
  const postCards = posts
    .map(
      (post) => `<article class="post-card">
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.description)}</p>
            <a href="./posts/${post.slug}.html">读全文</a>
          </article>`
    )
    .join("\n          ");

  return pageShell({
    title: "Lance - 个人博客",
    description: "Lance 的个人博客。记录 AI 工具、独立开发、产品思考和折腾笔记。",
    script: '    <script src="./script.js"></script>',
    body: `    <nav class="top-nav" aria-label="主导航">
      <a href="#home" aria-current="page">首页</a>
      <a href="#playbook">Playbook</a>
      <a href="#skills">Skill</a>
      <a href="#blog">博客</a>
      <a href="#about">关于</a>
      <button class="theme-toggle" type="button" aria-label="切换深浅色">☼</button>
    </nav>

    <main id="home" class="site-shell">
      <section class="hero section">
        <div class="avatar" aria-hidden="true">L</div>
        <h1>嘿，我是 Lance</h1>
        <p>
          我在这里记录 AI 工具、独立开发、产品思考和日常折腾。做东西不讲虚的，能用、能跑、能节省时间就行。
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#playbook">看看 Playbook</a>
          <a class="button dark" href="https://github.com/lancesn">GitHub 主页</a>
        </div>
        <div class="social-row" aria-label="社交链接">
          <a href="https://github.com/lancesn">GitHub</a>
          <a href="#blog">Blog</a>
        </div>
      </section>

      <section id="about" class="split section">
        <div>
          <h2>关于我</h2>
          <p>
            这里可以放你的个人介绍、当前职业、正在研究的方向，以及你希望别人如何理解这个网站。
          </p>
        </div>
        <div>
          <h2>在做的事</h2>
          <ol class="timeline">
            <li><span>2026 - 至今</span><strong>AI 效率工具 · 分享</strong></li>
            <li><span>2025 - 至今</span><strong>独立项目 · 个人站</strong></li>
            <li><span>过往</span><strong>产品、写作、自动化</strong></li>
          </ol>
        </div>
      </section>

      <section class="section feature-strip">
        <div>
          <h2>精选</h2>
          <p>把值得回看的长文、项目和工具放在这里，适合新朋友快速了解你。</p>
        </div>
        <div class="feature-grid">
          <a class="feature-card" href="#blog">
            <span>亮点</span>
            <strong>Highlights</strong>
            <p>产品思考、AI 工作流和独立开发记录。</p>
          </a>
          <a class="feature-card" href="#playbook">
            <span>手册</span>
            <strong>Playbook</strong>
            <p>整理可复用的经验、清单和实践路径。</p>
          </a>
        </div>
      </section>

      <section id="blog" class="section">
        <div class="section-heading">
          <h2>最新文章</h2>
          <p>一些想法和折腾记录。</p>
        </div>
        <div class="post-list">
          ${postCards}
        </div>
      </section>

      <section id="playbook" class="section">
        <div class="section-heading">
          <h2>Playbook</h2>
          <p>把可复用的经验做成手册。</p>
        </div>
        <div class="resource-grid">
          <a class="resource-card" href="#">
            <p>从零搭建个人博客、写作结构、部署和长期维护。</p>
            <strong>个人站实战手册</strong>
            <span>GitHub Pages · 静态站</span>
          </a>
          <a class="resource-card" href="#">
            <p>把重复任务交给 AI 和自动化脚本，保留关键判断。</p>
            <strong>AI 效率工作流</strong>
            <span>AI · 自动化 · 写作</span>
          </a>
        </div>
      </section>

      <section id="skills" class="section">
        <div class="section-heading">
          <h2>Skill</h2>
          <p>给自己常用工作流沉淀能力包。</p>
        </div>
        <div class="resource-grid">
          <a class="resource-card" href="#">
            <p>把文章改得更自然，减少模板感和空话。</p>
            <strong>Human Tone</strong>
            <span>写作 · 润色</span>
          </a>
          <a class="resource-card" href="#">
            <p>把碎片想法整理成结构化文章草稿。</p>
            <strong>Idea to Article</strong>
            <span>内容 · 整理</span>
          </a>
        </div>
      </section>

      <section class="section faq">
        <h2>常见问题</h2>
        <details>
          <summary>这个站用来放什么？</summary>
          <p>放个人介绍、博客文章、项目入口、实战手册和长期更新的资料。</p>
        </details>
        <details>
          <summary>后续怎么更新文章？</summary>
          <p>以后只需要在 content/posts 里新增 Markdown 文件，提交后会自动生成网页。</p>
        </details>
        <details>
          <summary>怎么联系？</summary>
          <p>可以先放 GitHub、X、邮箱或微信二维码，按你的真实渠道替换。</p>
        </details>
      </section>
    </main>

    <footer class="footer">© 2026 Lance</footer>`
  });
}

function renderPost(post) {
  const content = markdownToHtml(post.body);
  return pageShell({
    title: `${post.title} - Lance`,
    description: post.description,
    body: `    <main class="article">
      <nav class="article-nav"><a href="../index.html#blog">← 返回博客</a></nav>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="article-meta">${post.date} · ${escapeHtml(post.readingTime || "1 分钟阅读")}</p>
      <article class="article-content">
${content}
      </article>
    </main>`
  }).replace('href="./styles.css"', 'href="../styles.css"');
}

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "posts"), { recursive: true });

  const files = (await readdir(contentDir)).filter((file) => file.endsWith(".md"));
  const posts = [];
  for (const file of files) {
    const source = await readFile(path.join(contentDir, file), "utf8");
    posts.push(parseMarkdownFile(source, file));
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));

  await writeFile(path.join(distDir, "index.html"), renderHome(posts));
  for (const post of posts) {
    await writeFile(path.join(distDir, "posts", `${post.slug}.html`), renderPost(post));
  }

  await copyFile(path.join(root, "styles.css"), path.join(distDir, "styles.css"));
  await copyFile(path.join(root, "script.js"), path.join(distDir, "script.js"));
  await writeFile(path.join(distDir, ".nojekyll"), "");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
