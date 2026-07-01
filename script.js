const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const storedTheme = localStorage.getItem("theme");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  if (toggle) toggle.textContent = isDark ? "☾" : "☼";
}

applyTheme(storedTheme || (systemTheme.matches ? "dark" : "light"));

systemTheme.addEventListener("change", (event) => {
  if (!localStorage.getItem("theme")) {
    applyTheme(event.matches ? "dark" : "light");
  }
});

if (toggle) {
  toggle.addEventListener("click", () => {
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  });
}

const navLinks = [...document.querySelectorAll(".top-nav a")];
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.removeAttribute("aria-current"));
    link.setAttribute("aria-current", "page");
  });
});

const contactEmail = document.querySelector("[data-contact-email]");
if (contactEmail) {
  contactEmail.addEventListener("click", (event) => {
    event.preventDefault();
    const user = contactEmail.dataset.emailUser;
    const domain = contactEmail.dataset.emailDomain;
    if (user && domain) {
      window.location.href = `mailto:${user}@${domain}`;
    }
  });
}

const heroCarousel = document.querySelector("[data-hero-carousel]");
if (heroCarousel) {
  const slides = [...heroCarousel.querySelectorAll(".hero-media img")];
  let order = shuffleIndexes(slides.length);
  let orderIndex = 0;
  let activeIndex = order[orderIndex];

  function shuffleIndexes(length) {
    const indexes = Array.from({ length }, (_, index) => index);
    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
    }
    return indexes;
  }

  function nextIndex() {
    const previousIndex = activeIndex;
    orderIndex += 1;

    if (orderIndex >= order.length) {
      order = shuffleIndexes(slides.length);
      if (order[0] === previousIndex && order.length > 1) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      orderIndex = 0;
    }

    return order[orderIndex];
  }

  function showSlide(index) {
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
    });
  }

  showSlide(activeIndex);
  window.setInterval(() => {
    activeIndex = nextIndex();
    showSlide(activeIndex);
  }, 6000);
}

const searchInput = document.querySelector("[data-search-input]");
if (searchInput) {
  const cards = [...document.querySelectorAll("[data-search-card]")];
  const status = document.querySelector("[data-search-status]");
  const results = document.querySelector("[data-search-results]");
  const resultLabel = searchInput.dataset.searchLabel || "结果";

  function filterPosts() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    if (results) results.hidden = !query;

    cards.forEach((card) => {
      const haystack = `${card.dataset.title} ${card.dataset.tags} ${card.dataset.body}`.toLowerCase();
      const isVisible = Boolean(query) && haystack.includes(query);
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    status.textContent = query ? `找到 ${visibleCount} 篇${resultLabel}` : "";
  }

  searchInput.addEventListener("input", filterPosts);
  filterPosts();
}

const archiveCalendar = document.querySelector("[data-archive-calendar]");
if (archiveCalendar) {
  const yearSelect = archiveCalendar.querySelector("[data-archive-year]");
  const monthSelect = archiveCalendar.querySelector("[data-archive-month]");
  const title = archiveCalendar.querySelector("[data-archive-title]");
  const grid = archiveCalendar.querySelector("[data-archive-grid]");
  const posts = JSON.parse(archiveCalendar.dataset.posts || "[]");

  function escapeArchiveHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function postsForDate(date) {
    return posts.filter((post) => post.date === date);
  }

  function renderArchiveCalendar() {
    const year = Number(yearSelect.value);
    const month = Number(monthSelect.value);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const cells = [];

    title.textContent = `${year}年${month}月`;

    for (let index = 0; index < leadingBlanks; index += 1) {
      cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayPosts = postsForDate(date);
      const links = dayPosts
        .map((post) => `<a href="${escapeArchiveHtml(post.url)}">${escapeArchiveHtml(post.title)}</a>`)
        .join("");
      cells.push(`<div class="calendar-day${dayPosts.length ? " has-post" : ""}">
        <time datetime="${date}">${day}</time>
        ${links}
      </div>`);
    }

    grid.innerHTML = cells.join("");
  }

  yearSelect.addEventListener("change", renderArchiveCalendar);
  monthSelect.addEventListener("change", renderArchiveCalendar);
  renderArchiveCalendar();
}

const article = document.querySelector("[data-post-slug]");
if (article) {
  const slug = article.dataset.postSlug;
  fetch(`/api/views/${encodeURIComponent(slug)}`, { method: "POST" }).catch(() => {});
}

const shareBar = document.querySelector(".share-bar");
if (shareBar) {
  const title = article?.dataset.postTitle || document.title;
  const description = article?.dataset.postDescription || "";
  const url = article?.dataset.postUrl || window.location.href;
  const toggleButton = shareBar.querySelector("[data-share-toggle]");
  const shareMenu = shareBar.querySelector("[data-share-menu]");
  const copyButton = shareBar.querySelector("[data-share-copy]");
  const wechatButton = shareBar.querySelector("[data-share-wechat]");
  const xLink = shareBar.querySelector("[data-share-x]");
  const facebookLink = shareBar.querySelector("[data-share-facebook]");
  const whatsappLink = shareBar.querySelector("[data-share-whatsapp]");
  const weiboLink = shareBar.querySelector("[data-share-weibo]");
  const mailLink = shareBar.querySelector("[data-share-mail]");
  const hint = shareBar.querySelector("[data-share-hint]");
  const previewDescription = shareBar.querySelector("[data-share-preview-description]");
  const previewUrl = shareBar.querySelector("[data-share-preview-url]");

  const shareSummary = description ? `${title}\n\n${description}` : title;
  const shareUrl = encodeURI(new URL(url, window.location.href).href);
  const shareText = `${shareSummary}\n\n阅读全文：${shareUrl}`;
  const copyText = shareUrl;

  if (previewDescription) previewDescription.textContent = description;
  if (previewUrl) previewUrl.textContent = "";
  xLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  whatsappLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  weiboLink.href = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareSummary)}&searchPic=false`;
  mailLink.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText)}`;

  [xLink, facebookLink, whatsappLink, weiboLink].forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  function setMenu(open) {
    shareMenu.hidden = !open;
    toggleButton.setAttribute("aria-expanded", String(open));
  }

  async function copyUrl(successText = "已复制文章链接") {
    try {
      await navigator.clipboard.writeText(copyText);
      hint.textContent = successText;
      window.setTimeout(() => {
        hint.textContent = "";
      }, 1600);
    } catch {
      hint.textContent = "复制失败，请手动复制文章名和地址栏链接。";
    }
  }

  toggleButton.addEventListener("click", () => {
    setMenu(shareMenu.hidden);
  });

  copyButton.addEventListener("click", () => {
    copyUrl();
  });

  wechatButton.addEventListener("click", () => {
    copyUrl("文章链接已复制，请打开微信粘贴分享。");
  });

  mailLink.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = mailLink.href;
  });

  document.addEventListener("click", (event) => {
    if (!shareBar.contains(event.target)) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });
}
