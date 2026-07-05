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

const tagGraphContainer = document.querySelector("[data-tag-graph]");
if (tagGraphContainer) {
  const canvas = tagGraphContainer.querySelector("[data-tag-graph-canvas]");
  const ctx = canvas.getContext("2d");
  const graphData = JSON.parse(tagGraphContainer.dataset.graph || '{"nodes":[],"edges":[]}');

  const nodes = graphData.nodes.map((node, index) => {
    const angle = (index / Math.max(1, graphData.nodes.length)) * Math.PI * 2;
    const radius = 60 + Math.random() * 120;
    return {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      r: node.type === "tag" ? 9 + Math.min(node.count || 1, 8) * 1.4 : 5
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = graphData.edges
    .map((edge) => ({ source: nodeById.get(edge.source), target: nodeById.get(edge.target) }))
    .filter((edge) => edge.source && edge.target);

  const view = { x: 0, y: 0, scale: 1 };
  let dpr = Math.max(window.devicePixelRatio || 1, 1);
  let width = 0;
  let height = 0;
  let settled = false;
  let rafId = 0;
  let dragNode = null;
  let panning = false;
  let moved = false;
  let lastPointer = { x: 0, y: 0 };
  let pinching = false;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchMidpoint = { x: 0, y: 0 };

  function resize(recenter) {
    const rect = tagGraphContainer.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (recenter || (!view.x && !view.y)) {
      view.x = width / 2;
      view.y = height / 2;
    }
  }

  function toScreen(node) {
    return { x: node.x * view.scale + view.x, y: node.y * view.scale + view.y };
  }

  function step() {
    const repulsion = 2600;
    const springLength = 90;
    const springStrength = 0.02;
    const centerPull = 0.006;
    const damping = 0.86;
    let kinetic = 0;

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (a === dragNode) continue;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (b === dragNode) continue;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy || 0.01;
        const force = repulsion / distSq;
        const dist = Math.sqrt(distSq);
        dx /= dist;
        dy /= dist;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }
      a.vx -= a.x * centerPull;
      a.vy -= a.y * centerPull;
    }

    for (const edge of edges) {
      if (edge.source === dragNode || edge.target === dragNode) continue;
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - springLength) * springStrength;
      const nx = (dx / dist) * force;
      const ny = (dy / dist) * force;
      edge.source.vx += nx;
      edge.source.vy += ny;
      edge.target.vx -= nx;
      edge.target.vy -= ny;
    }

    for (const node of nodes) {
      if (node === dragNode) continue;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
      kinetic += node.vx * node.vx + node.vy * node.vy;
    }

    return kinetic;
  }

  function render() {
    const styles = getComputedStyle(document.documentElement);
    const readVar = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    const lineColor = readVar("--line", "#e7e5e0");
    const tagFill = readVar("--primary-strong", "#3f4c44");
    const postFill = readVar("--card", "#ffffff");
    const textColor = readVar("--text", "#222222");
    const mutedColor = readVar("--muted", "#666666");
    const fontFamily = readVar("--font-ui", "sans-serif");

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    for (const edge of edges) {
      const from = toScreen(edge.source);
      const to = toScreen(edge.target);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    ctx.textBaseline = "middle";
    for (const node of nodes) {
      const pos = toScreen(node);
      const r = node.r * view.scale;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      if (node.type === "tag") {
        ctx.fillStyle = tagFill;
      } else {
        ctx.fillStyle = postFill;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.fill();

      const fontSize = (node.type === "tag" ? 13 : 11) * view.scale;
      ctx.font = `${node.type === "tag" ? 700 : 400} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = node.type === "tag" ? textColor : mutedColor;
      ctx.fillText(node.label, pos.x + r + 6 * view.scale, pos.y);
    }
  }

  function loop() {
    const kinetic = step();
    render();
    if (kinetic > 0.02) {
      rafId = requestAnimationFrame(loop);
    } else {
      settled = true;
      rafId = 0;
    }
  }

  function wake() {
    settled = false;
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function nodeAtScreenPoint(x, y) {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i];
      const pos = toScreen(node);
      const r = Math.max(node.r * view.scale, 10);
      if ((pos.x - x) ** 2 + (pos.y - y) ** 2 <= r * r) return node;
    }
    return null;
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function touchMidpoint(touches) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
    };
  }

  function onPointerDown(event) {
    if (event.touches && event.touches.length === 2) {
      dragNode = null;
      panning = false;
      pinching = true;
      pinchStartDistance = touchDistance(event.touches);
      pinchStartScale = view.scale;
      pinchMidpoint = touchMidpoint(event.touches);
      return;
    }
    const point = pointerPosition(event);
    lastPointer = point;
    moved = false;
    const node = nodeAtScreenPoint(point.x, point.y);
    if (node) {
      dragNode = node;
      dragNode.vx = 0;
      dragNode.vy = 0;
    } else {
      panning = true;
    }
  }

  function onPointerMove(event) {
    if (pinching && event.touches && event.touches.length === 2) {
      const distance = touchDistance(event.touches);
      const midpoint = touchMidpoint(event.touches);
      const nextScale = Math.min(20, Math.max(0.3, pinchStartScale * (distance / pinchStartDistance)));
      const worldX = (pinchMidpoint.x - view.x) / view.scale;
      const worldY = (pinchMidpoint.y - view.y) / view.scale;
      view.scale = nextScale;
      view.x = midpoint.x - worldX * nextScale;
      view.y = midpoint.y - worldY * nextScale;
      if (settled) render();
      event.preventDefault();
      return;
    }
    if (!dragNode && !panning) return;
    const point = pointerPosition(event);
    const dx = point.x - lastPointer.x;
    const dy = point.y - lastPointer.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    if (dragNode) {
      dragNode.x = (point.x - view.x) / view.scale;
      dragNode.y = (point.y - view.y) / view.scale;
      wake();
    } else if (panning) {
      view.x += dx;
      view.y += dy;
      if (settled) render();
    }
    lastPointer = point;
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (pinching) {
      if (!event.touches || event.touches.length < 2) pinching = false;
      return;
    }
    if (dragNode && !moved) {
      window.location.href = dragNode.url;
    }
    dragNode = null;
    panning = false;
  }

  function onWheel(event) {
    event.preventDefault();
    const point = pointerPosition(event);
    const oldScale = view.scale;
    const nextScale = Math.min(20, Math.max(0.3, oldScale * (event.deltaY > 0 ? 0.9 : 1.1)));
    const worldX = (point.x - view.x) / oldScale;
    const worldY = (point.y - view.y) / oldScale;
    view.scale = nextScale;
    view.x = point.x - worldX * nextScale;
    view.y = point.y - worldY * nextScale;
    if (settled) render();
  }

  canvas.addEventListener("mousedown", onPointerDown);
  canvas.addEventListener("touchstart", onPointerDown, { passive: true });
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("mouseup", onPointerUp);
  window.addEventListener("touchend", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  window.addEventListener("resize", () => {
    resize();
    if (settled) render();
  });

  new MutationObserver(() => {
    if (settled) render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const fullscreenButton = tagGraphContainer.querySelector("[data-tag-graph-fullscreen]");
  if (fullscreenButton) {
    let isFullscreen = false;

    function setFullscreen(next) {
      isFullscreen = next;
      tagGraphContainer.classList.toggle("is-fullscreen", isFullscreen);
      fullscreenButton.innerHTML = isFullscreen
        ? fullscreenButton.dataset.collapseIcon
        : fullscreenButton.dataset.expandIcon;
      fullscreenButton.setAttribute("aria-label", isFullscreen ? "退出全屏" : "全屏查看关系图谱");
      fullscreenButton.setAttribute("title", isFullscreen ? "退出全屏" : "全屏查看");
      resize(true);
      render();
    }

    fullscreenButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setFullscreen(!isFullscreen);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isFullscreen) setFullscreen(false);
    });
  }

  resize();
  loop();
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

  function legacyCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch {
      succeeded = false;
    }
    document.body.removeChild(textarea);
    return succeeded;
  }

  async function copyUrl(successText = "已复制文章链接") {
    const showSuccess = () => {
      if (hint) hint.textContent = successText;
      window.setTimeout(() => {
        if (hint) hint.textContent = "";
      }, 1600);
    };

    // Try the legacy, synchronous copy method first: WeChat's in-app browser
    // can leave the modern Clipboard API's permission prompt pending forever,
    // making navigator.clipboard.writeText() hang without ever resolving.
    if (legacyCopy(copyText)) {
      showSuccess();
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      showSuccess();
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
    const isMobileDevice = window.matchMedia("(pointer: coarse)").matches;
    const supportsFileShare = Boolean(
      isMobileDevice &&
        navigator.canShare &&
        navigator.canShare({ files: [new File([], posterFileName, { type: "image/png" })] })
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
