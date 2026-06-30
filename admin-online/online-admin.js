const workerUrlInput = document.querySelector("#worker-url");
const passwordInput = document.querySelector("#admin-password");
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
  return passwordInput.value || sessionStorage.getItem("adminPassword") || "";
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
  sessionStorage.setItem("workerUrl", currentWorkerUrl());
  sessionStorage.setItem("adminPassword", currentPassword());
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

connectButton.addEventListener("click", () => {
  loadPosts(1).catch((error) => setStatus(error.message, "error"));
});

forgetPasswordButton.addEventListener("click", () => {
  passwordInput.value = "";
  sessionStorage.removeItem("adminPassword");
  setStatus("已清除当前浏览器会话里的后台密码。", "success");
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
insertImageButton.addEventListener("click", () => imageFileInput.click());
imageFileInput.addEventListener("change", uploadImage);

workerUrlInput.value = sessionStorage.getItem("workerUrl") || workerUrlInput.value;
passwordInput.value = sessionStorage.getItem("adminPassword") || "";
renderTagPicker();
resetForm();
