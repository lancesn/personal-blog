const workerUrlInput = document.querySelector("#worker-url");
const passwordInput = document.querySelector("#admin-password");
const rememberPasswordInput = document.querySelector("#remember-password");
const connectButton = document.querySelector("#connect");
const forgetPasswordButton = document.querySelector("#forget-password");
const form = document.querySelector("#post-form");
const postList = document.querySelector("#post-list");
const postPagination = document.querySelector("#post-pagination");
const postSearchInput = document.querySelector("#post-search");
const postTagSelect = document.querySelector("#post-tag");
const tagSummary = document.querySelector("[data-tag-summary]");
const tagOptions = document.querySelector("[data-tag-options]");
const newTagInput = document.querySelector("#new-tag");
const addTagButton = document.querySelector("#add-tag");
const newPostButton = document.querySelector("#new-post");
const deletePostButton = document.querySelector("#delete-post");
const insertImageButton = document.querySelector("#insert-image");
const imageFileInput = document.querySelector("#image-file");
const importButton = document.querySelector("#import-post");
const importFileInput = document.querySelector("#import-file");
const markdownToolbar = document.querySelector(".studio-toolbar");
const editorModeButtons = document.querySelectorAll("[data-editor-mode]");
const studioCompose = document.querySelector(".studio-compose");
const markdownPreview = document.querySelector("#markdown-preview");
const statusText = document.querySelector("#status");
const feedbackPanel = document.querySelector("#publish-feedback");
const feedbackMessage = document.querySelector("#feedback-message");
const feedbackLinks = document.querySelector("#feedback-links");
const protectedSlugs = new Set(["嵩山普寂大照禅师生平略考"]);
const siteUrl = "https://silencegate.com";
const actionsUrl = "https://github.com/lancesn/personal-blog/actions";
const postPageSize = 10;
let posts = [];
let postPage = 1;
let postTotal = 0;
let postTotalPages = 1;
let postQuery = "";
let postTag = "";
let postTags = [];
const fallbackTags = ["技术", "散文", "禅宗", "随笔"];

function selectedTags() {
  return form.elements.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function updateTagSummary() {
  const tags = selectedTags();
  tagSummary.textContent = tags.length ? tags.join(", ") : "选择标签";
}

function setSelectedTags(tags) {
  const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  form.elements.tags.value = uniqueTags.join(", ");
  tagOptions.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = uniqueTags.includes(checkbox.value);
  });
  updateTagSummary();
}

function availableEditorTags() {
  return [...new Set([...fallbackTags, ...postTags, ...selectedTags()])].sort((a, b) => a.localeCompare(b, "zh-Hans"));
}

