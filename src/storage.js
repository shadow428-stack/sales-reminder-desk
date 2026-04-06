import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getFirestore } from "./firebase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "..", "data", "current-dataset.json");

const emptyDataset = {
  sourceLabel: "",
  importedAt: "",
  importedBy: "",
  rows: [],
};

const dataStore = (process.env.DATA_STORE || "firestore").trim().toLowerCase();
const firestoreCollection = process.env.FIRESTORE_COLLECTION || "appState";
const firestoreDocument = process.env.FIRESTORE_DATASET_DOC || "currentDataset";

function useFirestore() {
  return dataStore === "firestore";
}

function datasetDoc() {
  return getFirestore().collection(firestoreCollection).doc(firestoreDocument);
}

export async function ensureDataFile() {
  if (useFirestore()) {
    const doc = await datasetDoc().get();
    if (!doc.exists) {
      await datasetDoc().set(emptyDataset);
    }
    return;
  }

  try {
    await fs.access(dataPath);
  } catch {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(emptyDataset, null, 2), "utf-8");
  }
}

export async function readDataset() {
  await ensureDataFile();

  if (useFirestore()) {
    const doc = await datasetDoc().get();
    return doc.data() || emptyDataset;
  }

  const raw = await fs.readFile(dataPath, "utf-8");
  return JSON.parse(raw);
}

export async function writeDataset(dataset) {
  if (useFirestore()) {
    await datasetDoc().set(dataset);
    return;
  }

  await fs.writeFile(dataPath, JSON.stringify(dataset, null, 2), "utf-8");
}
