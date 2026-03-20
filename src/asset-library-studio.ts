import {
  getAssetLibraryBundles,
  getAssetThumbnailUrlForLibrary,
  type AssetCategory,
  type AssetDefinition,
  type AssetLibraryMeta,
} from "./assets";
import builtInTagTemplatesManifest from "./data/libraries/built-in/asset-tag-templates.json";
import roofStarterTagTemplatesManifest from "./data/libraries/roof-starter/asset-tag-templates.json";
import JSZip from "jszip";

type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  };

interface AssetLibraryManifest {
  version: 1;
  assets: AssetDefinition[];
}

interface AssetTagTemplateManifest {
  version: 1;
  categories: Partial<Record<AssetCategory, string[]>>;
}

interface AssetCategoryManifest {
  version: 1;
  categories: string[];
}

interface ZipGltfInspection {
  gltfPath: string;
  referencedFiles: string[];
  missingFiles: string[];
  externalUris: string[];
  collidingFiles: string[];
  parseError?: string;
}

interface ZipInspectionResult {
  zipFileName: string;
  totalFiles: number;
  gltfFiles: number;
  reports: ZipGltfInspection[];
}

interface DraftLibraryPackage {
  libraryMeta: AssetLibraryMeta;
  categories: AssetCategoryManifest;
  tagTemplates: AssetTagTemplateManifest;
  manifest: AssetLibraryManifest;
  inspection: ZipInspectionResult;
}