function rememberEditorTags(tags) {
  postTags = [...new Set([...postTags, ...tags.map((tag) => tag.trim()).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "zh-Hans"));
  renderTagPicker();
}

function renderTagPicker() {
  const checkedTags = new Set(selectedTags());
  tagOptions.innerHTML = availableEditorTags()
    .map((tag) => `<label><input type="checkbox" value="${escapeHtml(tag)}"${checkedTags.has(tag) ? " checked" : ""} /> <span>${escapeHtml(tag)}</span></label>`)
    .join("");
  updateTagSummary();
}

function addCustomTag() {
  const tag = newTagInput.value.trim();
  if (!tag) return;
  rememberEditorTags([tag]);
  setSelectedTags([...selectedTags(), tag]);
  newTagInput.value = "";
}

function setStatus(message, tone = "neutral") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function showFeedback(message, links = []) {
  feedbackPanel.hidden = false;
  feedbackMessage.textContent = message;
  feedbackLinks.innerHTML = links
    .filter((link) => link.href)
    .map((link) => `<a class="button" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`)
    .join("");
  feedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function postUrl(slug) {
  return `${siteUrl}/posts/${encodeURIComponent(slug)}.html`;
}

function currentWorkerUrl() {
  return workerUrlInput.value.trim().replace(/\/+$/, "");
}

function currentPassword() {
  return passwordInput.value || localStorage.getItem("adminPassword") || sessionStorage.getItem("adminPassword") || "";
}

async function apiRequest(path, options = {}) {
  const workerUrl = currentWorkerUrl();
  const password = currentPassword();
  if (!workerUrl) throw new Error("请先填写 Worker 地址。");
  if (!password) throw new Error("请先输入后台密码。");

  const response = await fetch(`${workerUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": password,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.error || "请求失败。");
  }
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:|mailto:|\/|#|\.\.?\/)/i.test(url)) return url;
  return "#";
}

function renderInlineMarkdown(value) {
  let text = String(value || "");
  const replacements = [];
  const store = (html) => {
    const token = `@@MD${replacements.length}@@`;
    replacements.push([token, html]);
    return token;
  };

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, alt, src, title) => {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return store(`<img src="${escapeHtml(safeUrl(src))}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" />`);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, label, href, title) => {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return store(`<a href="${escapeHtml(safeUrl(href))}"${titleAttr} target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });
  text = text.replace(/`([^`]+)`/g, (_, code) => store(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => store(`<strong>${escapeHtml(content)}</strong>`));

  let html = escapeHtml(text);
  replacements.forEach(([token, replacement]) => {
    html = html.replaceAll(token, replacement);
  });
  return html;
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
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isBlockStart(line, nextLine = "") {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    (line.includes("|") && isTableDivider(nextLine))
  );
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || "";

    if (!line.trim()) continue;

    const fence = line.match(/^```(\w+)?/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const language = fence[1] ? ` data-language="${escapeHtml(fence[1])}"` : "";
      html.push(`<pre${language}><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (line.includes("|") && isTableDivider(nextLine)) {
      const headers = splitTableRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || "")}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      index -= 1;
      html.push(`<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      index -= 1;
      html.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      index -= 1;
      html.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph = [line];
    while (index + 1 < lines.length && lines[index + 1].trim() && !isBlockStart(lines[index + 1], lines[index + 2] || "")) {
      paragraph.push(lines[index + 1]);
      index += 1;
    }
    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
  }

  return html.join("");
}

function updatePreview() {
  const body = form.elements.body.value.trim();
  markdownPreview.innerHTML = body ? renderMarkdown(body) : '<p class="studio-empty">开始输入 Markdown 后，这里会实时显示预览。</p>';
}

function setEditorMode(mode) {
  studioCompose.dataset.mode = mode;
  editorModeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.editorMode === mode));
  });
  if (mode !== "edit") updatePreview();
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function resetForm() {
  form.reset();
  form.elements.slug.value = "";
  form.elements.sha.value = "";
  form.elements.date.value = localDateValue();
  setSelectedTags([]);
  form.elements.status.value = "published";
  deletePostButton.hidden = true;
  feedbackPanel.hidden = true;
  updatePreview();
  document.querySelectorAll(".studio-post-item").forEach((item) => item.removeAttribute("aria-current"));
}

