import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const COLUMN_DATE = "日期";
const COLUMN_CUSTOMER = "客戶全稱";
const COLUMN_PRODUCT = "品名規格";
const COLUMN_QTY = "數量";
const COLUMN_PRICE = "原幣單價";
const COLUMN_AMOUNT = "總額";
const COLUMN_OWNER = "人員姓名";
const COLUMN_AREA = "區域名稱";
const MAX_OVERDUE_MONTHS = 6;

let auth;
let currentUser = null;
let currentRole = "viewer";
let activeTab = "reminderPanel";
let dataset = { sourceLabel: "", importedAt: "", importedBy: "", rows: [] };

const authCard = document.querySelector("#authCard");
const adminImportCard = document.querySelector("#adminImportCard");
const importStatus = document.querySelector("#importStatus");
const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const loginMessage = document.querySelector("#loginMessage");
const logoutBtn = document.querySelector("#logoutBtn");
const excelInput = document.querySelector("#excelInput");

const reminderMonth = document.querySelector("#reminderMonth");
const reminderOwnerFilter = document.querySelector("#reminderOwnerFilter");
const reminderList = document.querySelector("#reminderList");

const startDateFilter = document.querySelector("#startDateFilter");
const endDateFilter = document.querySelector("#endDateFilter");
const customerFilter = document.querySelector("#customerFilter");
const productFilter = document.querySelector("#productFilter");
const ownerFilter = document.querySelector("#ownerFilter");
const areaFilter = document.querySelector("#areaFilter");
const recordsTableBody = document.querySelector("#recordsTableBody");

const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));

bootstrap();

async function bootstrap() {
  reminderMonth.value = todayMonthString();
  bindEvents();
  applyTabState();

  const configResponse = await fetch("/api/config");
  const config = await configResponse.json();
  const app = initializeApp(config.firebase);
  auth = getAuth(app);

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      currentRole = "viewer";
      authCard.hidden = false;
      adminImportCard.hidden = true;
      logoutBtn.hidden = true;
      dataset = { sourceLabel: "", importedAt: "", importedBy: "", rows: [] };
      importStatus.textContent = "請先登入系統。";
      render();
      return;
    }

    authCard.hidden = true;
    logoutBtn.hidden = false;
    await refreshSession();
    await loadDataset();
    render();
  });
}

function bindEvents() {
  loginForm.addEventListener("submit", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  excelInput.addEventListener("change", handleImport);

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tabTarget;
      applyTabState();
    });
  }

  [reminderMonth, reminderOwnerFilter].forEach((element) => {
    element.addEventListener("input", renderReminders);
    element.addEventListener("change", renderReminders);
  });

  [startDateFilter, endDateFilter, customerFilter, productFilter, ownerFilter, areaFilter].forEach((element) => {
    element.addEventListener("input", renderRecords);
    element.addEventListener("change", renderRecords);
  });
}

function applyTabState() {
  for (const button of tabButtons) {
    button.classList.toggle("is-active", button.dataset.tabTarget === activeTab);
  }

  for (const panel of tabPanels) {
    const isActive = panel.id === activeTab;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  loginMessage.textContent = "登入中...";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    loginMessage.textContent = "";
    loginForm.reset();
  } catch (error) {
    loginMessage.textContent = `登入失敗：${error.message}`;
  }
}

async function handleLogout() {
  await signOut(auth);
}

async function refreshSession() {
  const response = await fetchWithAuth("/api/session");
  const session = await response.json();
  currentRole = session.role;
  adminImportCard.hidden = currentRole !== "admin";
}

async function loadDataset() {
  const response = await fetchWithAuth("/api/data");
  dataset = await response.json();
  importStatus.textContent = dataset.sourceLabel
    ? `目前資料：${dataset.sourceLabel} / 匯入者：${dataset.importedBy || "-"} / 匯入時間：${formatDateTime(dataset.importedAt)}`
    : "目前尚未匯入資料。";
}

