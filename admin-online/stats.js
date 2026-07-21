const workerUrlInput = document.querySelector("#worker-url");
const passwordInput = document.querySelector("#admin-password");
const rememberPasswordInput = document.querySelector("#remember-password");
const loadStatsButton = document.querySelector("#load-stats");
const forgetPasswordButton = document.querySelector("#forget-password");
const statsStatus = document.querySelector("#stats-status");
const statsResults = document.querySelector("#stats-results");
const statsTotal = document.querySelector("#stats-total");
const statsByLocation = document.querySelector("#stats-by-location");
const statsByPath = document.querySelector("#stats-by-path");

function currentWorkerUrl() {
  return workerUrlInput.value.trim().replace(/\/+$/, "");
}

function currentPassword() {
  return passwordInput.value || localStorage.getItem("adminPassword") || sessionStorage.getItem("adminPassword") || "";
}

async function apiRequest(path) {
  const workerUrl = currentWorkerUrl();
  const password = currentPassword();
  if (!workerUrl) throw new Error("请先填写 Worker 地址。");
  if (!password) throw new Error("请先输入后台密码。");

  const response = await fetch(`${workerUrl}${path}`, {
    headers: { "X-Admin-Password": password }
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(result.error || "请求失败。");
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

let regionNames = null;
try {
  regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
} catch {
  regionNames = null;
}

function countryLabel(code) {
  if (!code || code === "XX") return "未知";
  try {
    const name = regionNames?.of(code);
    return name && name !== code ? `${name}（${code}）` : code;
  } catch {
    return code;
  }
}

function locationLabel(row) {
  const parts = [countryLabel(row.country)];
  if (row.region && row.region !== row.city) parts.push(row.region);
  if (row.city) parts.push(row.city);
  return parts.join(" · ");
}

function renderStatsTable(table, rows, label) {
  table.innerHTML = rows.length
    ? `<tbody>${rows.map((row) => `<tr><td>${escapeHtml(label(row))}</td><td>${escapeHtml(String(row.views))}</td></tr>`).join("")}</tbody>`
    : `<tbody><tr><td colspan="2">暂无数据。</td></tr></tbody>`;
}

async function loadStats() {
  statsStatus.textContent = "正在读取统计...";
  statsStatus.dataset.tone = "neutral";
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

  const result = await apiRequest("/stats");
  statsTotal.textContent = `总阅读次数：${result.totalViews || 0}`;
  renderStatsTable(statsByLocation, result.byLocation || [], locationLabel);
  renderStatsTable(statsByPath, result.byPath || [], (row) => row.title || row.path);
  statsResults.hidden = false;
  statsStatus.textContent = "已更新统计。";
  statsStatus.dataset.tone = "success";
}

loadStatsButton.addEventListener("click", () => {
  loadStats().catch((error) => {
    statsStatus.textContent = error.message;
    statsStatus.dataset.tone = "error";
  });
});

forgetPasswordButton.addEventListener("click", () => {
  passwordInput.value = "";
  rememberPasswordInput.checked = false;
  localStorage.removeItem("adminPassword");
  localStorage.removeItem("rememberPassword");
  sessionStorage.removeItem("adminPassword");
  statsStatus.textContent = "已清除保存的后台密码。";
  statsStatus.dataset.tone = "success";
});

workerUrlInput.value = localStorage.getItem("workerUrl") || workerUrlInput.value;
rememberPasswordInput.checked = localStorage.getItem("rememberPassword") === "true";
passwordInput.value = localStorage.getItem("adminPassword") || sessionStorage.getItem("adminPassword") || "";
