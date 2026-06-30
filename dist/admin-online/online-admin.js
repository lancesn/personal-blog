const workerUrlInput = document.querySelector("#worker-url");
const passwordInput = document.querySelector("#admin-password");
const connectButton = document.querySelector("#connect");
const forgetPasswordButton = document.querySelector("#forget-password");
const form = document.querySelector("#post-form");
const postList = document.querySelector("#post-list");
const newPostButton = document.querySelector("#new-post");
const deletePostButton = document.querySelector("#delete-post");
const insertImageButton = document.querySelector("#insert-image");
const imageFileInput = document.querySelector("#image-file");
const statusText = document.querySelector("#status");
const protectedSlugs = new Set(["嵩山普寂大照禅师生平略考"]);
let posts = [];

function setStatus(message, tone = "neutral") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
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

function postSortTime(post) {
  const published = Date.parse(post.publishedAt || "");
  if (Number.isFinite(published)) return published;

  const date = Date.parse(`${post.date || "1970-01-01"}T00:00:00`);
  return Number.isFinite(date) ? date : 0;
}

function resetForm() {
  form.reset();
  form.elements.slug.value = "";
  form.elements.sha.value = "";
  form.elements.date.valueAsDate = new Date();
  form.elements.status.value = "published";
  deletePostButton.hidden = true;
  document.querySelectorAll(".studio-post-item").forEach((item) => item.removeAttribute("aria-current"));
}

function renderPosts() {
  const sorted = [...posts].sort((a, b) => postSortTime(b) - postSortTime(a) || a.title.localeCompare(b.title, "zh-Hans"));
  if (!sorted.length) {
    postList.innerHTML = '<p class="studio-empty">还没有文章。</p>';
    return;
  }

  postList.innerHTML = sorted
    .map(
      (post) => `<button class="studio-post-item" type="button" data-slug="${escapeHtml(post.slug)}">
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(post.date)}${post.status === "draft" ? " · 草稿" : ""}</span>
      </button>`
    )
    .join("");
}

async function loadPosts() {
  setStatus("正在读取文章...");
  sessionStorage.setItem("workerUrl", currentWorkerUrl());
  sessionStorage.setItem("adminPassword", currentPassword());
  const result = await apiRequest("/posts");
  posts = result.posts || [];
  renderPosts();
  setStatus(`已读取 ${posts.length} 篇文章。`, "success");
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
  form.elements.tags.value = (post.tags || []).join(", ");
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
    await loadPosts();
    await loadPost(result.slug);
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
    await loadPosts();
    setStatus("已删除，GitHub Pages 正在自动构建。", "success");
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
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    imageFileInput.value = "";
  }
}

connectButton.addEventListener("click", () => {
  loadPosts().catch((error) => setStatus(error.message, "error"));
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
form.addEventListener("submit", savePost);
deletePostButton.addEventListener("click", deletePost);
insertImageButton.addEventListener("click", () => imageFileInput.click());
imageFileInput.addEventListener("change", uploadImage);

workerUrlInput.value = sessionStorage.getItem("workerUrl") || workerUrlInput.value;
passwordInput.value = sessionStorage.getItem("adminPassword") || "";
resetForm();