async function handleImport(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  importStatus.textContent = "匯入中...";
  try {
    const response = await fetchWithAuth("/api/import", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "匯入失敗");
    dataset = payload.dataset;
    importStatus.textContent = payload.message;
    render();
  } catch (error) {
    importStatus.textContent = error.message;
  } finally {
    excelInput.value = "";
  }
}

async function fetchWithAuth(url, options = {}) {
  const token = currentUser ? await currentUser.getIdToken() : "";
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

function render() {
  renderReminders();
  renderRecords();
}

function renderReminders() {
  if (!currentUser) {
    reminderList.innerHTML = '<div class="empty-state">登入後即可查看客戶週期提醒。</div>';
    return;
  }

  const customerGroups = getGroupedReminderItems();
  if (!customerGroups.length) {
    reminderList.innerHTML = '<div class="empty-state">目前沒有符合條件的週期提醒。</div>';
    return;
  }

  reminderList.innerHTML = customerGroups.map((group) => `
    <article class="reminder-card">
      <h3>${escapeHtml(group.customer)}</h3>
      <p class="muted">共 ${group.items.length} 個品項需要留意</p>
      ${group.items.map((item) => `
        <div class="meta-row" style="margin-top:10px;">
          <span class="pill ${item.badgeClass}">${item.statusLabel}</span>
          <span class="pill">${escapeHtml(item.product)}</span>
          <span class="pill">平均週期 ${item.avgCycleMonths} 個月</span>
          <span class="pill">應回購月份 ${item.expectedMonth}</span>
        </div>
        <p class="muted" style="margin-top:8px;">
          最近購買：${formatDate(item.lastDate)} / 歷次購買 ${item.purchaseCount} 筆 / 平均間隔 ${item.avgCycleDays} 天 / 人員：${escapeHtml(item.owner || "-")} / 區域：${escapeHtml(item.area || "-")}
        </p>
      `).join("")}
    </article>
  `).join("");
}

function getReminderItems() {
  const selectedMonth = reminderMonth.value || todayMonthString();
  const selectedOwner = reminderOwnerFilter.value.trim().toLowerCase();

  const grouped = new Map();
  for (const row of dedupeReminderRows(dataset.rows)) {
    const key = `${row[COLUMN_CUSTOMER]}__${row[COLUMN_PRODUCT]}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.values())
    .map((rows) => rows.sort((a, b) => new Date(a[COLUMN_DATE]) - new Date(b[COLUMN_DATE])))
    .filter((rows) => rows.length >= 2)
    .map((rows) => buildReminderItem(rows, selectedMonth))
    .filter(Boolean)
    .filter((item) => !selectedOwner || String(item.owner || "").toLowerCase().includes(selectedOwner))
    .sort((a, b) => {
      if (a.expectedMonth !== b.expectedMonth) return a.expectedMonth.localeCompare(b.expectedMonth);
      return a.customer.localeCompare(b.customer, "zh-Hant");
    });
}

function getGroupedReminderItems() {
  const items = getReminderItems();
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.customer)) grouped.set(item.customer, { customer: item.customer, items: [] });
    grouped.get(item.customer).items.push(item);
  }
  return Array.from(grouped.values()).sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant"));
}

function dedupeReminderRows(rows) {
  const map = new Map();
  for (const row of rows.filter((item) => Number(item[COLUMN_QTY] || 0) >= 0)) {
    const key = `${row[COLUMN_CUSTOMER]}__${row[COLUMN_PRODUCT]}__${row[COLUMN_DATE]}`;
    if (!map.has(key) || Number(row[COLUMN_AMOUNT] || 0) > Number(map.get(key)[COLUMN_AMOUNT] || 0)) {
      map.set(key, row);
    }
  }
  return Array.from(map.values());
}

function buildReminderItem(rows, selectedMonth) {
  const intervals = [];
  for (let index = 1; index < rows.length; index += 1) {
    intervals.push(diffInDays(rows[index - 1][COLUMN_DATE], rows[index][COLUMN_DATE]));
  }
  if (!intervals.length) return null;

  const avgCycleDays = Math.max(1, Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length));
  const avgCycleMonths = Math.max(1, Math.round(avgCycleDays / 30.44));
  const last = rows[rows.length - 1];
  const expectedDate = addDays(last[COLUMN_DATE], avgCycleDays);
  const expectedMonth = expectedDate.slice(0, 7);
  if (expectedMonth > selectedMonth) return null;

  const statusMonthDiff = diffInMonths(expectedMonth, selectedMonth);
  if (statusMonthDiff > MAX_OVERDUE_MONTHS) return null;

  return {
    customer: last[COLUMN_CUSTOMER],
    product: last[COLUMN_PRODUCT],
    purchaseCount: rows.length,
    avgCycleDays,
    avgCycleMonths,
    expectedMonth,
    lastDate: last[COLUMN_DATE],
    owner: last[COLUMN_OWNER],
    area: last[COLUMN_AREA],
    badgeClass: statusMonthDiff > 0 ? "danger" : "warn",
    statusLabel: statusMonthDiff > 0 ? `逾期 ${statusMonthDiff} 個月` : "本月提醒",
  };
}

function renderRecords() {
  if (!currentUser) {
    recordsTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">登入後即可查詢銷售紀錄。</div></td></tr>';
    return;
  }

  const hasQuery =
    Boolean(startDateFilter.value) ||
    Boolean(endDateFilter.value) ||
    Boolean(customerFilter.value.trim()) ||
    Boolean(productFilter.value.trim()) ||
    Boolean(ownerFilter.value.trim()) ||
    Boolean(areaFilter.value.trim());

  if (!hasQuery) {
    recordsTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">請先輸入任一查詢條件，再顯示銷售紀錄。</div></td></tr>';
    return;
  }

  const rows = getFilteredRows();
  if (!rows.length) {
    recordsTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">查無符合條件的資料。</div></td></tr>';
    return;
  }

  recordsTableBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${formatDate(row[COLUMN_DATE])}</td>
      <td>${escapeHtml(row[COLUMN_CUSTOMER])}</td>
      <td>${escapeHtml(row[COLUMN_PRODUCT])}</td>
      <td>${formatNumber(row[COLUMN_QTY])}</td>
      <td>${formatNumber(row[COLUMN_PRICE])}</td>
      <td>${formatCurrency(row[COLUMN_AMOUNT])}</td>
      <td>${escapeHtml(row[COLUMN_OWNER])}</td>
      <td>${escapeHtml(row[COLUMN_AREA])}</td>
    </tr>
  `).join("");
}

function getFilteredRows() {
  const customerKeyword = customerFilter.value.trim().toLowerCase();
  const productKeyword = productFilter.value.trim().toLowerCase();
  const ownerKeyword = ownerFilter.value.trim().toLowerCase();
  const areaKeyword = areaFilter.value.trim().toLowerCase();

  return [...dataset.rows]
    .filter((row) => !startDateFilter.value || row[COLUMN_DATE] >= startDateFilter.value)
    .filter((row) => !endDateFilter.value || row[COLUMN_DATE] <= endDateFilter.value)
    .filter((row) => !customerKeyword || String(row[COLUMN_CUSTOMER] || "").toLowerCase().includes(customerKeyword))
    .filter((row) => !productKeyword || String(row[COLUMN_PRODUCT] || "").toLowerCase().includes(productKeyword))
    .filter((row) => !ownerKeyword || String(row[COLUMN_OWNER] || "").toLowerCase().includes(ownerKeyword))
    .filter((row) => !areaKeyword || String(row[COLUMN_AREA] || "").toLowerCase().includes(areaKeyword))
    .sort((a, b) => new Date(b[COLUMN_DATE]) - new Date(a[COLUMN_DATE]));
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + Number(days || 0));
  return toIsoDate(date);
}

function diffInDays(fromDate, toDate) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function diffInMonths(fromMonth, toMonth) {
  const [fromYear, fromMon] = fromMonth.split("-").map(Number);
  const [toYear, toMon] = toMonth.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMon - fromMon);
}

function todayMonthString() {
  return toIsoDate(new Date()).slice(0, 7);
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateString));
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