interface StudioLibraryState {
  id: string;
  name: string;
  workingManifest: AssetLibraryManifest;
  originalManifest: AssetLibraryManifest;
  workingCategories: string[];
  originalCategories: string[];
  workingTagTemplates: AssetTagTemplateManifest;
  originalTagTemplates: AssetTagTemplateManifest;
}

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
    html, body, #app { margin: 0; height: 100%; }
    body {
      overflow: hidden;
      background:
        radial-gradient(circle at top, rgba(82, 103, 120, 0.14), transparent 24%),
        #0d1114;
      color: #edf1f7;
    }
    .studio {
      display: grid;
      grid-template-columns: 340px minmax(0, 1fr);
      height: 100vh;
      overflow: hidden;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border-right: 1px solid #242c33;
      background: #14191e;
      min-height: 0;
      overflow: auto;
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
    .asset-list {
      flex: 0 0 320px;
      overflow: auto;
      min-height: 240px;
      border: 1px solid #273038;
      background: #0d1216;
    }
    .asset-row {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-bottom: 1px solid #1d252c;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .asset-row:hover {
      background: #151d24;
    }
    .asset-row.is-active {
      background: #1a2834;
    }
    .asset-thumb {
      width: 42px;
      height: 42px;
      border: 1px solid #273038;
      background: #0c1014 center / cover no-repeat;
    }
    .asset-title {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .asset-meta {
      margin-top: 4px;
      font-size: 11px;
      color: #98a6b4;
    }
    .editor {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 12px;
      padding: 14px;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .toolbar button {
      padding: 8px 10px;
      border: 1px solid #35516b;
      background: #173047;
      color: #d7ebff;
      cursor: pointer;
    }
    .toolbar button.secondary {
      border-color: #3a434d;
      background: #1b2228;
      color: #d6dde4;
    }
    .status {
      font-size: 12px;
      color: #b5c0ca;
    }
    .status-list {
      display: grid;
      gap: 4px;
    }
    .status-list strong {
      color: #edf1f7;
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 14px;
      min-height: 0;
      align-items: start;
      overflow: auto;
    }
    .form {
      display: grid;
      gap: 10px;
      min-height: 0;
      align-content: start;
    }
    label {
      display: grid;
      gap: 4px;
      font-size: 12px;
      color: #aeb9c4;
    }
    input, select, textarea {
      width: 100%;
      padding: 7px 8px;
      border: 1px solid #303841;
      background: #0d1216;
      color: #edf1f7;
      font: inherit;
    }
    textarea {
      min-height: 88px;
      resize: vertical;
    }
    .readonly {
      opacity: 0.8;
    }
    .preview-card {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .preview-image {
      width: 100%;
      aspect-ratio: 1;
      border: 1px solid #273038;
      background: #0d1216 center / contain no-repeat;
    }
    .swatch {
      width: 100%;
      height: 24px;
      border: 1px solid #273038;
    }
    .kv {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: #aeb9c4;
    }
    .kv strong {
      color: #edf1f7;
    }
    .issues {
      display: grid;
      gap: 6px;
      padding: 8px 10px;
      border: 1px solid #2e3942;
      background: #11171d;
      font-size: 12px;
      color: #b9c4cf;
    }
    .issues strong {
      color: #edf1f7;
    }
    .issues.is-warning {
      border-color: #80622d;
      background: rgba(94, 68, 17, 0.18);
    }
    .issues.is-ok {
      border-color: #2c5942;
      background: rgba(25, 78, 46, 0.16);
    }
    .issue-list {
      display: grid;
      gap: 4px;
    }
    .summary-list {
      display: grid;
      gap: 4px;
    }
    .batch-panel {
      display: grid;
      gap: 8px;
    }
    .inline-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    .inline-row button {
      padding: 7px 10px;
      border: 1px solid #3a434d;
      background: #1b2228;
      color: #d6dde4;
      cursor: pointer;
      white-space: nowrap;
    }
    .muted {
      color: #8ea0b1;
    }
    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 4px 8px;
      border: 1px solid #35516b;
      background: #173047;
      color: #d7ebff;
      font-size: 11px;
      cursor: pointer;
    }
    .chip.secondary {
      border-color: #3a434d;
      background: #1b2228;
      color: #d6dde4;
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dropzone {
      display: grid;
      gap: 6px;
      justify-items: center;
      padding: 14px;
      border: 1px dashed #46627d;
      background: rgba(23, 48, 71, 0.2);
      color: #d7ebff;
      text-align: center;
      cursor: pointer;
    }
    .dropzone.is-active {
      border-color: #78a7d6;
      background: rgba(40, 86, 127, 0.28);
    }
    .mono {
      font-family: Consolas, "Courier New", monospace;
      word-break: break-word;
    }
    .dropzone-actions {
      display: flex;
      justify-content: center;
    }
  </style>
  <section class="studio">
    <aside class="sidebar">
      <div class="panel">
        <h2>Library</h2>
        <div class="grid">
          <label>Library
            <select id="librarySelect"></select>
          </label>
          <label>Search
            <input id="assetSearch" placeholder="Search name, file, tags" />
          </label>
          <label>Category
            <select id="categoryFilter"></select>
          </label>
        </div>
      </div>
      <div class="panel batch-panel">
        <h2>Categories</h2>
        <label>Existing Category
          <select id="manageCategory"></select>
        </label>
        <label>New Category
          <div class="inline-row">
            <input id="newCategoryName" placeholder="Add category" />
            <button type="button" id="addCategory">Add</button>
          </div>
        </label>
        <div class="action-row">
          <button type="button" id="removeCategory">Remove Selected Category</button>
          <button type="button" id="saveCategories">Save Categories</button>
          <button type="button" id="downloadCategories">Download JSON</button>
        </div>
      </div>
      <div class="panel batch-panel">
        <h2>Pack Import</h2>
        <div class="dropzone" id="zipDropzone" tabindex="0">
          <strong>Drop GLTF Pack ZIP Here</strong>
          <span class="muted">or click to choose a .zip file for inspection</span>
        </div>
        <div class="dropzone-actions">
          <button type="button" id="uploadZipButton">Upload ZIP</button>
        </div>
        <label>Draft Library ID
          <input id="draftLibraryId" placeholder="new-library-id" />
        </label>
        <label>Draft Library Name
          <input id="draftLibraryName" placeholder="New Library" />
        </label>
        <label>Default Category
          <select id="draftLibraryCategory"></select>
        </label>
        <div class="dropzone-actions">
          <button type="button" id="downloadDraftLibraryButton">Download Draft Library ZIP</button>
        </div>
        <input id="zipFileInput" type="file" accept=".zip,application/zip" hidden />
        <div class="status" id="zipReport">No zip inspected yet.</div>
      </div>
      <div class="panel batch-panel">
        <h2>Filtered Assets</h2>
        <label>Set Category
          <div class="inline-row">
            <select id="batchCategory"></select>
            <button type="button" id="applyBatchCategory">Apply</button>
          </div>
        </label>
        <label>Add Tag
          <div class="inline-row">
            <input id="batchTag" placeholder="Tag for shown assets" list="tagSuggestions" />
            <button type="button" id="applyBatchTag">Add</button>
          </div>
        </label>
        <label>Show
          <select id="quickFilter">
            <option value="all">All Filtered Assets</option>
            <option value="missing-tags">Only Missing Tags</option>
            <option value="duplicate-names">Only Duplicate Names</option>
            <option value="duplicate-tags">Only Duplicate Tags</option>
          </select>
        </label>
      </div>
      <div class="panel batch-panel">
        <h2>Tag Cleanup</h2>
        <label>Replace Tag
          <select id="renameFromTag"></select>
        </label>
        <label>With
          <div class="inline-row">
            <input id="renameToTag" placeholder="Existing or new tag" list="tagSuggestions" />
            <button type="button" id="applyRenameTag">Merge</button>
          </div>
        </label>
      </div>
      <div class="panel batch-panel">
        <h2>Category Templates</h2>
        <label>Category
          <select id="templateCategory"></select>
        </label>
        <label>Curated Tags
          <textarea id="templateTags" placeholder="Comma-separated template tags"></textarea>
        </label>
        <div class="action-row">
          <button type="button" id="promoteSelectedTags">Promote Selected Tags</button>
          <button type="button" id="promoteFilteredTags">Promote Filtered Tags</button>
        </div>
        <div class="inline-row">
          <button type="button" id="saveTemplates">Save Templates</button>
          <button type="button" id="downloadTemplates">Download JSON</button>
        </div>
        <div class="issues" id="templateIssues"></div>
      </div>
      <div class="panel">
        <h2>Info</h2>
        <div class="status" id="libraryStatus"></div>
      </div>
      <div class="panel">
        <h2>Consistency</h2>
        <div class="status" id="tagReport"></div>
      </div>
      <div class="asset-list" id="assetList"></div>
    </aside>
    <main class="editor">
      <div class="toolbar">
        <button type="button" id="saveManifest">Save Manifest</button>
        <button type="button" class="secondary" id="downloadManifest">Download JSON</button>
        <button type="button" class="secondary" id="resetChanges">Reset Changes</button>
        <span class="status" id="saveStatus"></span>
      </div>
      <div class="workspace">
        <section class="panel form">
          <h2>Asset Metadata</h2>
          <div class="issues" id="assetIssues"></div>
          <label>Name
            <input id="assetName" />
          </label>
          <label>Category
            <select id="assetCategory"></select>
          </label>
          <label>Tags
            <textarea id="assetTags" placeholder="Comma-separated tags"></textarea>
          </label>
          <label class="readonly">Asset File
            <input id="assetFileName" readonly />
          </label>
          <label class="readonly">Thumbnail File
            <input id="assetThumbnailFileName" readonly />
          </label>
          <div class="issues" id="templatePanel"></div>
        </section>
        <aside class="panel preview-card">
          <h2>Preview</h2>
          <div class="preview-image" id="assetPreview"></div>
          <div class="swatch" id="assetSwatch"></div>
          <div class="kv" id="assetSummary"></div>
        </aside>
      </div>
    </main>
  </section>
  <datalist id="tagSuggestions"></datalist>
`;

const assetSearch = document.querySelector<HTMLInputElement>("#assetSearch");
const librarySelect = document.querySelector<HTMLSelectElement>("#librarySelect");
const categoryFilter = document.querySelector<HTMLSelectElement>("#categoryFilter");
const assetList = document.querySelector<HTMLDivElement>("#assetList");
const libraryStatus = document.querySelector<HTMLDivElement>("#libraryStatus");
const tagReport = document.querySelector<HTMLDivElement>("#tagReport");
const zipDropzone = document.querySelector<HTMLDivElement>("#zipDropzone");
const uploadZipButton = document.querySelector<HTMLButtonElement>("#uploadZipButton");
const draftLibraryIdInput = document.querySelector<HTMLInputElement>("#draftLibraryId");
const draftLibraryNameInput = document.querySelector<HTMLInputElement>("#draftLibraryName");
const draftLibraryCategoryInput = document.querySelector<HTMLSelectElement>("#draftLibraryCategory");
const downloadDraftLibraryButton = document.querySelector<HTMLButtonElement>("#downloadDraftLibraryButton");
const zipFileInput = document.querySelector<HTMLInputElement>("#zipFileInput");
const zipReport = document.querySelector<HTMLDivElement>("#zipReport");
const manageCategoryInput = document.querySelector<HTMLSelectElement>("#manageCategory");
const newCategoryNameInput = document.querySelector<HTMLInputElement>("#newCategoryName");
const addCategoryButton = document.querySelector<HTMLButtonElement>("#addCategory");
const removeCategoryButton = document.querySelector<HTMLButtonElement>("#removeCategory");
const saveCategoriesButton = document.querySelector<HTMLButtonElement>("#saveCategories");
const downloadCategoriesButton = document.querySelector<HTMLButtonElement>("#downloadCategories");
const batchCategoryInput = document.querySelector<HTMLSelectElement>("#batchCategory");
const applyBatchCategoryButton = document.querySelector<HTMLButtonElement>("#applyBatchCategory");
const batchTagInput = document.querySelector<HTMLInputElement>("#batchTag");
const applyBatchTagButton = document.querySelector<HTMLButtonElement>("#applyBatchTag");
const quickFilterInput = document.querySelector<HTMLSelectElement>("#quickFilter");
const renameFromTagInput = document.querySelector<HTMLSelectElement>("#renameFromTag");
const renameToTagInput = document.querySelector<HTMLInputElement>("#renameToTag");
const applyRenameTagButton = document.querySelector<HTMLButtonElement>("#applyRenameTag");
const templateCategoryInput = document.querySelector<HTMLSelectElement>("#templateCategory");
const templateTagsInput = document.querySelector<HTMLTextAreaElement>("#templateTags");
const promoteSelectedTagsButton = document.querySelector<HTMLButtonElement>("#promoteSelectedTags");
const promoteFilteredTagsButton = document.querySelector<HTMLButtonElement>("#promoteFilteredTags");
const saveTemplatesButton = document.querySelector<HTMLButtonElement>("#saveTemplates");
const downloadTemplatesButton = document.querySelector<HTMLButtonElement>("#downloadTemplates");
const templateIssues = document.querySelector<HTMLDivElement>("#templateIssues");
const saveStatus = document.querySelector<HTMLSpanElement>("#saveStatus");
const saveManifestButton = document.querySelector<HTMLButtonElement>("#saveManifest");
const downloadManifestButton = document.querySelector<HTMLButtonElement>("#downloadManifest");
const resetChangesButton = document.querySelector<HTMLButtonElement>("#resetChanges");
const assetNameInput = document.querySelector<HTMLInputElement>("#assetName");
const assetCategoryInput = document.querySelector<HTMLSelectElement>("#assetCategory");
const assetTagsInput = document.querySelector<HTMLTextAreaElement>("#assetTags");
const assetFileNameInput = document.querySelector<HTMLInputElement>("#assetFileName");
const assetThumbnailFileNameInput = document.querySelector<HTMLInputElement>("#assetThumbnailFileName");
const assetPreview = document.querySelector<HTMLDivElement>("#assetPreview");
const assetSwatch = document.querySelector<HTMLDivElement>("#assetSwatch");
const assetSummary = document.querySelector<HTMLDivElement>("#assetSummary");
const assetIssues = document.querySelector<HTMLDivElement>("#assetIssues");
const templatePanel = document.querySelector<HTMLDivElement>("#templatePanel");
const tagSuggestions = document.querySelector<HTMLDataListElement>("#tagSuggestions");

if (
  !librarySelect ||
  !assetSearch ||
  !categoryFilter ||
  !assetList ||
  !libraryStatus ||
  !tagReport ||
  !zipDropzone ||
  !uploadZipButton ||
  !draftLibraryIdInput ||
  !draftLibraryNameInput ||
  !draftLibraryCategoryInput ||
  !downloadDraftLibraryButton ||
  !zipFileInput ||
  !zipReport ||
  !manageCategoryInput ||
  !newCategoryNameInput ||
  !addCategoryButton ||
  !removeCategoryButton ||
  !saveCategoriesButton ||
  !downloadCategoriesButton ||
  !batchCategoryInput ||
  !applyBatchCategoryButton ||
  !batchTagInput ||
  !applyBatchTagButton ||
  !quickFilterInput ||
  !renameFromTagInput ||
  !renameToTagInput ||
  !applyRenameTagButton ||
  !templateCategoryInput ||
  !templateTagsInput ||
  !promoteSelectedTagsButton ||
  !promoteFilteredTagsButton ||
  !saveTemplatesButton ||
  !downloadTemplatesButton ||
  !templateIssues ||
  !saveStatus ||
  !saveManifestButton ||
  !downloadManifestButton ||
  !resetChangesButton ||
  !assetNameInput ||
  !assetCategoryInput ||
  !assetTagsInput ||
  !assetFileNameInput ||
  !assetThumbnailFileNameInput ||
  !assetPreview ||
  !assetSwatch ||
  !assetSummary ||
  !assetIssues ||
  !templatePanel ||
  !tagSuggestions
) {
  throw new Error("Asset library studio UI is incomplete.");
}

const libraryBundles = getAssetLibraryBundles();
const libraryTemplateManifests: Record<string, unknown> = {
  "built-in": builtInTagTemplatesManifest,
  "roof-starter": roofStarterTagTemplatesManifest,
};

function parseAssetCategoryManifest(value: unknown): AssetCategoryManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Asset category manifest must be an object.");
  }

  const candidate = value as Partial<AssetCategoryManifest>;
  if (candidate.version !== 1 || !Array.isArray(candidate.categories)) {
    throw new Error("Asset category manifest must include version 1 and a categories array.");
  }

  const categories = candidate.categories
    .map((category) => (typeof category === "string" ? category.trim() : ""))
    .filter(Boolean);

  if (categories.length === 0) {
    throw new Error("Asset category manifest must contain at least one category.");
  }

  const seenCategories = new Set<string>();
  categories.forEach((category) => {
    if (seenCategories.has(category)) {
      throw new Error(`Asset category manifest contains a duplicate category: ${category}`);
    }
    seenCategories.add(category);
  });

  return {
    version: 1,
    categories,
  };
}

function parseAssetTagTemplateManifest(value: unknown, categories: string[]): AssetTagTemplateManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Asset tag template manifest must be an object.");
  }

  const candidate = value as Partial<AssetTagTemplateManifest>;
  if (candidate.version !== 1 || !candidate.categories || typeof candidate.categories !== "object") {
    throw new Error("Asset tag template manifest must include version 1 and a categories object.");
  }

  const parsedCategories: Partial<Record<AssetCategory, string[]>> = {};
  categories.forEach((category) => {
    const tags = candidate.categories?.[category];
    if (!tags) {
      return;
    }
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
      throw new Error(`Asset tag template manifest contains invalid tags for ${category}.`);
    }
    parsedCategories[category] = tags;
  });

  return {
    version: 1,
    categories: parsedCategories,
  };
}

function cloneAsset(asset: AssetDefinition): AssetDefinition {
  return {
    ...asset,
    tags: [...asset.tags],
    placeholder: {
      ...asset.placeholder,
      size: [...asset.placeholder.size] as [number, number, number],
    },
  };
}

function createStudioLibraryState(bundle: (typeof libraryBundles)[number]): StudioLibraryState {
  const originalManifest: AssetLibraryManifest = {
    version: 1,
    assets: bundle.assets.map(cloneAsset),
  };
  const originalCategories = [...bundle.categories];
  const originalTagTemplates = parseAssetTagTemplateManifest(
    libraryTemplateManifests[bundle.library.id] ?? { version: 1, categories: {} },
    originalCategories,
  );

  return {
    id: bundle.library.id,
    name: bundle.meta.name,
    originalManifest,
    workingManifest: structuredClone(originalManifest),
    originalCategories,
    workingCategories: [...originalCategories],
    originalTagTemplates,
    workingTagTemplates: {
      version: 1,
      categories: Object.fromEntries(
        originalCategories.map((category) => [category, [...(originalTagTemplates.categories[category] ?? [])]]),
      ) as Partial<Record<AssetCategory, string[]>>,
    },
  };
}

const libraryStates = new Map<string, StudioLibraryState>(
  libraryBundles.map((bundle) => [bundle.library.id, createStudioLibraryState(bundle)]),
);

let selectedLibraryId = libraryBundles[0]?.library.id ?? "built-in";
let lastZipInspection: ZipInspectionResult | null = null;
let originalManifest = libraryStates.get(selectedLibraryId)!.originalManifest;
let originalCategoryManifest: AssetCategoryManifest = {
  version: 1,
  categories: [...libraryStates.get(selectedLibraryId)!.originalCategories],
};
let curatedTagTemplates = libraryStates.get(selectedLibraryId)!.originalTagTemplates;
let workingCategories = libraryStates.get(selectedLibraryId)!.workingCategories;
let workingTagTemplates = libraryStates.get(selectedLibraryId)!.workingTagTemplates;
let workingManifest = libraryStates.get(selectedLibraryId)!.workingManifest;
let selectedAssetId = workingManifest.assets[0]?.id ?? null;

function applyLibraryState(libraryId: string) {
  const nextState = libraryStates.get(libraryId);
  if (!nextState) {
    return;
  }

  selectedLibraryId = libraryId;
  originalManifest = nextState.originalManifest;
  originalCategoryManifest = {
    version: 1,
    categories: [...nextState.originalCategories],
  };
  curatedTagTemplates = nextState.originalTagTemplates;
  workingManifest = nextState.workingManifest;
  workingCategories = nextState.workingCategories;
  workingTagTemplates = nextState.workingTagTemplates;
  selectedAssetId = workingManifest.assets[0]?.id ?? null;
}

function populateCategorySelect(select: HTMLSelectElement, includeAll = false) {
  const options = includeAll ? ["All", ...workingCategories] : [...workingCategories];
  select.innerHTML = options.map((value) => `<option value="${value}">${value}</option>`).join("");
}

librarySelect.innerHTML = libraryBundles
  .map((bundle) => `<option value="${bundle.library.id}">${bundle.meta.name}</option>`)
  .join("");
librarySelect.value = selectedLibraryId;
populateCategorySelect(categoryFilter, true);
populateCategorySelect(assetCategoryInput, false);
populateCategorySelect(batchCategoryInput, false);
populateCategorySelect(templateCategoryInput, false);
populateCategorySelect(manageCategoryInput, false);
populateCategorySelect(draftLibraryCategoryInput, false);
categoryFilter.value = "All";
templateCategoryInput.value = workingCategories[0];
manageCategoryInput.value = workingCategories[0];
draftLibraryCategoryInput.value = workingCategories[0];

function getThumbnailUrl(asset: AssetDefinition) {
  return getAssetThumbnailUrlForLibrary(selectedLibraryId, asset.thumbnailFileName);
}

function getFilteredAssets() {
  const query = assetSearch.value.trim().toLowerCase();
  const category = categoryFilter.value as AssetCategory | "All";
  const quickFilter = quickFilterInput.value;
  const diagnostics = getLibraryDiagnostics();
  const duplicateNameKeys = new Set<string>();

  workingManifest.assets.forEach((asset) => {
    const normalizedName = normalizeNameKey(asset.name);
    if (!normalizedName) {
      return;
    }
    const sameNameCount = workingManifest.assets.filter(
      (candidate) => normalizeNameKey(candidate.name) === normalizedName,
    ).length;
    if (sameNameCount > 1) {
      duplicateNameKeys.add(normalizedName);
    }
  });

  return workingManifest.assets.filter((asset) => {
    const matchesCategory = category === "All" || asset.category === category;
    const haystack = `${asset.name} ${asset.fileName} ${asset.tags.join(" ")}`.toLowerCase();
    const matchesQuery = query.length === 0 || haystack.includes(query);
    const matchesQuickFilter =
      quickFilter === "all" ||
      (quickFilter === "missing-tags" && asset.tags.length === 0) ||
      (quickFilter === "duplicate-names" && duplicateNameKeys.has(normalizeNameKey(asset.name))) ||
      (quickFilter === "duplicate-tags" && diagnostics.duplicateTagAssetIds.has(asset.id));
    return matchesCategory && matchesQuery && matchesQuickFilter;
  });
}

function setSaveStatus(message: string) {
  saveStatus.textContent = message;
}

function normalizeNameKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTagKey(value: string) {
  return value.trim().toLowerCase();
}

const TOKEN_SPLIT_PATTERN = /(?=[A-Z][a-z])|_|(?<=\d)(?=[A-Za-z])|(?<=[A-Za-z])(?=\d)/g;

function splitFileTokens(file: string) {
  return file
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter(Boolean);
}

function toLabel(file: string) {
  return splitFileTokens(file)
    .map((token) => {
      if (/^\d+x\d+$/i.test(token)) return token.toLowerCase();
      if (/^\d+$/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function toSlug(file: string) {
  return splitFileTokens(file)
    .map((token) => token.toLowerCase())
    .join("-");
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function placeholderFor(category: string, tags: string[]) {
  if (category === "Walls" || category === "Doors" || category === "Windows") {
    return {
      shape: "box" as const,
      size: [2, 2.5, 0.25] as [number, number, number],
      color: category === "Doors" ? "#a1887f" : "#8d6e63",
    };
  }
  if (category === "Floors") {
    return { shape: "box" as const, size: [2, 0.2, 2] as [number, number, number], color: "#546e7a" };
  }
  if (category === "Corners") {
    return { shape: "box" as const, size: [1.4, 2.4, 1.4] as [number, number, number], color: "#795548" };
  }
  if (category === "Roofs") {
    return { shape: "box" as const, size: [2.2, 0.6, 2.2] as [number, number, number], color: "#5d4037" };
  }
  if (category === "Stairs") {
    return { shape: "box" as const, size: [2, 1.4, 2] as [number, number, number], color: "#7b8d93" };
  }
  if (category === "Balconies") {
    return { shape: "box" as const, size: [2, 1.2, 1] as [number, number, number], color: "#607d8b" };
  }
  if (tags.includes("vine")) {
    return { shape: "column" as const, size: [0.5, 1.8, 0.5] as [number, number, number], color: "#689f38" };
  }
  return { shape: "box" as const, size: [1, 1, 1] as [number, number, number], color: "#8bc34a" };
}

function toTags(file: string, category: string) {
  const parts = splitFileTokens(file).map((token) => token.toLowerCase());
  const expanded = parts.flatMap((token) => {
    if (token === "wooddark") return ["wood", "dark"];
    if (token === "woodlight") return ["wood", "light"];
    if (token === "redbrick") return ["red", "brick"];
    if (token === "unevenbrick" || token === "unevenbricks") return ["uneven", "brick"];
    if (token === "roundtiles") return ["round", "tiles"];
    if (token === "roundtile") return ["round", "tile"];
    if (token === "wide" || token === "thin" || token === "flat" || token === "round") return [token];
    if (token === "l" || token === "r" || token === "u") return [token];
    if (token === "doorframe") return ["door", "frame"];
    if (token === "windowshutters") return ["window", "shutters"];
    if (token === "exteriorwide") return ["exterior", "wide"];
    if (token === "singleside") return ["single", "side"];
    if (token === "sideplatform") return ["side", "platform"];
    if (token === "nofirststep") return ["no", "first", "step"];
    if (token === "solidextended") return ["solid", "extended"];
    if (token === "roundinset") return ["round", "inset"];
    return [token];
  });

  return dedupe([category.toLowerCase(), ...expanded]);
}

function sanitizeLibraryId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.zip$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDisplayLibraryName(value: string) {
  const normalized = value.replace(/\.zip$/i, "").replace(/[_-]+/g, " ").trim();
  if (!normalized) {
    return "Imported Library";
  }
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildDraftLibraryPackage(inspection: ZipInspectionResult): DraftLibraryPackage {
  const draftLibraryId = sanitizeLibraryId(draftLibraryIdInput.value);
  const draftLibraryName = draftLibraryNameInput.value.trim();
  const defaultCategory = draftLibraryCategoryInput.value.trim();

  if (!draftLibraryId) {
    throw new Error("Enter a draft library id before downloading.");
  }
  if (!draftLibraryName) {
    throw new Error("Enter a draft library name before downloading.");
  }
  if (!defaultCategory) {
    throw new Error("Choose a default category for the draft library.");
  }

  const validReports = inspection.reports.filter(
    (report) =>
      !report.parseError &&
      report.missingFiles.length === 0 &&
      report.externalUris.length === 0 &&
      report.collidingFiles.length === 0,
  );

  if (validReports.length === 0) {
    throw new Error("No valid glTF assets are ready to become a draft library yet.");
  }

  const assetIds = new Set<string>();
  const assets = validReports.map((report) => {
    const baseName = (report.gltfPath.split("/").pop() ?? report.gltfPath).replace(/\.gltf$/i, "");
    const assetIdBase = toSlug(baseName) || "asset";
    let assetId = assetIdBase;
    let duplicateIndex = 2;
    while (assetIds.has(assetId)) {
      assetId = `${assetIdBase}-${duplicateIndex}`;
      duplicateIndex += 1;
    }
    assetIds.add(assetId);

    const tags = toTags(baseName, defaultCategory);
    return {
      id: assetId,
      name: toLabel(baseName),
      category: defaultCategory,
      fileName: `${baseName}.gltf`,
      thumbnailFileName: `${baseName}.png`,
      tags,
      placeholder: placeholderFor(defaultCategory, tags),
    } satisfies AssetDefinition;
  });

  return {
    libraryMeta: {
      version: 1,
      id: draftLibraryId,
      name: draftLibraryName,
      mode: "imported",
      description: `Draft imported library from ${inspection.zipFileName}.`,
      author: "",
      createdAt: new Date().toISOString(),
      assetManifest: "./assets-manifest.json",
      categories: "./asset-categories.json",
      tagTemplates: "./asset-tag-templates.json",
      assetBasePath: "./glTF/",
      thumbnailBasePath: "./thumbnails/",
    },
    categories: {
      version: 1,
      categories: [defaultCategory],
    },
    tagTemplates: {
      version: 1,
      categories: {
        [defaultCategory]: [],
      },
    },
    manifest: {
      version: 1,
      assets,
    },
    inspection,
  };
}

async function downloadDraftLibraryZip() {
  if (!lastZipInspection) {
    throw new Error("Inspect a GLTF pack zip before downloading a draft library.");
  }

  const draft = buildDraftLibraryPackage(lastZipInspection);
  const zip = new JSZip();
  zip.file("library.json", JSON.stringify(draft.libraryMeta, null, 2) + "\n");
  zip.file("assets-manifest.json", JSON.stringify(draft.manifest, null, 2) + "\n");
  zip.file("asset-categories.json", JSON.stringify(draft.categories, null, 2) + "\n");
  zip.file("asset-tag-templates.json", JSON.stringify(draft.tagTemplates, null, 2) + "\n");
  zip.file("inspection-report.json", JSON.stringify(draft.inspection, null, 2) + "\n");
  zip.file(
    "README.txt",
    [
      `Draft library: ${draft.libraryMeta.name} (${draft.libraryMeta.id})`,
      "",
      "This draft zip currently contains library metadata only.",
      "It does not copy the source glTF pack files yet.",
      "",
      "Next step:",
      "1. Keep the original asset pack zip/folder with the .gltf sidecars.",
      "2. Use this draft metadata as the starting point for a repo library.",
      "3. Categorize and tag assets in the library studio after the library files exist.",
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${draft.libraryMeta.id}-draft-library.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeZipPath(value: string) {
  const slashNormalized = value.replace(/\\/g, "/");
  const parts = slashNormalized.split("/");
  const normalizedParts: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      normalizedParts.pop();
      continue;
    }
    normalizedParts.push(part);
  }

  return normalizedParts.join("/");
}

function isExternalAssetUri(uri: string) {
  return uri.startsWith("data:") || /^[a-z]+:/iu.test(uri);
}

function resolveZipRelativePath(basePath: string, relativePath: string) {
  const baseParts = normalizeZipPath(basePath).split("/");
  baseParts.pop();
  return normalizeZipPath([...baseParts, relativePath].join("/"));
}

async function inspectZipFile(file: File) {
  const zip = await JSZip.loadAsync(file);
  const existingLibraryFiles = new Set(
    workingManifest.assets.flatMap((asset) => [asset.fileName, asset.thumbnailFileName]).map((entry) => entry.toLowerCase()),
  );
  const zipFilePaths = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => normalizeZipPath(entry.name));
  const zipFileSet = new Set(zipFilePaths);
  const gltfPaths = zipFilePaths.filter((entry) => entry.toLowerCase().endsWith(".gltf")).sort((left, right) => left.localeCompare(right));
  const reports: ZipGltfInspection[] = [];

  for (const gltfPath of gltfPaths) {
    const zipEntry = zip.file(gltfPath);
    if (!zipEntry) {
      continue;
    }

    try {
      const gltfText = await zipEntry.async("string");
      const gltf = JSON.parse(gltfText) as {
        buffers?: Array<{ uri?: string }>;
        images?: Array<{ uri?: string }>;
      };
      const referencedUris = [
        ...(Array.isArray(gltf.buffers) ? gltf.buffers.map((buffer) => buffer?.uri).filter((uri): uri is string => typeof uri === "string") : []),
        ...(Array.isArray(gltf.images) ? gltf.images.map((image) => image?.uri).filter((uri): uri is string => typeof uri === "string") : []),
      ];
      const externalUris = referencedUris.filter((uri) => isExternalAssetUri(uri));
      const referencedFiles = referencedUris
        .filter((uri) => !isExternalAssetUri(uri))
        .map((uri) => resolveZipRelativePath(gltfPath, uri));
      const missingFiles = referencedFiles.filter((resolvedPath) => !zipFileSet.has(resolvedPath));
      const collidingFiles = [gltfPath, ...referencedFiles]
        .map((entry) => entry.split("/").pop() ?? entry)
        .filter((entry, index, values) => values.indexOf(entry) === index)
        .filter((entry) => existingLibraryFiles.has(entry.toLowerCase()));

      reports.push({
        gltfPath,
        referencedFiles,
        missingFiles,
        externalUris,
        collidingFiles,
      });
    } catch (error) {
      reports.push({
        gltfPath,
        referencedFiles: [],
        missingFiles: [],
        externalUris: [],
        collidingFiles: [],
        parseError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    zipFileName: file.name,
    totalFiles: zipFilePaths.length,
    gltfFiles: gltfPaths.length,
    reports,
  } satisfies ZipInspectionResult;
}

function renderZipInspection(result: ZipInspectionResult) {
  const missingCount = result.reports.reduce((count, report) => count + report.missingFiles.length, 0);
  const parseErrorCount = result.reports.filter((report) => report.parseError).length;
  const collisionCount = result.reports.reduce((count, report) => count + report.collidingFiles.length, 0);
  const validCount = result.reports.filter(
    (report) =>
      !report.parseError &&
      report.missingFiles.length === 0 &&
      report.externalUris.length === 0 &&
      report.collidingFiles.length === 0,
  ).length;

  zipReport.innerHTML = `
    <div class="status-list">
      <span><strong>ZIP</strong> ${result.zipFileName}</span>
      <span><strong>Files</strong> ${result.totalFiles}</span>
      <span><strong>GLTF</strong> ${result.gltfFiles}</span>
      <span><strong>Draft Ready</strong> ${validCount}</span>
      <span><strong>Missing Sidecars</strong> ${missingCount}</span>
      <span><strong>Parse Errors</strong> ${parseErrorCount}</span>
      <span><strong>Name Collisions</strong> ${collisionCount}</span>
      ${result.reports
        .map((report) => {
          const details: string[] = [`<span class="mono"><strong>${report.gltfPath}</strong></span>`];
          if (report.parseError) {
            details.push(`<span>Parse error: ${report.parseError}</span>`);
          }
          if (report.missingFiles.length > 0) {
            details.push(`<span>Missing: ${report.missingFiles.map((entry) => `<span class="mono">${entry}</span>`).join(", ")}</span>`);
          }
          if (report.externalUris.length > 0) {
            details.push(`<span>External/data URIs: ${report.externalUris.map((entry) => `<span class="mono">${entry}</span>`).join(", ")}</span>`);
          }
          if (report.collidingFiles.length > 0) {
            details.push(`<span>Collides with current library file names: ${report.collidingFiles.map((entry) => `<span class="mono">${entry}</span>`).join(", ")}</span>`);
          }
          if (!report.parseError && report.missingFiles.length === 0 && report.externalUris.length === 0 && report.collidingFiles.length === 0) {
            details.push("<span>Looks self-contained inside the zip.</span>");
          }
          return `<div class="issues ${report.parseError || report.missingFiles.length > 0 ? "is-warning" : "is-ok"}">${details.join("")}</div>`;
        })
        .join("")}
    </div>
  `;
}

async function handleZipFile(file: File) {
  const isZip = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
  if (!isZip) {
    zipReport.textContent = "Please choose a .zip file.";
    setSaveStatus("ZIP inspection failed");
    return;
  }

  try {
    const result = await inspectZipFile(file);
    lastZipInspection = result;
    if (!draftLibraryIdInput.value.trim()) {
      draftLibraryIdInput.value = sanitizeLibraryId(file.name);
    }
    if (!draftLibraryNameInput.value.trim()) {
      draftLibraryNameInput.value = toDisplayLibraryName(file.name);
    }
    renderZipInspection(result);
    setSaveStatus("ZIP inspection complete");
  } catch (error) {
    lastZipInspection = null;
    zipReport.textContent = error instanceof Error ? error.message : String(error);
    setSaveStatus("ZIP inspection failed");
  } finally {
    zipFileInput.value = "";
    zipDropzone.classList.remove("is-active");
  }
}

function getLibraryDiagnostics() {
  const emptyNameCount = workingManifest.assets.filter((asset) => asset.name.trim().length === 0).length;
  const nameCounts = new Map<string, number>();
  const categoryCounts = new Map<AssetCategory, number>();
  const duplicateTagAssetIds = new Set<string>();
  const tagCounts = new Map<string, number>();

  workingCategories.forEach((category) => {
    categoryCounts.set(category, 0);
  });

  workingManifest.assets.forEach((asset) => {
    const normalizedName = normalizeNameKey(asset.name);
    if (normalizedName.length > 0) {
      nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
    }

    categoryCounts.set(asset.category, (categoryCounts.get(asset.category) ?? 0) + 1);

    const seenTags = new Set<string>();
    for (const tag of asset.tags) {
      const normalizedTag = normalizeTagKey(tag);
      if (normalizedTag.length === 0) {
        continue;
      }
      if (seenTags.has(normalizedTag)) {
        duplicateTagAssetIds.add(asset.id);
        break;
      }
      seenTags.add(normalizedTag);
      tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) ?? 0) + 1);
    }
  });

  const duplicateNameCount = Array.from(nameCounts.values()).filter((count) => count > 1).length;
  const uncategorizedCount = Array.from(categoryCounts.values()).filter((count) => count === 0).length;

  return {
    emptyNameCount,
    duplicateNameCount,
    duplicateTagAssetIds,
    categoryCounts,
    uncategorizedCount,
    tagCounts,
  };
}

function getSelectedAssetIssues(asset: AssetDefinition) {
  const issues: string[] = [];
  if (asset.name.trim().length === 0) {
    issues.push("Name is empty.");
  }

  const normalizedName = normalizeNameKey(asset.name);
  if (normalizedName.length > 0) {
    const duplicateNameAssets = workingManifest.assets.filter(
      (candidate) => candidate.id !== asset.id && normalizeNameKey(candidate.name) === normalizedName,
    );
    if (duplicateNameAssets.length > 0) {
      issues.push(`Name duplicates ${duplicateNameAssets.length} other asset${duplicateNameAssets.length === 1 ? "" : "s"}.`);
    }
  }

  const seenTags = new Set<string>();
  const duplicateTags = new Set<string>();
  for (const tag of asset.tags) {
    const normalizedTag = normalizeTagKey(tag);
    if (normalizedTag.length === 0) {
      continue;
    }
    if (seenTags.has(normalizedTag)) {
      duplicateTags.add(tag.trim());
    }
    seenTags.add(normalizedTag);
  }
  if (duplicateTags.size > 0) {
    issues.push(`Duplicate tags: ${Array.from(duplicateTags).join(", ")}.`);
  }

  if (asset.tags.length === 0) {
    issues.push("No tags yet.");
  }

  return issues;
}

function getCategoryTagPreset(category: AssetCategory, limit = 8) {
  const curatedTags = workingTagTemplates.categories[category]?.map((tag) => normalizeTagKey(tag)).filter(Boolean) ?? [];
  const tagCounts = new Map<string, number>();
  workingManifest.assets
    .filter((asset) => asset.category === category)
    .forEach((asset) => {
      const uniqueTags = new Set(asset.tags.map((tag) => normalizeTagKey(tag)).filter(Boolean));
      uniqueTags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      });
    });

  return Array.from(tagCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([tag]) => tag)
    .filter((tag) => !curatedTags.includes(tag))
    .reduce<string[]>((result, tag) => {
      if (result.length < limit) {
        result.push(tag);
      }
      return result;
    }, [...curatedTags].slice(0, limit));
}

function getTemplateDiagnostics() {
  const normalizedByCategory = new Map<AssetCategory, string[]>();
  const emptyCategories: AssetCategory[] = [];
  const overlapWarnings = new Map<AssetCategory, string[]>();

  workingCategories.forEach((category) => {
    const normalizedTags = (workingTagTemplates.categories[category] ?? [])
      .map((tag) => normalizeTagKey(tag))
      .filter(Boolean);
    normalizedByCategory.set(category, normalizedTags);
    if (normalizedTags.length === 0) {
      emptyCategories.push(category);
    }
  });

  workingCategories.forEach((category) => {
    const categoryTags = normalizedByCategory.get(category) ?? [];
    const overlaps: string[] = [];
    workingCategories.forEach((otherCategory) => {
      if (otherCategory === category) {
        return;
      }
      const otherTags = normalizedByCategory.get(otherCategory) ?? [];
      if (categoryTags.length === 0 || otherTags.length === 0) {
        return;
      }
      const sharedTags = categoryTags.filter((tag) => otherTags.includes(tag));
      if (sharedTags.length >= Math.min(2, categoryTags.length, otherTags.length)) {
        overlaps.push(`${otherCategory}: ${sharedTags.join(", ")}`);
      }
    });
    if (overlaps.length > 0) {
      overlapWarnings.set(category, overlaps);
    }
  });

  return {
    emptyCategories,
    overlapWarnings,
  };
}

function renderTemplateEditor() {
  const category = templateCategoryInput.value as AssetCategory;
  templateTagsInput.value = (workingTagTemplates.categories[category] ?? []).join(", ");
  const diagnostics = getTemplateDiagnostics();
  const overlaps = diagnostics.overlapWarnings.get(category) ?? [];
  const issues: string[] = [];

  if ((workingTagTemplates.categories[category] ?? []).length === 0) {
    issues.push("Template is empty.");
  }
  if (diagnostics.emptyCategories.length > 0) {
    issues.push(`Empty categories: ${diagnostics.emptyCategories.join(", ")}.`);
  }
  if (overlaps.length > 0) {
    issues.push(`Overlaps with: ${overlaps.join(" | ")}.`);
  }

  templateIssues.className = `issues ${issues.length === 0 ? "is-ok" : "is-warning"}`;
  templateIssues.innerHTML =
    issues.length === 0
      ? "<span><strong>Template Validation</strong> Looks good.</span>"
      : `<strong>Template Validation</strong><div class="issue-list">${issues.map((issue) => `<span>${issue}</span>`).join("")}</div>`;
}

function mergeTemplateTags(category: AssetCategory, tags: string[]) {
  const existingTags = workingTagTemplates.categories[category] ?? [];
  const seen = new Set(existingTags.map((tag) => normalizeTagKey(tag)));
  const merged = [...existingTags];

  tags.forEach((tag) => {
    const normalizedTag = normalizeTagKey(tag);
    if (!normalizedTag || seen.has(normalizedTag)) {
      return;
    }
    seen.add(normalizedTag);
    merged.push(tag.trim());
  });

  workingTagTemplates.categories[category] = merged;
}

function serializeTagTemplates() {
  return (
    JSON.stringify(
      {
        version: 1,
        categories: Object.fromEntries(
          workingCategories.map((category) => [category, workingTagTemplates.categories[category] ?? []]),
        ),
      },
      null,
      2,
    ) + "\n"
  );
}

function syncCategorySelects() {
  const previousCategoryFilter = categoryFilter.value;
  const previousAssetCategory = assetCategoryInput.value;
  const previousBatchCategory = batchCategoryInput.value;
  const previousTemplateCategory = templateCategoryInput.value;
  const previousManageCategory = manageCategoryInput.value;
  const previousDraftLibraryCategory = draftLibraryCategoryInput.value;

  populateCategorySelect(categoryFilter, true);
  populateCategorySelect(assetCategoryInput, false);
  populateCategorySelect(batchCategoryInput, false);
  populateCategorySelect(templateCategoryInput, false);
  populateCategorySelect(manageCategoryInput, false);
  populateCategorySelect(draftLibraryCategoryInput, false);

  categoryFilter.value = previousCategoryFilter === "All" || workingCategories.includes(previousCategoryFilter)
    ? previousCategoryFilter
    : "All";
  assetCategoryInput.value = workingCategories.includes(previousAssetCategory) ? previousAssetCategory : workingCategories[0] ?? "";
  batchCategoryInput.value = workingCategories.includes(previousBatchCategory) ? previousBatchCategory : workingCategories[0] ?? "";
  templateCategoryInput.value = workingCategories.includes(previousTemplateCategory) ? previousTemplateCategory : workingCategories[0] ?? "";
  manageCategoryInput.value = workingCategories.includes(previousManageCategory) ? previousManageCategory : workingCategories[0] ?? "";
  draftLibraryCategoryInput.value = workingCategories.includes(previousDraftLibraryCategory) ? previousDraftLibraryCategory : workingCategories[0] ?? "";
}

function ensureTemplateCategories() {
  workingCategories.forEach((category) => {
    workingTagTemplates.categories[category] ??= [];
  });

  Object.keys(workingTagTemplates.categories).forEach((category) => {
    if (!workingCategories.includes(category)) {
      delete workingTagTemplates.categories[category];
    }
  });
}

function serializeCategories() {
  return JSON.stringify({ version: 1, categories: workingCategories }, null, 2) + "\n";
}

async function saveCategories() {
  const targetWindow = window as SaveFilePickerWindow;
  if (targetWindow.showSaveFilePicker) {
    const handle = await targetWindow.showSaveFilePicker({
      suggestedName: `${selectedLibraryId}-asset-categories.json`,
      types: [
        {
          description: "JSON",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(serializeCategories());
    await writable.close();
    setSaveStatus("Categories saved");
    return;
  }

  downloadCategories();
  setSaveStatus("Categories downloaded");
}

function downloadCategories() {
  const blob = new Blob([serializeCategories()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${selectedLibraryId}-asset-categories.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function saveTagTemplates() {
  const targetWindow = window as SaveFilePickerWindow;
  if (targetWindow.showSaveFilePicker) {
    const handle = await targetWindow.showSaveFilePicker({
      suggestedName: `${selectedLibraryId}-asset-tag-templates.json`,
      types: [
        {
          description: "JSON",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(serializeTagTemplates());
    await writable.close();
    setSaveStatus("Templates saved");
    return;
  }

  downloadTagTemplates();
  setSaveStatus("Templates downloaded");
}

function downloadTagTemplates() {
  const blob = new Blob([serializeTagTemplates()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${selectedLibraryId}-asset-tag-templates.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderList() {
  const filteredAssets = getFilteredAssets();
  if (!selectedAssetId || !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
    selectedAssetId = filteredAssets[0]?.id ?? null;
  }

  assetList.innerHTML = filteredAssets
    .map((asset) => {
      const isActive = asset.id === selectedAssetId;
      return `
        <button type="button" class="asset-row${isActive ? " is-active" : ""}" data-asset-id="${asset.id}">
          <span class="asset-thumb" style="background-image:url('${getThumbnailUrl(asset)}')"></span>
          <span>
            <span class="asset-title">${asset.name}</span>
            <span class="asset-meta">${asset.category} | ${asset.fileName}</span>
          </span>
        </button>
      `;
    })
    .join("");

  const diagnostics = getLibraryDiagnostics();
  const categoryCoverage = workingCategories.map((category) => {
    const count = diagnostics.categoryCounts.get(category) ?? 0;
    return `<span><strong>${category}</strong> ${count}</span>`;
  }).join("");
  const singletonTags = Array.from(diagnostics.tagCounts.entries())
    .filter(([, count]) => count === 1)
    .map(([tag]) => tag)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 10);
  const topTags = Array.from(diagnostics.tagCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8);

  libraryStatus.innerHTML = `
    <div class="status-list">
      <span><strong>Total</strong> ${workingManifest.assets.length}</span>
      <span><strong>Shown</strong> ${filteredAssets.length}</span>
      <span><strong>Selected</strong> ${selectedAssetId ?? "None"}</span>
      <span><strong>Empty Names</strong> ${diagnostics.emptyNameCount}</span>
      <span><strong>Duplicate Names</strong> ${diagnostics.duplicateNameCount}</span>
      <span><strong>Assets With Duplicate Tags</strong> ${diagnostics.duplicateTagAssetIds.size}</span>
      <span><strong>Empty Categories</strong> ${diagnostics.uncategorizedCount}</span>
      <div class="summary-list">${categoryCoverage}</div>
    </div>
  `;
  tagReport.innerHTML = `
    <div class="status-list">
      <span><strong>Unique Tags</strong> ${diagnostics.tagCounts.size}</span>
      <span><strong>Singleton Tags</strong> ${Array.from(diagnostics.tagCounts.values()).filter((count) => count === 1).length}</span>
      <span><strong>Top Tags</strong> ${topTags.length > 0 ? topTags.map(([tag, count]) => `${tag} (${count})`).join(", ") : "None"}</span>
      <span><strong>Review First</strong> ${singletonTags.length > 0 ? singletonTags.join(", ") : "None"}</span>
      <span class="muted">Singleton tags often reveal wording drift.</span>
    </div>
  `;
  const tagOptions = Array.from(diagnostics.tagCounts.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([tag, count]) => `<option value="${tag}">${tag} (${count})</option>`)
    .join("");
  const previousRenameFromTag = renameFromTagInput.value;
  renameFromTagInput.innerHTML = tagOptions;
  if (previousRenameFromTag && diagnostics.tagCounts.has(previousRenameFromTag)) {
    renameFromTagInput.value = previousRenameFromTag;
  }
  tagSuggestions.innerHTML = Array.from(diagnostics.tagCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([tag]) => `<option value="${tag}"></option>`)
    .join("");

  assetList.querySelectorAll<HTMLButtonElement>("[data-asset-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedAssetId = button.dataset.assetId ?? null;
      renderList();
      renderEditor();
    });
  });
}

function getSelectedAsset() {
  return workingManifest.assets.find((asset) => asset.id === selectedAssetId) ?? null;
}

function renderEditor() {
  const asset = getSelectedAsset();
  if (!asset) {
    assetNameInput.value = "";
    assetCategoryInput.value = workingCategories[0] ?? "";
    assetTagsInput.value = "";
    assetFileNameInput.value = "";
    assetThumbnailFileNameInput.value = "";
    assetPreview.style.backgroundImage = "";
    assetSwatch.style.background = "transparent";
    assetSummary.innerHTML = "<span>No asset selected.</span>";
    assetIssues.className = "issues";
    assetIssues.innerHTML = "<span>Select an asset to review validation.</span>";
    templatePanel.className = "issues";
    templatePanel.innerHTML = "<span>Choose an asset to see category tag templates.</span>";
    return;
  }

  assetNameInput.value = asset.name;
  assetCategoryInput.value = asset.category;
  assetTagsInput.value = asset.tags.join(", ");
  assetFileNameInput.value = asset.fileName;
  assetThumbnailFileNameInput.value = asset.thumbnailFileName;
  assetPreview.style.backgroundImage = `url('${getThumbnailUrl(asset)}')`;
  assetSwatch.style.background = asset.placeholder.color;
  const issues = getSelectedAssetIssues(asset);
  assetIssues.className = `issues ${issues.length === 0 ? "is-ok" : "is-warning"}`;
  assetIssues.innerHTML =
    issues.length === 0
      ? "<span><strong>Validation</strong> Looks good.</span>"
      : `<strong>Validation</strong><div class="issue-list">${issues.map((issue) => `<span>${issue}</span>`).join("")}</div>`;
  const presetTags = getCategoryTagPreset(asset.category);
  templatePanel.className = `issues ${presetTags.length === 0 ? "" : "is-ok"}`;
  templatePanel.innerHTML = `
    <strong>Category Template</strong>
    <span>${asset.category}</span>
    <div class="chip-list">
      ${presetTags.length > 0 ? presetTags.map((tag) => `<button type="button" class="chip secondary" data-template-tag="${tag}">${tag}</button>`).join("") : "<span class='muted'>No common tags for this category yet.</span>"}
    </div>
    <div class="chip-list">
      <button type="button" class="chip" id="applyTemplateToSelected">Apply To Selected</button>
      <button type="button" class="chip secondary" id="applyTemplateToFiltered">Apply To Filtered</button>
    </div>
  `;
  assetSummary.innerHTML = [
    `<span><strong>ID</strong> ${asset.id}</span>`,
    `<span><strong>Placeholder</strong> ${asset.placeholder.shape} ${asset.placeholder.size.join(" x ")}</span>`,
    `<span><strong>Tags</strong> ${asset.tags.join(", ") || "None"}</span>`,
  ].join("");

  templatePanel.querySelectorAll<HTMLButtonElement>("[data-template-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.templateTag?.trim();
      if (!tag) {
        return;
      }
      const nextTags = assetTagsInput.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const existing = new Set(nextTags.map((value) => normalizeTagKey(value)));
      if (!existing.has(normalizeTagKey(tag))) {
        nextTags.push(tag);
        assetTagsInput.value = nextTags.join(", ");
        assetTagsInput.dispatchEvent(new Event("input"));
      }
    });
  });

  templatePanel.querySelector<HTMLButtonElement>("#applyTemplateToSelected")?.addEventListener("click", () => {
    updateSelectedAsset((selectedAsset) => {
      const existingTags = new Set(selectedAsset.tags.map((tag) => normalizeTagKey(tag)));
      selectedAsset.tags = [...selectedAsset.tags, ...presetTags.filter((tag) => !existingTags.has(normalizeTagKey(tag)))];
    });
  });

  templatePanel.querySelector<HTMLButtonElement>("#applyTemplateToFiltered")?.addEventListener("click", () => {
    updateFilteredAssets((filteredAsset) => {
      if (filteredAsset.category !== asset.category) {
        return;
      }
      const existingTags = new Set(filteredAsset.tags.map((tag) => normalizeTagKey(tag)));
      filteredAsset.tags = [...filteredAsset.tags, ...presetTags.filter((tag) => !existingTags.has(normalizeTagKey(tag)))];
    });
  });
}

function updateFilteredAssets(mutator: (asset: AssetDefinition) => void) {
  const filteredAssets = getFilteredAssets();
  if (filteredAssets.length === 0) {
    setSaveStatus("No filtered assets to update");
    return;
  }

  filteredAssets.forEach((asset) => {
    mutator(asset);
  });

  renderList();
  renderEditor();
  setSaveStatus(`Updated ${filteredAssets.length} filtered asset${filteredAssets.length === 1 ? "" : "s"}`);
}

function updateSelectedAsset(mutator: (asset: AssetDefinition) => void) {
  const asset = getSelectedAsset();
  if (!asset) {
    return;
  }

  mutator(asset);
  renderList();
  renderEditor();
  setSaveStatus("Unsaved changes");
}

function serializeManifest() {
  return JSON.stringify(workingManifest, null, 2) + "\n";
}

async function saveManifest() {
  const targetWindow = window as SaveFilePickerWindow;
  if (targetWindow.showSaveFilePicker) {
    const handle = await targetWindow.showSaveFilePicker({
      suggestedName: `${selectedLibraryId}-assets-manifest.json`,
      types: [
        {
          description: "JSON",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(serializeManifest());
    await writable.close();
    setSaveStatus("Manifest saved");
    return;
  }

  downloadManifest();
  setSaveStatus("Manifest downloaded");
}

function downloadManifest() {
  const blob = new Blob([serializeManifest()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${selectedLibraryId}-assets-manifest.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

assetSearch.addEventListener("input", () => {
  renderList();
});

librarySelect.addEventListener("change", () => {
  applyLibraryState(librarySelect.value);
  syncCategorySelects();
  renderList();
  renderEditor();
  renderTemplateEditor();
  setSaveStatus(`Switched to ${libraryStates.get(selectedLibraryId)?.name ?? selectedLibraryId}`);
});

zipDropzone.addEventListener("click", () => {
  zipFileInput.click();
});

uploadZipButton.addEventListener("click", () => {
  zipFileInput.click();
});

downloadDraftLibraryButton.addEventListener("click", () => {
  void downloadDraftLibraryZip()
    .then(() => {
      setSaveStatus("Draft library ZIP downloaded");
    })
    .catch((error) => {
      setSaveStatus("Draft library ZIP failed");
      zipReport.textContent = error instanceof Error ? error.message : String(error);
    });
});

zipDropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    zipFileInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  zipDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    zipDropzone.classList.add("is-active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  zipDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (eventName === "drop") {
      const files = (event as DragEvent).dataTransfer?.files;
      const file = files?.[0];
      if (!file) {
        zipDropzone.classList.remove("is-active");
        return;
      }
      void handleZipFile(file);
      return;
    }
    zipDropzone.classList.remove("is-active");
  });
});

zipFileInput.addEventListener("change", () => {
  const file = zipFileInput.files?.[0];
  if (!file) {
    return;
  }

  void handleZipFile(file);
});

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
  });
});

categoryFilter.addEventListener("change", () => {
  renderList();
});

quickFilterInput.addEventListener("change", () => {
  renderList();
  renderEditor();
});

assetNameInput.addEventListener("input", () => {
  updateSelectedAsset((asset) => {
    asset.name = assetNameInput.value.trim();
  });
});

templateCategoryInput.addEventListener("change", () => {
  renderTemplateEditor();
});

addCategoryButton.addEventListener("click", () => {
  const nextCategory = newCategoryNameInput.value.trim();
  if (!nextCategory) {
    setSaveStatus("Enter a category name");
    return;
  }
  if (workingCategories.includes(nextCategory)) {
    setSaveStatus("Category already exists");
    return;
  }

  workingCategories = [...workingCategories, nextCategory];
  libraryStates.get(selectedLibraryId)!.workingCategories = workingCategories;
  workingTagTemplates.categories[nextCategory] = [];
  syncCategorySelects();
  manageCategoryInput.value = nextCategory;
  templateCategoryInput.value = nextCategory;
  newCategoryNameInput.value = "";
  renderList();
  renderEditor();
  renderTemplateEditor();
  setSaveStatus("Category added");
});

removeCategoryButton.addEventListener("click", () => {
  const category = manageCategoryInput.value;
  if (!category) {
    setSaveStatus("Choose a category to remove");
    return;
  }

  const usedCount = workingManifest.assets.filter((asset) => asset.category === category).length;
  if (usedCount > 0) {
    setSaveStatus(`Cannot remove category while ${usedCount} asset${usedCount === 1 ? "" : "s"} still use it`);
    return;
  }

  if (workingCategories.length <= 1) {
    setSaveStatus("At least one category must remain");
    return;
  }

  workingCategories = workingCategories.filter((entry) => entry !== category);
  libraryStates.get(selectedLibraryId)!.workingCategories = workingCategories;
  delete workingTagTemplates.categories[category];
  syncCategorySelects();
  renderList();
  renderEditor();
  renderTemplateEditor();
  setSaveStatus("Category removed");
});

templateTagsInput.addEventListener("input", () => {
  const category = templateCategoryInput.value as AssetCategory;
  const nextTags = templateTagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, values) => values.findIndex((candidate) => normalizeTagKey(candidate) === normalizeTagKey(tag)) === index);
  workingTagTemplates.categories[category] = nextTags;
  renderEditor();
  setSaveStatus("Unsaved template changes");
});

promoteSelectedTagsButton.addEventListener("click", () => {
  const asset = getSelectedAsset();
  if (!asset) {
    setSaveStatus("Select an asset to promote tags");
    return;
  }

  const category = templateCategoryInput.value as AssetCategory;
  if (asset.category !== category) {
    setSaveStatus("Selected asset category does not match the template category");
    return;
  }

  mergeTemplateTags(category, asset.tags);
  renderTemplateEditor();
  renderEditor();
  setSaveStatus("Promoted selected asset tags into the template");
});

promoteFilteredTagsButton.addEventListener("click", () => {
  const category = templateCategoryInput.value as AssetCategory;
  const filteredAssets = getFilteredAssets().filter((asset) => asset.category === category);
  if (filteredAssets.length === 0) {
    setSaveStatus("No filtered assets match the template category");
    return;
  }

  filteredAssets.forEach((asset) => {
    mergeTemplateTags(category, asset.tags);
  });

  renderTemplateEditor();
  renderEditor();
  setSaveStatus(`Promoted tags from ${filteredAssets.length} filtered asset${filteredAssets.length === 1 ? "" : "s"}`);
});

assetCategoryInput.addEventListener("change", () => {
  updateSelectedAsset((asset) => {
    asset.category = assetCategoryInput.value as AssetCategory;
  });
});

assetTagsInput.addEventListener("input", () => {
  updateSelectedAsset((asset) => {
    asset.tags = assetTagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  });
});

applyBatchCategoryButton.addEventListener("click", () => {
  updateFilteredAssets((asset) => {
    asset.category = batchCategoryInput.value as AssetCategory;
  });
});

applyBatchTagButton.addEventListener("click", () => {
  const tag = batchTagInput.value.trim();
  if (!tag) {
    setSaveStatus("Enter a tag to add");
    return;
  }

  updateFilteredAssets((asset) => {
    const existingTags = new Set(asset.tags.map((value) => normalizeTagKey(value)));
    if (!existingTags.has(normalizeTagKey(tag))) {
      asset.tags = [...asset.tags, tag];
    }
  });
  batchTagInput.value = "";
});

applyRenameTagButton.addEventListener("click", () => {
  const fromTag = normalizeTagKey(renameFromTagInput.value);
  const toTag = renameToTagInput.value.trim();
  const normalizedToTag = normalizeTagKey(toTag);

  if (!fromTag) {
    setSaveStatus("Choose a source tag to replace");
    return;
  }

  if (!normalizedToTag) {
    setSaveStatus("Enter a replacement tag");
    return;
  }

  if (fromTag === normalizedToTag) {
    setSaveStatus("Source and replacement tags are the same");
    return;
  }

  let updatedCount = 0;
  workingManifest.assets.forEach((asset) => {
    const nextTags: string[] = [];
    const seenTags = new Set<string>();
    let changed = false;

    asset.tags.forEach((tag) => {
      const normalizedTag = normalizeTagKey(tag);
      const finalTag = normalizedTag === fromTag ? toTag : tag.trim();
      const normalizedFinalTag = normalizeTagKey(finalTag);
      if (!normalizedFinalTag) {
        return;
      }
      if (normalizedTag === fromTag) {
        changed = true;
      }
      if (!seenTags.has(normalizedFinalTag)) {
        seenTags.add(normalizedFinalTag);
        nextTags.push(finalTag);
      }
    });

    if (changed) {
      asset.tags = nextTags;
      updatedCount += 1;
    }
  });

  renderList();
  renderEditor();
  renameToTagInput.value = "";
  setSaveStatus(updatedCount > 0 ? `Merged tag across ${updatedCount} asset${updatedCount === 1 ? "" : "s"}` : "No assets used that tag");
});

saveManifestButton.addEventListener("click", async () => {
  try {
    await saveManifest();
  } catch (error) {
    setSaveStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadManifestButton.addEventListener("click", () => {
  downloadManifest();
  setSaveStatus("Manifest downloaded");
});

saveTemplatesButton.addEventListener("click", async () => {
  try {
    await saveTagTemplates();
  } catch (error) {
    setSaveStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadTemplatesButton.addEventListener("click", () => {
  downloadTagTemplates();
  setSaveStatus("Templates downloaded");
});

saveCategoriesButton.addEventListener("click", async () => {
  try {
    await saveCategories();
  } catch (error) {
    setSaveStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadCategoriesButton.addEventListener("click", () => {
  downloadCategories();
  setSaveStatus("Categories downloaded");
});

resetChangesButton.addEventListener("click", () => {
  const currentState = libraryStates.get(selectedLibraryId);
  if (!currentState) {
    return;
  }
  currentState.workingManifest = structuredClone(currentState.originalManifest);
  currentState.workingCategories = [...currentState.originalCategories];
  currentState.workingTagTemplates = {
    version: 1,
    categories: Object.fromEntries(
      currentState.workingCategories.map((category) => [category, [...(currentState.originalTagTemplates.categories[category] ?? [])]]),
    ) as Partial<Record<AssetCategory, string[]>>,
  };
  applyLibraryState(selectedLibraryId);
  syncCategorySelects();
  selectedAssetId = workingManifest.assets[0]?.id ?? null;
  renderList();
  renderEditor();
  renderTemplateEditor();
  setSaveStatus("Changes reset");
});

renderList();
renderEditor();
renderTemplateEditor();
setSaveStatus("Ready");