function renderTagFilter() {
  const currentTag = postTagSelect.value;
  postTagSelect.innerHTML = `<option value="">全部标签</option>${postTags
    .map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`)
    .join("")}`;
  postTagSelect.value = postTags.includes(currentTag) ? currentTag : "";
  renderTagPicker();
}

function renderPagination() {
  if (postTotalPages <= 1) {
    postPagination.innerHTML = "";
    return;
  }

  const buttons = [];
  buttons.push(`<button type="button" data-page="${Math.max(1, postPage - 1)}"${postPage <= 1 ? " disabled" : ""}>上一页</button>`);

  for (let page = 1; page <= postTotalPages; page += 1) {
    if (page !== 1 && page !== postTotalPages && Math.abs(page - postPage) > 2) {
      if (buttons.at(-1) !== "<span>...</span>") buttons.push("<span>...</span>");
      continue;
    }
    buttons.push(`<button type="button" data-page="${page}"${page === postPage ? ' aria-current="page"' : ""}>${page}</button>`);
  }

  buttons.push(`<button type="button" data-page="${Math.min(postTotalPages, postPage + 1)}"${postPage >= postTotalPages ? " disabled" : ""}>下一页</button>`);
  postPagination.innerHTML = `<span>共 ${postTotal} 篇</span><div>${buttons.join("")}</div>`;
}

function renderPosts() {
  if (!posts.length) {
    postList.innerHTML = '<p class="studio-empty">还没有文章。</p>';
    renderPagination();
    return;
  }

  postList.innerHTML = posts
    .map(
      (post) => `<button class="studio-post-item" type="button" data-slug="${escapeHtml(post.slug)}">
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(post.date)}${post.status === "draft" ? " · 草稿" : ""}${post.tags?.length ? ` · ${escapeHtml(post.tags.join(", "))}` : ""}</span>
        <small>${escapeHtml(post.description || "")}</small>
      </button>`
    )
    .join("");
  renderPagination();
}

function postListQueryString(page = postPage) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(postPageSize)
  });
  if (postQuery) params.set("q", postQuery);
  if (postTag) params.set("tag", postTag);
  return params.toString();
}

async function loadPosts(page = postPage) {
  setStatus("正在读取文章...");
  localStorage.setItem("workerUrl", currentWorkerUrl());
  if (rememberPasswordInput.checked) {
    localStorage.setItem("adminPassword", currentPassword());
    localStorage.setItem("rememberPassword", "true");
    sessionStorage.removeItem("adminPassword");
  } else {
    sessionStorage.setItem("adminPassword", currentPassword());
    localStorage.removeItem("adminPassword");
    localStorage.removeItem("rememberPassword");
  }
  const result = await apiRequest(`/posts?${postListQueryString(page)}`);
  posts = result.posts || [];
  postPage = result.page || page;
  postTotal = result.total || posts.length;
  postTotalPages = result.totalPages || 1;
  postTags = result.tags || postTags;
  renderTagFilter();
  renderPosts();
  setStatus(`已读取第 ${postPage}/${postTotalPages} 页，共 ${postTotal} 篇文章。`, "success");
}

async function loadPost(slug) {
  setStatus("正在加载文章...");
  const post = await apiRequest(`/posts/${encodeURIComponent(slug)}`);

  form.elements.slug.value = post.slug;
  form.elements.sha.value = post.sha;
  form.elements.title.value = post.title;
  form.elements.date.value = post.date;
  form.elements.description.value = post.description || "";
  form.elements.readingTime.value = post.readingTime || "";
  setSelectedTags(post.tags || []);
  form.elements.status.value = post.status || "published";
  form.elements.body.value = post.body || "";
  deletePostButton.hidden = protectedSlugs.has(post.slug);
  updatePreview();

  document.querySelectorAll(".studio-post-item").forEach((item) => {
    item.toggleAttribute("aria-current", item.dataset.slug === slug);
  });
  setStatus(`正在编辑：${post.slug}.md`);
}

async function savePost(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form).entries());
  const slug = payload.slug;
  delete payload.slug;
  delete payload.sha;

  try {
    setStatus("正在发布...");
    const result = await apiRequest(slug ? `/posts/${encodeURIComponent(slug)}` : "/posts", {
      method: slug ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    setStatus("已提交到 GitHub，GitHub Pages 正在自动构建。", "success");
    await loadPosts(1);
    resetForm();
    showFeedback("发布成功：文章已提交到 GitHub。编辑器已清空，可以继续写下一篇。GitHub Pages 通常需要 1-3 分钟完成构建和刷新。", [
      { label: "查看文章", href: postUrl(result.slug) },
      { label: "查看构建", href: result.actionsUrl || actionsUrl },
      { label: "查看提交", href: result.commitUrl }
    ]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function deletePost() {
  const slug = form.elements.slug.value;
  if (!slug) return;
  if (protectedSlugs.has(slug)) {
    setStatus("这篇文章已保护，不能删除。", "error");
    return;
  }
  if (!window.confirm(`确定删除 ${slug}.md 吗？`)) return;

  try {
    setStatus("正在删除...");
    await apiRequest(`/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });
    resetForm();
    await loadPosts(1);
    setStatus("已删除，GitHub Pages 正在自动构建。", "success");
    showFeedback("删除请求已提交。线上页面刷新可能需要等待 GitHub Pages 构建完成。", [
      { label: "查看构建", href: actionsUrl }
    ]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
  const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
  const insertion = `${prefix}${text}${suffix}`;
  textarea.value = `${before}${insertion}${after}`;
  textarea.focus();
  textarea.selectionStart = start + insertion.length;
  textarea.selectionEnd = start + insertion.length;
  updatePreview();
}

