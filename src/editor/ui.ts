import { ASSET_CATEGORIES, type AssetCategory, type AssetDefinition } from "../assets";

export interface EditorUi {
  canvas: HTMLCanvasElement;
  searchInput: HTMLInputElement;
  categoryButtons: HTMLButtonElement[];
  assetList: HTMLDivElement;
  snapToggle: HTMLButtonElement;
  selectionModeButton: HTMLButtonElement;
  placementModeButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  loadButton: HTMLButtonElement;
  loadInput: HTMLInputElement;
  deleteSelectedButton: HTMLButtonElement;
  clearSceneButton: HTMLButtonElement;
  gridSizeSelect: HTMLSelectElement;
  rotationSelect: HTMLSelectElement;
  settingsButton: HTMLButtonElement;
  settingsMenu: HTMLDivElement;
  environmentToggle: HTMLInputElement;
  statusMode: HTMLElement;
  statusAsset: HTMLElement;
  statusGrid: HTMLElement;
  statusHint: HTMLElement;
  propertiesPanel: HTMLDivElement;
}

export interface AssetListRenderState {
  activeAssetId: string | null;
  activeCategory: AssetCategory | "All";
  query: string;
}

export interface ToolbarRenderState {
  snapEnabled: boolean;
  mode: "select" | "place";
  settingsMenuOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasObjects: boolean;
  gridSize: number;
  rotationStepDegrees: number;
  environmentEnabled: boolean;
}

export interface StatusRenderState {
  mode: "select" | "place";
  activeAssetName: string | null;
  snapEnabled: boolean;
  gridSize: number;
  rotationStepDegrees: number;
  hint: string;
}

export interface SelectionPanelState {
  selectedAssetName: string | null;
  activeAssetName: string | null;
  positionText: string | null;
  rotationText: string | null;
  snapText: string | null;
}

export function createEditorUi(canvas: HTMLCanvasElement): EditorUi {
  const searchInput = document.querySelector<HTMLInputElement>("[data-role='search-input']");
  const assetList = document.querySelector<HTMLDivElement>("[data-role='asset-list']");
  const snapToggle = document.querySelector<HTMLButtonElement>("[data-role='snap-toggle']");
  const selectionModeButton = document.querySelector<HTMLButtonElement>("[data-role='selection-mode']");
  const placementModeButton = document.querySelector<HTMLButtonElement>("[data-role='placement-mode']");
  const undoButton = document.querySelector<HTMLButtonElement>("[data-role='undo']");
  const redoButton = document.querySelector<HTMLButtonElement>("[data-role='redo']");
  const saveButton = document.querySelector<HTMLButtonElement>("[data-role='save']");
  const loadButton = document.querySelector<HTMLButtonElement>("[data-role='load']");
  const loadInput = document.querySelector<HTMLInputElement>("[data-role='load-input']");
  const deleteSelectedButton = document.querySelector<HTMLButtonElement>("[data-role='delete-selected']");
  const clearSceneButton = document.querySelector<HTMLButtonElement>("[data-role='clear-scene']");
  const gridSizeSelect = document.querySelector<HTMLSelectElement>("[data-role='grid-size']");
  const rotationSelect = document.querySelector<HTMLSelectElement>("[data-role='rotation-step']");
  const settingsButton = document.querySelector<HTMLButtonElement>("[data-role='settings-button']");
  const settingsMenu = document.querySelector<HTMLDivElement>("[data-role='settings-menu']");
  const environmentToggle = document.querySelector<HTMLInputElement>("[data-role='environment-toggle']");
  const statusMode = document.querySelector<HTMLElement>("[data-role='status-mode']");
  const statusAsset = document.querySelector<HTMLElement>("[data-role='status-asset']");
  const statusGrid = document.querySelector<HTMLElement>("[data-role='status-grid']");
  const statusHint = document.querySelector<HTMLElement>("[data-role='status-hint']");
  const propertiesPanel = document.querySelector<HTMLDivElement>("[data-role='properties-panel']");
  const categoryButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-role='category-filter']"));

  if (
    !searchInput ||
    !assetList ||
    !snapToggle ||
    !selectionModeButton ||
    !placementModeButton ||
    !undoButton ||
    !redoButton ||
    !saveButton ||
    !loadButton ||
    !loadInput ||
    !deleteSelectedButton ||
    !clearSceneButton ||
    !gridSizeSelect ||
    !rotationSelect ||
    !settingsButton ||
    !settingsMenu ||
    !environmentToggle ||
    !statusMode ||
    !statusAsset ||
    !statusGrid ||
    !statusHint ||
    !propertiesPanel
  ) {
    throw new Error("Editor UI is incomplete.");
  }

  return {
    canvas,
    searchInput,
    categoryButtons,
    assetList,
    snapToggle,
    selectionModeButton,
    placementModeButton,
    undoButton,
    redoButton,
    saveButton,
    loadButton,
    loadInput,
    deleteSelectedButton,
    clearSceneButton,
    gridSizeSelect,
    rotationSelect,
    settingsButton,
    settingsMenu,
    environmentToggle,
    statusMode,
    statusAsset,
    statusGrid,
    statusHint,
    propertiesPanel,
  };
}

