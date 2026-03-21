import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const HISTORY_PATH = path.join(ROOT, "public", "generated", "library-history.json");

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

function writeHistory(entries) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2) + "\n");
}

export function appendLibraryHistory(entry) {
  const entries = loadHistory();
  entries.unshift({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  writeHistory(entries.slice(0, 500));
}

export { HISTORY_PATH };
