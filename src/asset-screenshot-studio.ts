import { ASSETS } from "./assets";
import { AssetPreviewRenderer } from "./asset-preview-runtime";

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <style>
    :root {
      color-scheme: dark;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    }
    * { box-sizing: border-box; }
    html, body, #app { margin: 0; min-height: 100%; }
    body {
      background:
        radial-gradient(circle at top, rgba(82, 103, 120, 0.14), transparent 24%),
        #0d1114;
      color: #edf1f7;
    }
    .studio {
      display: grid;
      grid-template-columns: 340px minmax(0, 1fr);
      min-height: 100vh;
    }
    .controls {
      display: grid;
      align-content: start;
      gap: 12px;
      padding: 14px;
      border-right: 1px solid #242c33;
      background: #14191e;
    }
    .panel {
      padding: 10px;
      border: 1px solid #273038;
      background: #101419;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #d8e0e7;
    }
    .grid {
      display: grid;
      gap: 8px;
    }
    label {
      display: grid;
      gap: 4px;
      font-size: 12px;
      color: #aeb9c4;
    }
    input, select, button, textarea {
      font: inherit;
    }
    input, select, textarea {
      width: 100%;
      padding: 7px 8px;
      border: 1px solid #303841;
      background: #0d1216;
      color: #edf1f7;
    }
    button {
      padding: 8px 10px;
      border: 1px solid #35516b;
      background: #173047;
      color: #d7ebff;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .secondary {
      border-color: #3a434d;
      background: #1b2228;
      color: #d6dde4;
    }
    .preview {
      position: relative;
      min-height: 0;
    }
    #previewCanvas {
      display: block;
      width: 100%;
      height: 100vh;
    }
    .status {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: #b5c0ca;
    }
    .list {
      max-height: 220px;
      overflow: auto;
      border: 1px solid #273038;
      background: #0d1216;
      padding: 8px;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
  <section class="studio">
    <aside class="controls">
      <div class="panel">
        <h2>Batch</h2>
        <div class="grid">
          <label>Save mode
            <select id="saveMode">
              <option value="picked" selected>Project Preview Folder</option>
            </select>
          </label>
          <label>Source
            <select id="sourceMode">
              <option value="catalog">Current catalog</option>
              <option value="manifest">Manifest URL</option>
            </select>
          </label>
          <label>Manifest URL
            <input id="manifestUrl" value="/generated/asset-screenshot-manifest.json" />
          </label>
          <label>Asset base path
            <input id="basePath" value="/assets/glTF/" />
          </label>
          <label>Width
            <input id="width" type="number" min="128" step="64" value="1024" />
          </label>
          <label>Height
            <input id="height" type="number" min="128" step="64" value="1024" />
          </label>
          <label>Limit
            <input id="limit" type="number" min="0" step="1" value="0" />
          </label>
          <button id="pickDirectory" class="secondary">Pick Project Preview Folder</button>
          <button id="startBatch">Render Screenshots</button>
        </div>
      </div>
      <div class="panel">
        <h2>Status</h2>
        <div class="status" id="statusText">
          <span>Output folder: not selected</span>
          <span>Pick <code>public/generated/asset-previews</code> to save app-ready screenshots.</span>
        </div>
      </div>
      <div class="panel">
        <h2>Queue</h2>
        <div class="list" id="queueLog"></div>
      </div>
    </aside>
    <main class="preview">
      <canvas id="previewCanvas"></canvas>
    </main>
  </section>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#previewCanvas");
const saveMode = document.querySelector<HTMLSelectElement>("#saveMode");
const sourceMode = document.querySelector<HTMLSelectElement>("#sourceMode");
const manifestUrl = document.querySelector<HTMLInputElement>("#manifestUrl");
const basePathInput = document.querySelector<HTMLInputElement>("#basePath");
const widthInput = document.querySelector<HTMLInputElement>("#width");
const heightInput = document.querySelector<HTMLInputElement>("#height");
const limitInput = document.querySelector<HTMLInputElement>("#limit");
const pickDirectoryButton = document.querySelector<HTMLButtonElement>("#pickDirectory");
const startBatchButton = document.querySelector<HTMLButtonElement>("#startBatch");
const statusText = document.querySelector<HTMLDivElement>("#statusText");
const queueLog = document.querySelector<HTMLDivElement>("#queueLog");

if (
  !canvas ||
  !saveMode ||
  !sourceMode ||
  !manifestUrl ||
  !basePathInput ||
  !widthInput ||
  !heightInput ||
  !limitInput ||
  !pickDirectoryButton ||
  !startBatchButton ||
  !statusText ||
  !queueLog
) {
  throw new Error("Screenshot studio UI is incomplete.");
}

const renderer = new AssetPreviewRenderer(canvas, "dark");
let outputDirectory: FileSystemDirectoryHandle | null = null;

function setStatus(...lines: string[]) {
  statusText.innerHTML = lines.map((line) => `<span>${line}</span>`).join("");
}

function logLine(line: string) {
  queueLog.textContent = `${queueLog.textContent}${queueLog.textContent ? "\n" : ""}${line}`;
  queueLog.scrollTop = queueLog.scrollHeight;
}

async function getFiles() {
  if (sourceMode.value === "manifest") {
    const response = await fetch(manifestUrl.value);
    if (!response.ok) {
      throw new Error(`Could not load manifest: ${manifestUrl.value}`);
    }

    const manifest = await response.json();
    const files = Array.isArray(manifest) ? manifest : manifest.files;
    if (!Array.isArray(files)) {
      throw new Error("Manifest must be an array of filenames or an object with a files array.");
    }
    return files as string[];
  }

  return [...new Set(ASSETS.map((asset) => asset.fileName))];
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function jsonBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
}

pickDirectoryButton.addEventListener("click", async () => {
  const targetWindow = window as DirectoryPickerWindow;
  if (!targetWindow.showDirectoryPicker) {
    setStatus("Output folder: unsupported", "Use a Chromium browser with File System Access support.");
    return;
  }

  outputDirectory = await targetWindow.showDirectoryPicker();
  setStatus(`Output folder: ${outputDirectory.name}`, "Ready.");
});

saveMode.addEventListener("change", () => {
  pickDirectoryButton.disabled = saveMode.value !== "picked";
  setStatus(
    outputDirectory ? `Output folder: ${outputDirectory.name}` : "Output folder: not selected",
    outputDirectory ? "Ready." : "Pick public/generated/asset-previews to save app-ready screenshots.",
  );
});

startBatchButton.addEventListener("click", async () => {
  if (saveMode.value === "picked" && !outputDirectory) {
    setStatus("Output folder: not selected", "Pick an output folder first.");
    return;
  }

  startBatchButton.disabled = true;
  queueLog.textContent = "";

  try {
    const files = await getFiles();
    const limit = Number(limitInput.value || "0");
    const selectedFiles = limit > 0 ? files.slice(0, limit) : files;
    const width = Number(widthInput.value || "1024");
    const height = Number(heightInput.value || "1024");
    const basePath = basePathInput.value;
    const relations: Array<{ gltf: string; png: string }> = [];

    setStatus(
      outputDirectory ? `Output folder: ${outputDirectory.name}` : "Output folder: not selected",
      `Rendering ${selectedFiles.length} asset screenshots...`,
    );

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      logLine(`[${index + 1}/${selectedFiles.length}] ${file}`);
      await renderer.loadAsset(file, basePath);
      const dataUrl = await renderer.capture(width, height, 4);
      const blob = dataUrlToBlob(dataUrl);
      const pngFileName = `${file.replace(/\.[^.]+$/, "")}.png`;
      const fileHandle = await outputDirectory.getFileHandle(pngFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      relations.push({ gltf: file, png: pngFileName });
    }

    const relationFileHandle = await outputDirectory.getFileHandle("asset-preview-relations.json", { create: true });
    const relationWritable = await relationFileHandle.createWritable();
    await relationWritable.write(
      jsonBlob({
        generatedAt: new Date().toISOString(),
        basePath,
        files: relations,
      }),
    );
    await relationWritable.close();

    setStatus(
      outputDirectory ? `Output folder: ${outputDirectory.name}` : "Output folder: not selected",
      `Completed ${selectedFiles.length} screenshots and wrote asset-preview-relations.json.`,
    );
  } catch (error) {
    setStatus(
      outputDirectory ? `Output folder: ${outputDirectory.name}` : "Output folder: not selected",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    startBatchButton.disabled = false;
  }
});

pickDirectoryButton.disabled = saveMode.value !== "picked";
setStatus("Output folder: not selected", "Pick public/generated/asset-previews to save app-ready screenshots.");
