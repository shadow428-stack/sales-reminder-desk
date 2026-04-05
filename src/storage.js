import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "..", "data", "current-dataset.json");

const emptyDataset = {
  sourceLabel: "",
  importedAt: "",
  importedBy: "",
  rows: [],
};

export async function ensureDataFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(emptyDataset, null, 2), "utf-8");
  }
}

export async function readDataset() {
  await ensureDataFile();
  const raw = await fs.readFile(dataPath, "utf-8");
  return JSON.parse(raw);
}

export async function writeDataset(dataset) {
  await fs.writeFile(dataPath, JSON.stringify(dataset, null, 2), "utf-8");
}