function replaceSelection(textarea, text, selectionStart = text.length, selectionEnd = text.length) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  textarea.focus();
  textarea.selectionStart = start + selectionStart;
  textarea.selectionEnd = start + selectionEnd;
  updatePreview();
}

function wrapSelection(textarea, prefix, suffix, placeholder) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  replaceSelection(textarea, `${prefix}${selected}${suffix}`, prefix.length, prefix.length + selected.length);
}

function prefixSelectedLines(textarea, prefix, placeholder) {
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  const content = selected || placeholder;
  replaceSelection(textarea, content.split("\n").map((line) => `${prefix}${line}`).join("\n"));
}

function runToolbarCommand(command) {
  const textarea = form.elements.body;
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);

  if (command === "heading") {
    prefixSelectedLines(textarea, "## ", selected || "小标题");
    return;
  }
  if (command === "bold") {
    wrapSelection(textarea, "**", "**", "加粗文字");
    return;
  }
  if (command === "quote") {
    prefixSelectedLines(textarea, "> ", selected || "引用文字");
    return;
  }
  if (command === "link") {
    const label = selected || "链接文字";
    replaceSelection(textarea, `[${label}](https://example.com)`, 1, 1 + label.length);
    return;
  }
  if (command === "table") {
    insertAtCursor(textarea, "| 项目 | 说明 |\n| --- | --- |\n| 示例 | 内容 |");
    return;
  }
  if (command === "code") {
    const content = selected || "console.log('hello');";
    replaceSelection(textarea, `\`\`\`js\n${content}\n\`\`\``, 6, 6 + content.length);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function uploadImage() {
  const file = imageFileInput.files[0];
  if (!file) return;

  try {
    setStatus("正在上传图片...");
    const dataUrl = await readFileAsDataUrl(file);
    const result = await apiRequest("/uploads", {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        data: dataUrl
      })
    });
    insertAtCursor(form.elements.body, result.markdown);
    setStatus(`已插入图片：${result.file}`, "success");
    showFeedback("图片已上传到仓库，并已插入正文。保存文章后才会在正文里正式发布。", [
      { label: "查看构建", href: result.actionsUrl || actionsUrl },
      { label: "查看提交", href: result.commitUrl }
    ]);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    imageFileInput.value = "";
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsArrayBuffer(file);
  });
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error(`加载失败：${src}`)));
    document.head.appendChild(script);
  });
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function removeTitleHeading(markdown, title) {
  if (!title) return markdown;
  return markdown.replace(/^#\s+.+\n+/, "");
}

async function uploadEmbeddedImage(dataUrl, index) {
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const extension = mime.split("/")[1] || "png";
  const result = await apiRequest("/uploads", {
    method: "POST",
    body: JSON.stringify({
      name: `word-import-${index}.${extension}`,
      type: mime,
      data: dataUrl
    })
  });
  const uploadedMatch = result.markdown.match(/!\[[^\]]*]\(([^)]+)\)/);
  return uploadedMatch ? uploadedMatch[1] : dataUrl;
}

