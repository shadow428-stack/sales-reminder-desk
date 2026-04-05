const COLUMN_DATE = "日期";
const COLUMN_CUSTOMER = "客戶全稱";
const COLUMN_PRODUCT = "品名規格";
const COLUMN_QTY = "數量";
const COLUMN_PRICE = "原幣單價";
const COLUMN_AMOUNT = "總額";
const COLUMN_OWNER = "人員姓名";
const COLUMN_AREA = "區域名稱";

export function normalizeImportedRows(rows) {
  return rows
    .map((row) => ({
      [COLUMN_DATE]: normalizeDate(pickValue(row, ["日期", "date"])),
      [COLUMN_CUSTOMER]: pickValue(row, ["客戶全稱", "客戶名稱", "客戶", "customer"]),
      [COLUMN_PRODUCT]: pickValue(row, ["品名規格", "品名", "商品名稱", "product"]),
      [COLUMN_QTY]: toNumberString(pickValue(row, ["數量", "qty", "quantity"])),
      [COLUMN_PRICE]: toNumberString(pickValue(row, ["原幣單價", "單價", "price"])),
      [COLUMN_AMOUNT]: toNumberString(pickValue(row, ["總額", "amount", "原幣金額"])),
      [COLUMN_OWNER]: pickValue(row, ["人員姓名", "業務", "sales", "owner"]),
      [COLUMN_AREA]: pickValue(row, ["區域名稱", "區域", "area", "region"]),
    }))
    .filter((row) => row[COLUMN_DATE] && row[COLUMN_CUSTOMER] && row[COLUMN_PRODUCT]);
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
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

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toNumberString(value) {
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? String(number) : "0";
}
