const STORAGE_KEY = "sales-reminder-raw-v2";
const COLUMN_DATE = "日期";
const COLUMN_CUSTOMER = "客戶全稱";
const COLUMN_PRODUCT = "品名規格";
const COLUMN_QTY = "數量";
const COLUMN_PRICE = "原幣單價";
const COLUMN_AMOUNT = "總額";
const COLUMN_OWNER = "人員姓名";
const COLUMN_AREA = "區域名稱";

const seedRows = [
  {
    [COLUMN_DATE]: "2025-05-05",
    [COLUMN_CUSTOMER]: "典安大藥局",
    [COLUMN_PRODUCT]: "亞眠靚長效錠2毫克",
    [COLUMN_QTY]: "10",
    [COLUMN_PRICE]: "900",
    [COLUMN_AMOUNT]: "9000",
    [COLUMN_OWNER]: "石修愷",
    [COLUMN_AREA]: "南屯區",
  },
  {
    [COLUMN_DATE]: "2025-07-14",
    [COLUMN_CUSTOMER]: "典安大藥局",
    [COLUMN_PRODUCT]: "亞眠靚長效錠2毫克",
    [COLUMN_QTY]: "8",
    [COLUMN_PRICE]: "900",
    [COLUMN_AMOUNT]: "7200",
    [COLUMN_OWNER]: "石修愷",
    [COLUMN_AREA]: "南屯區",
  },
  {
    [COLUMN_DATE]: "2025-09-23",
    [COLUMN_CUSTOMER]: "典安大藥局",
    [COLUMN_PRODUCT]: "亞眠靚長效錠2毫克",
    [COLUMN_QTY]: "12",
    [COLUMN_PRICE]: "900",
    [COLUMN_AMOUNT]: "10800",
    [COLUMN_OWNER]: "石修愷",
    [COLUMN_AREA]: "南屯區",
  },
  {
    [COLUMN_DATE]: "2025-08-03",
    [COLUMN_CUSTOMER]: "佳成生技股份有限公司",
    [COLUMN_PRODUCT]: "葉黃素膠囊",
    [COLUMN_QTY]: "10",
    [COLUMN_PRICE]: "500",
    [COLUMN_AMOUNT]: "5000",
    [COLUMN_OWNER]: "林佳穎",
    [COLUMN_AREA]: "西屯區",
  },
];

let state = loadState();

const excelInput = document.querySelector("#excelInput");
const importStatus = document.querySelector("#importStatus");

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

initialize();

function initialize() {
  reminderMonth.value = todayMonthString();
  bindEvents();
  syncFilterOptions();
  render();
}

function bindEvents() {
  excelInput.addEventListener("change", importExcelFile);

  [reminderMonth, reminderOwnerFilter].forEach((element) => {
    element.addEventListener("input", renderReminders);
    element.addEventListener("change", renderReminders);
  });

  [startDateFilter, endDateFilter, customerFilter, productFilter, ownerFilter, areaFilter].forEach((element) => {
    element.addEventListener("input", renderRecords);
    element.addEventListener("change", renderRecords);
  });
}

