import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { verifyFirebaseToken, isAdminEmail, firebaseWebConfig } from "./src/firebase.js";
import { ensureDataFile, readDataset, writeDataset } from "./src/storage.js";
import { normalizeImportedRows } from "./src/transform.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 3000);

await ensureDataFile();

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  },
}));

app.get("/api/config", (_req, res) => {
  res.json({
    firebase: firebaseWebConfig(),
  });
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/api/session", authenticate, (req, res) => {
  res.json({
    email: req.user.email,
    role: req.user.role,
  });
});

app.get("/api/data", authenticate, async (_req, res) => {
  const dataset = await readDataset();
  res.json(dataset);
});

app.post("/api/import", authenticate, requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "請選擇要匯入的 Excel 或 CSV 檔案。" });
    return;
  }

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const rows = normalizeImportedRows(rawRows);
  const dataset = {
    sourceLabel: req.file.originalname,
    importedAt: new Date().toISOString(),
    importedBy: req.user.email,
    rows,
  };

  await writeDataset(dataset);
  res.json({
    message: `已匯入 ${req.file.originalname}，共 ${rows.length} 筆銷售明細。`,
    dataset,
  });
});

app.get("*", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Sales Reminder Desk running on http://localhost:${port}`);
});

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      res.status(401).json({ message: "缺少登入憑證。" });
      return;
    }

    const decoded = await verifyFirebaseToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || "",
      role: isAdminEmail(decoded.email) ? "admin" : "viewer",
    };
    next();
  } catch (error) {
    res.status(401).json({ message: "登入驗證失敗。", detail: error.message });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "只有管理者可以匯入資料。" });
    return;
  }
  next();
}
