const repoInput = document.querySelector("#repo");
const branchInput = document.querySelector("#branch");
const tokenInput = document.querySelector("#token");
const connectButton = document.querySelector("#connect");
const forgetTokenButton = document.querySelector("#forget-token");
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

function currentRepo() {
  return repoInput.value.trim();
}

function currentBranch() {
  return branchInput.value.trim() || "main";
}

function currentToken() {
  return tokenInput.value.trim() || sessionStorage.getItem("githubToken") || "";
}

function githubApi(path) {
  const repo = currentRepo();
  if (!repo.includes("/")) throw new Error("仓库格式应为 owner/repo。");
  return `https://api.github.com/repos/${repo}${path}`;
}

function encodeContentPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest(path, options = {}) {
  const token = currentToken();
  if (!token) throw new Error("请先输入 GitHub Token。");

  const response = await fetch(githubApi(path), {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(result.message || "GitHub 请求失败。");
  }
  return result;
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
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
  if (!match) throw new Error(`${fileName} 缺少 frontmatter。`);

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

function slugify(value) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializePost(payload, previous = {}) {
  const tags = payload.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const publishedAt = previous.publishedAt || new Date().toISOString();
  const description = payload.description.trim();
  const readingTime = payload.readingTime.trim();

  return `---
title: ${payload.title.trim()}
date: ${payload.date}
description: ${description}
readingTime: ${readingTime}
tags: [${tags.join(", ")}]
status: ${payload.status}
publishedAt: ${publishedAt}
---

${payload.body.trim()}
`;
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
  setStatus("正在读取 GitHub 文章...");
  sessionStorage.setItem("githubToken", currentToken());
  sessionStorage.setItem("githubRepo", currentRepo());
  sessionStorage.setItem("githubBranch", currentBranch());

  const branch = encodeURIComponent(currentBranch());
  const files = await githubRequest(`/contents/content/posts?ref=${branch}`);
  const markdownFiles = files.filter((file) => file.type === "file" && file.name.endsWith(".md"));
  const loadedPosts = [];
  for (const file of markdownFiles) {
    const detail = await githubRequest(`/contents/${encodeContentPath(file.path)}?ref=${branch}`);
    loadedPosts.push(parseMarkdown(decodeBase64(detail.content), file.name, detail.sha));
  }
  posts = loadedPosts;
  renderPosts();
  setStatus(`已读取 ${posts.length} 篇文章。`, "success");
}

function loadPost(slug) {
  const post = posts.find((item) => item.slug === slug);
  if (!post) return;

  form.elements.slug.value = post.slug;
  form.elements.sha.value = post.sha;
  form.elements.title.value = post.title;
  form.elements.date.value = post.date;
  form.elements.description.value = post.description;
  form.elements.readingTime.value = post.readingTime;
  form.elements.tags.value = post.tags.join(", ");
  form.elements.status.value = post.status;
  form.elements.body.value = post.body;
  deletePostButton.hidden = protectedSlugs.has(post.slug);

  document.querySelectorAll(".studio-post-item").forEach((item) => {
    item.toggleAttribute("aria-current", item.dataset.slug === slug);
  });
  setStatus(`正在编辑：${post.slug}.md`);
}

async function savePost(event) {
  event.preventDefault();

  const payload = Object.fromEntries(new FormData(form).entries());
  const previous = posts.find((post) => post.slug === payload.slug);
  const slug = payload.slug || slugify(payload.title);
  const path = `content/posts/${slug}.md`;
  const content = serializePost(payload, previous);
  const message = payload.slug ? `Update post: ${payload.title}` : `Add post: ${payload.title}`;

  try {
    setStatus("正在提交到 GitHub...");
    await githubRequest(`/contents/${encodeContentPath(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: encodeBase64(content),
        branch: currentBranch(),
        ...(payload.sha ? { sha: payload.sha } : {})
      })
    });
    setStatus("已提交到 GitHub，GitHub Pages 正在自动构建。", "success");
    await loadPosts();
    loadPost(slug);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function deletePost() {
  const slug = form.elements.slug.value;
  const sha = form.elements.sha.value;
  if (!slug || !sha) return;
  if (protectedSlugs.has(slug)) {
    setStatus("这篇文章已保护，不能删除。", "error");
    return;
  }
  if (!window.confirm(`确定删除 ${slug}.md 吗？`)) return;

  try {
    setStatus("正在删除...");
    await githubRequest(`/contents/${encodeContentPath(`content/posts/${slug}.md`)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Delete post: ${slug}`,
        sha,
        branch: currentBranch()
      })
    });
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
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "png";
    const safeName = `image-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}.${extension}`;
    const path = `uploads/${safeName}`;
    const content = dataUrl.split(",")[1];

    await githubRequest(`/contents/${encodeContentPath(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Upload image: ${safeName}`,
        content,
        branch: currentBranch()
      })
    });

    insertAtCursor(form.elements.body, `![${file.name}](../uploads/${safeName})`);
    setStatus("图片已上传并插入正文。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    imageFileInput.value = "";
  }
}

connectButton.addEventListener("click", () => {
  loadPosts().catch((error) => setStatus(error.message, "error"));
});

forgetTokenButton.addEventListener("click", () => {
  tokenInput.value = "";
  sessionStorage.removeItem("githubToken");
  setStatus("已清除当前浏览器会话里的 Token。", "success");
});

newPostButton.addEventListener("click", resetForm);
postList.addEventListener("click", (event) => {
  const item = event.target.closest(".studio-post-item");
  if (item) loadPost(item.dataset.slug);
});
form.addEventListener("submit", savePost);
deletePostButton.addEventListener("click", deletePost);
insertImageButton.addEventListener("click", () => imageFileInput.click());
imageFileInput.addEventListener("change", uploadImage);

repoInput.value = sessionStorage.getItem("githubRepo") || repoInput.value;
branchInput.value = sessionStorage.getItem("githubBranch") || branchInput.value;
tokenInput.value = sessionStorage.getItem("githubToken") || "";
resetForm();