export function buildEditorMarkup() {
  const categoryButtons = [
    `<button type="button" class="chip is-active" data-role="category-filter" data-category="All">All</button>`,
    ...ASSET_CATEGORIES.map(
      (category) =>
        `<button type="button" class="chip" data-role="category-filter" data-category="${category}">${category}</button>`,
    ),
  ].join("");

  return `
    <section class="shell">
      <header class="toolbar">
        <div class="toolbar-group">
          <button type="button" class="tool-button is-active" data-role="snap-toggle">Snap</button>
          <label class="tool-field">
            <span>Grid</span>
            <select data-role="grid-size">
              <option value="2">2</option>
              <option value="1" selected>1</option>
              <option value="0.5">0.5</option>
              <option value="0.25">0.25</option>
              <option value="0.125">0.125</option>
            </select>
          </label>
          <label class="tool-field">
            <span>Rotate</span>
            <select data-role="rotation-step">
              <option value="90" selected>90deg</option>
              <option value="45">45deg</option>
              <option value="15">15deg</option>
            </select>
          </label>
        </div>
        <div class="toolbar-group">
          <button type="button" class="tool-button is-active" data-role="selection-mode">Select</button>
          <button type="button" class="tool-button" data-role="placement-mode">Place</button>
          <button type="button" class="tool-button" data-role="undo" disabled>Undo</button>
          <button type="button" class="tool-button" data-role="redo" disabled>Redo</button>
          <button type="button" class="tool-button" data-role="save">Export JSON</button>
          <button type="button" class="tool-button" data-role="load">Import JSON</button>
          <input type="file" data-role="load-input" accept="application/json,.json" hidden />
          <button type="button" class="tool-button tool-button-danger" data-role="delete-selected" disabled>Delete Selected</button>
          <button type="button" class="tool-button tool-button-danger" data-role="clear-scene" disabled>Clear Scene</button>
          <div class="toolbar-settings">
            <button type="button" class="tool-button tool-button-icon" data-role="settings-button" aria-label="User settings">Settings</button>
            <div class="settings-menu" data-role="settings-menu" hidden>
              <div class="panel-label settings-menu-label">User Settings</div>
              <label class="setting-row">
                <span class="setting-copy">Environment Lighting</span>
                <span class="setting-switch">
                  <input type="checkbox" data-role="environment-toggle" />
                  <span class="setting-slider" aria-hidden="true"></span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </header>
      <div class="workspace">
        <aside class="sidebar">
          <div class="sidebar-section">
            <label class="panel-label" for="asset-search">Assets</label>
            <input id="asset-search" data-role="search-input" class="editor-input" type="text" placeholder="Search assets" />
          </div>
          <div class="sidebar-section">
            <div class="chip-row">${categoryButtons}</div>
          </div>
          <div class="asset-list" data-role="asset-list"></div>
          <div class="sidebar-section sidebar-properties">
            <div class="panel-label">Selection</div>
            <div class="properties-panel" data-role="properties-panel"></div>
          </div>
        </aside>
        <main class="viewport-panel">
          <canvas id="renderCanvas"></canvas>
        </main>
      </div>
      <footer class="statusbar">
        <span><strong>Mode</strong> <span data-role="status-mode">Selection</span></span>
        <span><strong>Asset</strong> <span data-role="status-asset">None</span></span>
        <span><strong>Snap</strong> <span data-role="status-grid">1u · 90deg</span></span>
        <span class="statusbar-hint" data-role="status-hint">Click object select · Delete remove · R rotate</span>
      </footer>
    </section>
  `;
}