async function convertWordToMarkdown(file) {
  await loadScriptOnce("./vendor/mammoth.browser.min.js");
  await loadScriptOnce("./vendor/turndown.js");

  const buffer = await readFileAsArrayBuffer(file);
  const { value: html } = await window.mammoth.convertToHtml(
    { arrayBuffer: buffer },
    { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => p:fresh"] }
  );

  const turndownService = new window.TurndownService({ headingStyle: "atx" });
  let markdown = turndownService.turndown(html);

  const imageMatches = [...markdown.matchAll(/!\[([^\]]*)]\((data:[^)]+)\)/g)];
  for (let index = 0; index < imageMatches.length; index += 1) {
    const [fullMatch, alt, dataUrl] = imageMatches[index];
    setStatus(`正在上传文档里的图片（${index + 1}/${imageMatches.length}）...`);
    try {
      const uploadedSrc = await uploadEmbeddedImage(dataUrl, index + 1);
      markdown = markdown.replace(fullMatch, `![${alt}](${uploadedSrc})`);
    } catch (error) {
      console.warn("图片上传失败，已保留原始图片数据。", error);
    }
  }

  return markdown;
}

async function importFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  try {
    setStatus(extension === "docx" ? "正在解析 Word 文档..." : "正在读取文件...");
    let markdown = extension === "docx" ? await convertWordToMarkdown(file) : stripFrontmatter(await readFileAsText(file));

    const title = extractTitle(markdown);
    markdown = removeTitleHeading(markdown, title);

    resetForm();
    if (title) form.elements.title.value = title;
    form.elements.body.value = markdown.trim();
    updatePreview();
    setStatus(`已导入《${file.name}》，检查无误后发布。`, "success");
  } catch (error) {
    setStatus(`导入失败：${error.message}`, "error");
  } finally {
    importFileInput.value = "";
  }
}

connectButton.addEventListener("click", () => {
  loadPosts(1).catch((error) => setStatus(error.message, "error"));
});

forgetPasswordButton.addEventListener("click", () => {
  passwordInput.value = "";
  rememberPasswordInput.checked = false;
  localStorage.removeItem("adminPassword");
  localStorage.removeItem("rememberPassword");
  sessionStorage.removeItem("adminPassword");
  setStatus("已清除保存的后台密码。", "success");
});

newPostButton.addEventListener("click", resetForm);
postList.addEventListener("click", (event) => {
  const item = event.target.closest(".studio-post-item");
  if (item) loadPost(item.dataset.slug).catch((error) => setStatus(error.message, "error"));
});
postPagination.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;
  loadPosts(Number(button.dataset.page)).catch((error) => setStatus(error.message, "error"));
});
postSearchInput.addEventListener("input", () => {
  window.clearTimeout(postSearchInput.searchTimer);
  postSearchInput.searchTimer = window.setTimeout(() => {
    postQuery = postSearchInput.value.trim();
    loadPosts(1).catch((error) => setStatus(error.message, "error"));
  }, 250);
});
postTagSelect.addEventListener("change", () => {
  postTag = postTagSelect.value;
  loadPosts(1).catch((error) => setStatus(error.message, "error"));
});
tagOptions.addEventListener("change", () => {
  const tags = [...tagOptions.querySelectorAll("input[type='checkbox']:checked")].map((checkbox) => checkbox.value);
  setSelectedTags(tags);
});
addTagButton.addEventListener("click", addCustomTag);
newTagInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addCustomTag();
});
form.addEventListener("submit", savePost);
deletePostButton.addEventListener("click", deletePost);
form.elements.body.addEventListener("input", updatePreview);
markdownToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-md-command]");
  if (!button) return;
  runToolbarCommand(button.dataset.mdCommand);
});
editorModeButtons.forEach((button) => {
  button.addEventListener("click", () => setEditorMode(button.dataset.editorMode));
});
insertImageButton.addEventListener("click", () => imageFileInput.click());
imageFileInput.addEventListener("change", uploadImage);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if (file) importFile(file);
});

workerUrlInput.value = localStorage.getItem("workerUrl") || workerUrlInput.value;
rememberPasswordInput.checked = localStorage.getItem("rememberPassword") === "true";
passwordInput.value = localStorage.getItem("adminPassword") || sessionStorage.getItem("adminPassword") || "";
renderTagPicker();
resetForm();
setEditorMode("edit");
