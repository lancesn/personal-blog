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

const shareBar = document.querySelector(".article-share-row");
if (shareBar) {
  const title = article?.dataset.postTitle || document.title;
  const description = article?.dataset.postDescription || "";
  const url = article?.dataset.postUrl || window.location.href;
  const copyButton = shareBar.querySelector("[data-share-copy]");
  const xLink = shareBar.querySelector("[data-share-x]");
  const facebookLink = shareBar.querySelector("[data-share-facebook]");
  const whatsappLink = shareBar.querySelector("[data-share-whatsapp]");
  const wechatButton = shareBar.querySelector("[data-share-wechat]");
  const weiboLink = shareBar.querySelector("[data-share-weibo]");
  const hint = shareBar.querySelector("[data-share-hint]");

  const shareSummary = description ? `${title}\n\n${description}` : title;
  const shareUrl = new URL(url, window.location.href).href;
  const shareText = `${shareSummary}\n\n阅读全文：${shareUrl}`;
  const copyText = shareUrl;

  if (xLink) xLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  if (weiboLink) {
    weiboLink.href = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareSummary)}&searchPic=false`;
  }
  if (whatsappLink) whatsappLink.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  if (facebookLink) facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  [xLink, weiboLink, whatsappLink, facebookLink].filter(Boolean).forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  const canUseNativeShare = () => {
    if (!navigator.share) return false;
    if (!navigator.canShare) return true;
    return navigator.canShare({ title, text: description || title, url: shareUrl });
  };

  async function nativeShare() {
    await navigator.share({ title, text: description || title, url: shareUrl });
  }

  async function copyUrl(successText = "已复制文章链接") {
    try {
      await navigator.clipboard.writeText(copyText);
      if (hint) hint.textContent = successText;
      window.setTimeout(() => {
        if (hint) hint.textContent = "";
      }, 1600);
    } catch {
      if (hint) hint.textContent = "复制失败，请手动复制地址栏链接。";
    }
  }

  copyButton?.addEventListener("click", () => {
    copyUrl();
  });

  wechatButton?.addEventListener("click", async () => {
    if (canUseNativeShare()) {
      try {
        await nativeShare();
        if (hint) hint.textContent = "";
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    copyUrl("文章链接已复制，请打开微信粘贴分享。");
  });

  facebookLink?.addEventListener("click", async (event) => {
    if (!canUseNativeShare()) return;
    event.preventDefault();

    try {
      await nativeShare();
      if (hint) hint.textContent = "";
    } catch (error) {
      if (error?.name === "AbortError") return;
      window.location.href = facebookLink.href;
    }
  });

  const posterButton = shareBar.querySelector("[data-share-poster]");
  const posterModal = document.querySelector("#poster-modal");
  if (posterButton && posterModal) {
    const canvas = posterModal.querySelector("#poster-canvas");
    const downloadLink = posterModal.querySelector("#poster-download");
    const posterHint = posterModal.querySelector(".poster-modal-hint");
    const posterFileName = `${(article?.dataset.postSlug || "share").trim()}-share.png`;
    const supportsFileShare = Boolean(
      navigator.canShare && navigator.canShare({ files: [new File([], posterFileName, { type: "image/png" })] })
    );
    let lastObjectUrl = "";
    let lastBlob = null;
    let posterReady = false;

    if (downloadLink && supportsFileShare) {
      downloadLink.textContent = "保存 / 分享图片";
      if (posterHint) posterHint.textContent = "点击后可直接保存到相册，或分享到微信等应用";
    }

    const loadScriptOnce = (src) =>
      new Promise((resolve, reject) => {
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

    function wrapCanvasText(ctx, text, maxWidth) {
      const lines = [];
      let current = "";
      for (const char of text) {
        const attempt = current + char;
        if (current && ctx.measureText(attempt).width > maxWidth) {
          lines.push(current);
          current = char;
        } else {
          current = attempt;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    function drawPoster(qrImage) {
      const width = canvas.dataset.baseWidth ? Number(canvas.dataset.baseWidth) : canvas.width;
      const height = canvas.dataset.baseHeight ? Number(canvas.dataset.baseHeight) : canvas.height;
      canvas.dataset.baseWidth = String(width);
      canvas.dataset.baseHeight = String(height);

      const scale = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);

      const styles = getComputedStyle(document.documentElement);
      const readVar = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
      const soft = readVar("--soft", "#f6f6f4");
      const textColor = readVar("--text", "#222222");
      const muted = readVar("--muted", "#666666");
      const primary = readVar("--primary-strong", "#3f4c44");
      const lineColor = readVar("--line", "#e7e5e0");

      const padding = 64;

      ctx.fillStyle = soft;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(padding / 2, padding / 2, width - padding, height - padding);

      ctx.textBaseline = "top";
      ctx.fillStyle = primary;
      ctx.font = "700 26px serif";
      ctx.fillText("蓬窗灯影录", padding, padding + 16);

      let cursorY = padding + 90;
      ctx.fillStyle = textColor;
      ctx.font = "700 46px serif";
      wrapCanvasText(ctx, title, width - padding * 2)
        .slice(0, 3)
        .forEach((lineText) => {
          ctx.fillText(lineText, padding, cursorY);
          cursorY += 60;
        });

      cursorY += 24;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, cursorY);
      ctx.lineTo(width - padding, cursorY);
      ctx.stroke();
      cursorY += 44;

      ctx.fillStyle = muted;
      ctx.font = "400 27px serif";
      wrapCanvasText(ctx, description || title, width - padding * 2)
        .slice(0, 9)
        .forEach((lineText) => {
          ctx.fillText(lineText, padding, cursorY);
          cursorY += 42;
        });

      const qrSize = 150;
      const qrX = padding;
      const qrY = height - padding - qrSize;
      if (qrImage) ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = textColor;
      ctx.font = "700 24px serif";
      ctx.fillText("扫码阅读全文", qrX + qrSize + 26, qrY + 30);
      ctx.fillStyle = muted;
      ctx.font = "400 20px serif";
      ctx.fillText("silencegate.com", qrX + qrSize + 26, qrY + 68);
    }

    async function generatePoster() {
      await loadScriptOnce("../vendor/qrcode.min.js");
      const qrDataUrl = await new Promise((resolve, reject) => {
        window.QRCode.toDataURL(shareUrl, { width: 600, margin: 1 }, (error, dataUrl) => {
          if (error) reject(error);
          else resolve(dataUrl);
        });
      });
      const qrImage = new Image();
      await new Promise((resolve, reject) => {
        qrImage.addEventListener("load", resolve);
        qrImage.addEventListener("error", () => reject(new Error("二维码加载失败")));
        qrImage.src = qrDataUrl;
      });

      drawPoster(qrImage);

      await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            lastBlob = blob;
            if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
            lastObjectUrl = URL.createObjectURL(blob);
            if (downloadLink) downloadLink.href = lastObjectUrl;
          }
          resolve();
        });
      });
      posterReady = true;
    }

    const closePosterModal = () => {
      posterModal.hidden = true;
    };

    posterButton.addEventListener("click", () => {
      posterModal.hidden = false;
      if (!posterReady) {
        generatePoster().catch((error) => {
          if (hint) hint.textContent = "生成分享图失败，请稍后重试。";
          console.warn(error);
        });
      }
    });

    downloadLink?.addEventListener("click", (event) => {
      if (!supportsFileShare || !lastBlob) return;
      event.preventDefault();
      const file = new File([lastBlob], posterFileName, { type: "image/png" });
      navigator.share({ files: [file], title, text: description || title }).catch((error) => {
        if (error?.name === "AbortError") return;
        console.warn("分享图片失败", error);
        window.open(lastObjectUrl, "_blank");
      });
    });

    posterModal.querySelectorAll("[data-poster-close]").forEach((element) => {
      element.addEventListener("click", closePosterModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !posterModal.hidden) closePosterModal();
    });
  }
}

document.addEventListener("dragstart", (event) => {
  if (event.target.closest("img")) event.preventDefault();
});

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest("img")) event.preventDefault();
});

const protectedContent = document.querySelector(".article-content:not(.studio-preview)");
if (protectedContent) {
  protectedContent.addEventListener("copy", (event) => event.preventDefault());
  protectedContent.addEventListener("contextmenu", (event) => event.preventDefault());
  protectedContent.addEventListener("selectstart", (event) => event.preventDefault());
}

const readingProgress = document.querySelector("#reading-progress");
if (readingProgress && protectedContent) {
  const updateReadingProgress = () => {
    const rect = protectedContent.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    const percent = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
    readingProgress.style.width = `${percent}%`;
  };

  window.addEventListener("scroll", updateReadingProgress, { passive: true });
  window.addEventListener("resize", updateReadingProgress);
  updateReadingProgress();
}
