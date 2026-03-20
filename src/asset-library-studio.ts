import { ASSET_CATEGORIES, ASSETS, type AssetCategory, type AssetDefinition } from "./assets";
import assetTagTemplates from "./data/asset-tag-templates.json";

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
    .sidebar {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 12px;
      padding: 14px;
      border-right: 1px solid #242c33;
      background: #14191e;
      min-height: 0;
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
      overflow: auto;
      min-height: 0;
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
    }
    .form {
      display: grid;
      gap: 10px;
      min-height: 0;
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
  </style>
  <section class="studio">
    <aside class="sidebar">
      <div class="panel">
        <h2>Library</h2>
        <div class="grid">
          <label>Search
            <input id="assetSearch" placeholder="Search name, file, tags" />
          </label>
          <label>Category
            <select id="categoryFilter"></select>
          </label>
        </div>
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
const categoryFilter = document.querySelector<HTMLSelectElement>("#categoryFilter");
const assetList = document.querySelector<HTMLDivElement>("#assetList");
const libraryStatus = document.querySelector<HTMLDivElement>("#libraryStatus");
const tagReport = document.querySelector<HTMLDivElement>("#tagReport");
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
  !assetSearch ||
  !categoryFilter ||
  !assetList ||
  !libraryStatus ||
  !tagReport ||
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

const originalManifest: AssetLibraryManifest = {
  version: 1,
  assets: ASSETS.map((asset) => ({
    ...asset,
    tags: [...asset.tags],
    placeholder: {
      ...asset.placeholder,
      size: [...asset.placeholder.size] as [number, number, number],
    },
  })),
};

function parseAssetTagTemplateManifest(value: unknown): AssetTagTemplateManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Asset tag template manifest must be an object.");
  }

  const candidate = value as Partial<AssetTagTemplateManifest>;
  if (candidate.version !== 1 || !candidate.categories || typeof candidate.categories !== "object") {
    throw new Error("Asset tag template manifest must include version 1 and a categories object.");
  }

  const parsedCategories: Partial<Record<AssetCategory, string[]>> = {};
  ASSET_CATEGORIES.forEach((category) => {
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

const curatedTagTemplates = parseAssetTagTemplateManifest(assetTagTemplates);
let workingTagTemplates: AssetTagTemplateManifest = {
  version: 1,
  categories: Object.fromEntries(
    ASSET_CATEGORIES.map((category) => [category, [...(curatedTagTemplates.categories[category] ?? [])]]),
  ) as Partial<Record<AssetCategory, string[]>>,
};

let workingManifest: AssetLibraryManifest = structuredClone(originalManifest);
let selectedAssetId = workingManifest.assets[0]?.id ?? null;

function populateCategorySelect(select: HTMLSelectElement, includeAll = false) {
  const options = includeAll ? ["All", ...ASSET_CATEGORIES] : [...ASSET_CATEGORIES];
  select.innerHTML = options.map((value) => `<option value="${value}">${value}</option>`).join("");
}

populateCategorySelect(categoryFilter, true);
populateCategorySelect(assetCategoryInput, false);
populateCategorySelect(batchCategoryInput, false);
populateCategorySelect(templateCategoryInput, false);
categoryFilter.value = "All";
templateCategoryInput.value = ASSET_CATEGORIES[0];

function getThumbnailUrl(asset: AssetDefinition) {
  return `/generated/asset-previews/${asset.thumbnailFileName}`;
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

function getLibraryDiagnostics() {
  const emptyNameCount = workingManifest.assets.filter((asset) => asset.name.trim().length === 0).length;
  const nameCounts = new Map<string, number>();
  const categoryCounts = new Map<AssetCategory, number>();
  const duplicateTagAssetIds = new Set<string>();
  const tagCounts = new Map<string, number>();

  ASSET_CATEGORIES.forEach((category) => {
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

  ASSET_CATEGORIES.forEach((category) => {
    const normalizedTags = (workingTagTemplates.categories[category] ?? [])
      .map((tag) => normalizeTagKey(tag))
      .filter(Boolean);
    normalizedByCategory.set(category, normalizedTags);
    if (normalizedTags.length === 0) {
      emptyCategories.push(category);
    }
  });

  ASSET_CATEGORIES.forEach((category) => {
    const categoryTags = normalizedByCategory.get(category) ?? [];
    const overlaps: string[] = [];
    ASSET_CATEGORIES.forEach((otherCategory) => {
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
          ASSET_CATEGORIES.map((category) => [category, workingTagTemplates.categories[category] ?? []]),
        ),
      },
      null,
      2,
    ) + "\n"
  );
}

async function saveTagTemplates() {
  const targetWindow = window as SaveFilePickerWindow;
  if (targetWindow.showSaveFilePicker) {
    const handle = await targetWindow.showSaveFilePicker({
      suggestedName: "asset-tag-templates.json",
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
  anchor.download = "asset-tag-templates.json";
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
  const categoryCoverage = ASSET_CATEGORIES.map((category) => {
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
    assetCategoryInput.value = ASSET_CATEGORIES[0];
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
      suggestedName: "assets-manifest.json",
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
  anchor.download = "assets-manifest.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

assetSearch.addEventListener("input", () => {
  renderList();
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

resetChangesButton.addEventListener("click", () => {
  workingManifest = structuredClone(originalManifest);
  selectedAssetId = workingManifest.assets[0]?.id ?? null;
  renderList();
  renderEditor();
  setSaveStatus("Changes reset");
});

renderList();
renderEditor();
renderTemplateEditor();
setSaveStatus("Ready");