export function renderAssetList(
  ui: EditorUi,
  assets: AssetDefinition[],
  state: AssetListRenderState,
  getThumbnailUrl: (asset: AssetDefinition) => string,
  onAssetClick: (asset: AssetDefinition) => void | Promise<void>,
) {
  const query = state.query.trim().toLowerCase();
  ui.assetList.innerHTML = "";

  ui.categoryButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === state.activeCategory);
  });

  const filtered = assets.filter((asset) => {
    const matchesCategory = state.activeCategory === "All" || asset.category === state.activeCategory;
    const haystack = `${asset.name} ${asset.category} ${asset.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesCategory && matchesQuery;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "asset-empty";
    empty.textContent = "No assets match the current filter.";
    ui.assetList.appendChild(empty);
    return;
  }

  filtered.forEach((asset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "asset-row";
    button.innerHTML = `
      <span class="asset-swatch" style="background:${asset.placeholder.color}"></span>
      <span class="asset-copy">
        <span class="asset-name">${asset.name}</span>
        <span class="asset-meta">${asset.category} · ${asset.fileName}</span>
      </span>
      <img class="asset-thumb" alt="" loading="lazy" src="${getThumbnailUrl(asset)}" />
    `;

    const thumbnail = button.querySelector<HTMLImageElement>(".asset-thumb");
    thumbnail?.addEventListener("error", () => {
      thumbnail.hidden = true;
    });

    button.classList.toggle("is-active", asset.id === state.activeAssetId);
    button.addEventListener("click", () => {
      void onAssetClick(asset);
    });
    ui.assetList.appendChild(button);
  });
}

export function renderSelectionPanel(ui: EditorUi, state: SelectionPanelState) {
  if (!state.selectedAssetName) {
    ui.propertiesPanel.innerHTML = `
      <div class="properties-empty">
        <strong>No object selected.</strong>
        <span>Active asset: ${state.activeAssetName ?? "None"}</span>
        <span>Use Delete Selected for one item or Clear Scene for all.</span>
      </div>
    `;
    return;
  }

  ui.propertiesPanel.innerHTML = `
    <div class="properties-grid">
      <span class="properties-label">Asset</span>
      <span>${state.selectedAssetName}</span>
      <span class="properties-label">Position</span>
      <span>${state.positionText ?? "-"}</span>
      <span class="properties-label">Rotation</span>
      <span>${state.rotationText ?? "-"}</span>
      <span class="properties-label">Snap</span>
      <span>${state.snapText ?? "-"}</span>
    </div>
  `;
}

export function renderToolbar(ui: EditorUi, state: ToolbarRenderState) {
  ui.snapToggle.classList.toggle("is-active", state.snapEnabled);
  ui.selectionModeButton.classList.toggle("is-active", state.mode === "select");
  ui.placementModeButton.classList.toggle("is-active", state.mode === "place");
  ui.settingsButton.classList.toggle("is-active", state.settingsMenuOpen);
  ui.undoButton.disabled = !state.canUndo;
  ui.redoButton.disabled = !state.canRedo;
  ui.deleteSelectedButton.disabled = !state.hasSelection;
  ui.clearSceneButton.disabled = !state.hasObjects;
  ui.gridSizeSelect.value = String(state.gridSize);
  ui.rotationSelect.value = String(state.rotationStepDegrees);
  ui.environmentToggle.checked = state.environmentEnabled;
  ui.settingsMenu.hidden = !state.settingsMenuOpen;
}

export function renderStatus(ui: EditorUi, state: StatusRenderState) {
  ui.statusMode.textContent = state.mode === "place" ? "Placement" : "Selection";
  ui.statusAsset.textContent = state.activeAssetName ?? "None";
  ui.statusGrid.textContent = state.snapEnabled
    ? `${state.gridSize}u · ${state.rotationStepDegrees}deg`
    : `Free · ${state.rotationStepDegrees}deg`;
  ui.statusHint.textContent = state.hint;
}