async function importExcelFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  let rows = [];
  if (file.name.toLowerCase().endsWith(".csv")) {
    rows = parseCsv(await file.text());
  } else {
    if (!window.XLSX) {
      importStatus.textContent = "Excel 模組尚未載入，請確認網路可連線，或先改匯入 CSV。";
      excelInput.value = "";
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  const normalized = rows
    .map(normalizeRawRow)
    .filter((row) => row[COLUMN_DATE] && row[COLUMN_CUSTOMER] && row[COLUMN_PRODUCT]);

  state = {
    sourceLabel: file.name,
    rows: normalized,
  };

  persist();
  render();
  importStatus.textContent = `已匯入 ${file.name}，共 ${state.rows.length} 筆銷售明細。`;
  excelInput.value = "";
}

function normalizeRawRow(row) {
  const mapped = {
    [COLUMN_DATE]: pickValue(row, ["日期", "date"]),
    [COLUMN_CUSTOMER]: pickValue(row, ["客戶全稱", "客戶名稱", "客戶", "customer"]),
    [COLUMN_PRODUCT]: pickValue(row, ["品名規格", "品名", "商品名稱", "product"]),
    [COLUMN_QTY]: pickValue(row, ["數量", "qty", "quantity"]),
    [COLUMN_PRICE]: pickValue(row, ["原幣單價", "單價", "price"]),
    [COLUMN_AMOUNT]: pickValue(row, ["總額", "amount", "原幣金額"]),
    [COLUMN_OWNER]: pickValue(row, ["人員姓名", "業務", "sales", "owner"]),
    [COLUMN_AREA]: pickValue(row, ["區域名稱", "區域", "area", "region"]),
  };

  return {
    ...mapped,
    [COLUMN_DATE]: normalizeDate(mapped[COLUMN_DATE]),
    [COLUMN_QTY]: toNumberString(mapped[COLUMN_QTY]),
    [COLUMN_PRICE]: toNumberString(mapped[COLUMN_PRICE]),
    [COLUMN_AMOUNT]: toNumberString(mapped[COLUMN_AMOUNT]),
  };
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function syncFilterOptions() {}

function render() {
  renderReminders();
  renderRecords();
}

function renderReminders() {
  const customerGroups = getGroupedReminderItems();
  if (!customerGroups.length) {
    reminderList.innerHTML = '<div class="empty-state">該月份目前沒有符合條件的重複回購提醒。</div>';
    return;
  }

  reminderList.innerHTML = customerGroups.map((group) => `
    <article class="reminder-card">
      <h3>${escapeHtml(group.customer)}</h3>
      <p class="muted">本月需注意 ${group.items.length} 個重複回購品項</p>
      ${group.items.map((item) => `
        <div class="meta-row" style="margin-top:10px;">
          <span class="pill ${item.badgeClass}">${item.statusLabel}</span>
          <span class="pill">${escapeHtml(item.product)}</span>
          <span class="pill">平均週期：約 ${item.avgCycleMonths} 個月</span>
          <span class="pill">應回購月：${item.expectedMonth}</span>
        </div>
        <p class="muted" style="margin-top:8px;">
          最近購買：${formatDate(item.lastDate)} / 歷次購買：${item.purchaseCount} 次 / 平均間隔：${item.avgCycleDays} 天 / 業務：${escapeHtml(item.owner || "-")} / 區域：${escapeHtml(item.area || "-")}
        </p>
      `).join("")}
    </article>
  `).join("");
}

function getReminderItems() {
  const selectedMonth = reminderMonth.value || todayMonthString();
  const selectedOwner = reminderOwnerFilter.value.trim().toLowerCase();

  const grouped = new Map();
  for (const row of dedupeReminderRows(state.rows)) {
    const key = `${row[COLUMN_CUSTOMER]}__${row[COLUMN_PRODUCT]}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return Array.from(grouped.values())
    .map((rows) => rows.sort((a, b) => new Date(a[COLUMN_DATE]) - new Date(b[COLUMN_DATE])))
    .filter((rows) => rows.length >= 2)
    .map((rows) => buildReminderItem(rows, selectedMonth))
    .filter(Boolean)
    .filter((item) => !selectedOwner || item.owner.toLowerCase().includes(selectedOwner))
    .sort((a, b) => {
      if (a.expectedMonth !== b.expectedMonth) return a.expectedMonth.localeCompare(b.expectedMonth);
      return a.customer.localeCompare(b.customer, "zh-Hant");
    });
}

function getGroupedReminderItems() {
  const items = getReminderItems();
  const grouped = new Map();

  for (const item of items) {
    if (!grouped.has(item.customer)) {
      grouped.set(item.customer, {
        customer: item.customer,
        items: [],
      });
    }
    grouped.get(item.customer).items.push(item);
  }

  return Array.from(grouped.values()).sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant"));
}

function dedupeReminderRows(rows) {
  const map = new Map();

  for (const row of rows.filter((item) => Number(item[COLUMN_QTY] || 0) >= 0)) {
    const key = `${row[COLUMN_CUSTOMER]}__${row[COLUMN_PRODUCT]}__${row[COLUMN_DATE]}`;
    if (!map.has(key)) {
      map.set(key, row);
      continue;
    }

    const existing = map.get(key);
    if (Number(row[COLUMN_AMOUNT] || 0) > Number(existing[COLUMN_AMOUNT] || 0)) {
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
  if (statusMonthDiff > 12) return null;

  let badgeClass = "warn";
  let statusLabel = "本月應回購";

  if (statusMonthDiff > 0) {
    badgeClass = "danger";
    statusLabel = `已逾期 ${statusMonthDiff} 個月`;
  }

  return {
    customer: last[COLUMN_CUSTOMER],
    product: last[COLUMN_PRODUCT],
    purchaseCount: rows.length,
    avgCycleDays,
    avgCycleMonths,
    expectedDate,
    expectedMonth,
    lastDate: last[COLUMN_DATE],
    owner: last[COLUMN_OWNER],
    area: last[COLUMN_AREA],
    badgeClass,
    statusLabel,
  };
}

function renderRecords() {
  const hasQuery =
    Boolean(startDateFilter.value) ||
    Boolean(endDateFilter.value) ||
    Boolean(customerFilter.value.trim()) ||
    Boolean(productFilter.value.trim()) ||
    Boolean(ownerFilter.value.trim()) ||
    Boolean(areaFilter.value.trim());

  if (!hasQuery) {
    recordsTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">請先輸入查詢條件，再顯示銷售紀錄。</div></td></tr>';
    return;
  }

  const rows = getFilteredRows();
  if (!rows.length) {
    recordsTableBody.innerHTML = '<tr><td colspan="8"><div class="empty-state">查無符合條件的銷售紀錄。</div></td></tr>';
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

  return [...state.rows]
    .filter((row) => !startDateFilter.value || row[COLUMN_DATE] >= startDateFilter.value)
    .filter((row) => !endDateFilter.value || row[COLUMN_DATE] <= endDateFilter.value)
    .filter((row) => !customerKeyword || row[COLUMN_CUSTOMER].toLowerCase().includes(customerKeyword))
    .filter((row) => !productKeyword || row[COLUMN_PRODUCT].toLowerCase().includes(productKeyword))
    .filter((row) => !ownerKeyword || row[COLUMN_OWNER].toLowerCase().includes(ownerKeyword))
    .filter((row) => !areaKeyword || row[COLUMN_AREA].toLowerCase().includes(areaKeyword))
    .sort((a, b) => new Date(b[COLUMN_DATE]) - new Date(a[COLUMN_DATE]));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { sourceLabel: "示範資料", rows: structuredClone(seedRows) };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.rows)) return parsed;
  } catch (error) {
    console.warn("Failed to parse local data.", error);
  }
  return { sourceLabel: "示範資料", rows: structuredClone(seedRows) };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
    const [year, month, day] = value.split("/");
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 20000) {
    return excelSerialToDate(numeric);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toIsoDate(date);
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return toIsoDate(new Date(utcValue * 1000));
}

function toNumberString(value) {
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? String(number) : "0";
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

function todayString() {
  return toIsoDate(new Date());
}

function todayMonthString() {
  return todayString().slice(0, 7);
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
