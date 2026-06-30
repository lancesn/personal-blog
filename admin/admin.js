const form = document.querySelector("#post-form");
const postList = document.querySelector("#post-list");
const newPostButton = document.querySelector("#new-post");
const deletePostButton = document.querySelector("#delete-post");
const savePostButton = document.querySelector("#save-post");
const insertImageButton = document.querySelector("#insert-image");
const imageFileInput = document.querySelector("#image-file");
const publishSiteButton = document.querySelector("#publish-site");
const statusText = document.querySelector("#status");
const dateInput = form.elements.date;
const bodyInput = form.elements.body;

function setStatus(message, tone = "neutral") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function isEditing() {
  return Boolean(form.elements.slug.value);
}

function resetForm() {
  form.reset();
  form.elements.slug.value = "";
  dateInput.valueAsDate = new Date();
  deletePostButton.hidden = true;
  savePostButton.textContent = "保存并生成网页";
  setStatus("");
  document.querySelectorAll(".studio-post-item").forEach((item) => {
    item.removeAttribute("aria-current");
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "请求失败");
  }
  return result;
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

function renderPostList(posts) {
  if (!posts.length) {
    postList.innerHTML = '<p class="studio-empty">还没有文章。</p>';
    return;
  }

  postList.innerHTML = posts
    .map(
      (post) => `<button class="studio-post-item" type="button" data-slug="${post.slug}">
        <strong>${post.title}</strong>
        <span>${post.date} · ${post.readingTime || "1 分钟阅读"} · 阅读 ${post.views || 0}${post.status === "draft" ? " · 草稿" : ""}</span>
      </button>`
    )
    .join("");
}

async function loadPosts() {
  const posts = await requestJson("/api/posts");
  renderPostList(posts);
}

async function loadPost(slug) {
  setStatus("正在加载文章...");
  const post = await requestJson(`/api/posts/${encodeURIComponent(slug)}`);

  form.elements.slug.value = post.slug;
  form.elements.title.value = post.title;
  form.elements.date.value = post.date;
  form.elements.description.value = post.description;
  form.elements.readingTime.value = post.readingTime || "";
  form.elements.tags.value = (post.tags || []).join(", ");
  form.elements.status.value = post.status || "published";
  form.elements.body.value = post.body;
  deletePostButton.hidden = false;
  savePostButton.textContent = "保存修改并生成网页";

  document.querySelectorAll(".studio-post-item").forEach((item) => {
    item.toggleAttribute("aria-current", item.dataset.slug === slug);
  });
  setStatus(`正在编辑：${post.slug}.md`);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("正在保存...");

  const payload = Object.fromEntries(new FormData(form).entries());
  const slug = payload.slug;
  delete payload.slug;

  try {
    const result = await requestJson(slug ? `/api/posts/${encodeURIComponent(slug)}` : "/api/posts", {
      method: slug ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setStatus(`已保存：${result.file}。可以打开 dist/posts/${result.slug}.html 预览。`, "success");
    await loadPosts();
    await loadPost(result.slug);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

postList.addEventListener("click", async (event) => {
  const item = event.target.closest(".studio-post-item");
  if (!item) return;

  try {
    await loadPost(item.dataset.slug);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

newPostButton.addEventListener("click", resetForm);

deletePostButton.addEventListener("click", async () => {
  const slug = form.elements.slug.value;
  if (!slug) return;
  const confirmed = window.confirm(`确定删除 ${slug}.md 吗？这会删除文章源文件并重新生成网页。`);
  if (!confirmed) return;

  try {
    setStatus("正在删除...");
    await requestJson(`/api/posts/${encodeURIComponent(slug)}`, { method: "DELETE" });
    await loadPosts();
    resetForm();
    setStatus("文章已删除，并已重新生成网页。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

insertImageButton.addEventListener("click", () => {
  imageFileInput.click();
});

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files[0];
  if (!file) return;

  try {
    setStatus("正在上传图片...");
    const dataUrl = await readFileAsDataUrl(file);
    const result = await requestJson("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        data: dataUrl
      })
    });

    insertAtCursor(bodyInput, result.markdown);
    setStatus(`已插入图片：${result.file}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    imageFileInput.value = "";
  }
});

publishSiteButton.addEventListener("click", async () => {
  const confirmed = window.confirm("确定提交当前改动并推送到 GitHub 吗？这会触发 GitHub Pages 发布。");
  if (!confirmed) return;

  try {
    setStatus("正在发布到 GitHub...");
    const result = await requestJson("/api/publish", { method: "POST" });
    setStatus(result.message, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

resetForm();
loadPosts().catch((error) => setStatus(error.message, "error"));
