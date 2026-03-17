import type { RefObject } from "react";
import { ASSETS, ASSET_CATEGORIES, type AssetCategory, type AssetDefinition } from "../assets";
import type { EditorViewState } from "../editor/view-state";
import {
  ClearIcon,
  ExportIcon,
  ImportIcon,
  PlaceIcon,
  RedoIcon,
  SaveLoadIcon,
  SelectIcon,
  SettingsIcon,
  SnapIcon,
  TrashIcon,
  UndoIcon,
} from "./icons";

function getAssetThumbnailUrl(asset: AssetDefinition) {
  return `/generated/asset-previews/${asset.fileName.replace(/\.[^.]+$/u, ".png")}`;
}

interface EditorToolbarProps {
  viewState: EditorViewState;
  exportMenuOpen: boolean;
  settingsMenuOpen: boolean;
  importInputRef: RefObject<HTMLInputElement | null>;
  onToggleSnap: () => void;
  onSelectMode: () => void;
  onPlaceMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onImportFile: (file: File) => void;
  onLoadLastSaved: () => void;
  onDeleteSelected: () => void;
  onClearScene: () => void;
  onGridSizeChange: (value: number) => void;
  onRotationStepChange: (value: number) => void;
  onToggleExportMenu: () => void;
  onToggleSettingsMenu: () => void;
  onEnvironmentToggle: (enabled: boolean) => void;
}

function EditorToolbar(props: EditorToolbarProps) {
  const { toolbar } = props.viewState;

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          className={`tool-button${toolbar.snapEnabled ? " is-active" : ""}`}
          onClick={props.onToggleSnap}
        >
          <span className="tool-button-content">
            <SnapIcon className="tool-icon" />
            <span>Snap</span>
          </span>
        </button>
        <label className="tool-field">
          <span>Grid</span>
          <select
            value={String(toolbar.gridSize)}
            onChange={(event) => {
              props.onGridSizeChange(Number(event.target.value));
            }}
          >
            <option value="2">2</option>
            <option value="1">1</option>
            <option value="0.5">0.5</option>
            <option value="0.25">0.25</option>
            <option value="0.125">0.125</option>
          </select>
        </label>
        <label className="tool-field">
          <span>Rotate</span>
          <select
            value={String(toolbar.rotationStepDegrees)}
            onChange={(event) => {
              props.onRotationStepChange(Number(event.target.value));
            }}
          >
            <option value="90">90deg</option>
            <option value="45">45deg</option>
            <option value="15">15deg</option>
          </select>
        </label>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className={`tool-button${toolbar.mode === "select" ? " is-active" : ""}`}
          onClick={props.onSelectMode}
        >
          <span className="tool-button-content">
            <SelectIcon className="tool-icon" />
            <span>Select</span>
          </span>
        </button>
        <button
          type="button"
          className={`tool-button${toolbar.mode === "place" ? " is-active" : ""}`}
          onClick={props.onPlaceMode}
        >
          <span className="tool-button-content">
            <PlaceIcon className="tool-icon" />
            <span>Place</span>
          </span>
        </button>
        <button type="button" className="tool-button" disabled={!toolbar.canUndo} onClick={props.onUndo}>
          <span className="tool-button-content">
            <UndoIcon className="tool-icon" />
            <span>Undo</span>
          </span>
        </button>
        <button type="button" className="tool-button" disabled={!toolbar.canRedo} onClick={props.onRedo}>
          <span className="tool-button-content">
            <RedoIcon className="tool-icon" />
            <span>Redo</span>
          </span>
        </button>
        <input
          type="file"
          accept="application/json,.json"
          hidden
          ref={props.importInputRef}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            props.onImportFile(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="tool-button tool-button-danger"
          disabled={!toolbar.hasSelection}
          onClick={props.onDeleteSelected}
        >
          <span className="tool-button-content">
            <TrashIcon className="tool-icon" />
            <span>Delete Selected</span>
          </span>
        </button>
        <button
          type="button"
          className="tool-button tool-button-danger"
          disabled={!toolbar.hasObjects}
          onClick={props.onClearScene}
        >
          <span className="tool-button-content">
            <ClearIcon className="tool-icon" />
            <span>Clear Scene</span>
          </span>
        </button>
        <div className="toolbar-popover">
          <button
            type="button"
            className={`tool-button tool-button-icon-only${props.exportMenuOpen ? " is-active" : ""}`}
            aria-label="Export and import"
            title="Export and import"
            onClick={props.onToggleExportMenu}
          >
            <SaveLoadIcon className="tool-icon" />
          </button>
          <div className="toolbar-menu" hidden={!props.exportMenuOpen}>
            <div className="panel-label settings-menu-label">Scene File</div>
            <div className="toolbar-menu-actions">
              <button type="button" className="toolbar-menu-button" onClick={props.onExportJson}>
                <ExportIcon className="tool-icon" />
                <span>Export JSON</span>
              </button>
              <button type="button" className="toolbar-menu-button" onClick={props.onImportJson}>
                <ImportIcon className="tool-icon" />
                <span>Import JSON</span>
              </button>
              <button type="button" className="toolbar-menu-button" onClick={props.onLoadLastSaved}>
                <SaveLoadIcon className="tool-icon" />
                <span>Load Last Saved</span>
              </button>
            </div>
          </div>
        </div>
        <div className="toolbar-popover">
          <button
            type="button"
            className={`tool-button tool-button-icon${props.settingsMenuOpen ? " is-active" : ""}`}
            aria-label="User settings"
            onClick={props.onToggleSettingsMenu}
          >
            <span className="tool-button-content">
              <SettingsIcon className="tool-icon" />
              <span>Settings</span>
            </span>
          </button>
          <div className="toolbar-menu settings-menu" hidden={!props.settingsMenuOpen}>
            <div className="panel-label settings-menu-label">User Settings</div>
            <label className="setting-row">
              <span className="setting-copy">Environment Lighting</span>
              <span className="setting-switch">
                <input
                  type="checkbox"
                  checked={toolbar.environmentEnabled}
                  onChange={(event) => {
                    props.onEnvironmentToggle(event.target.checked);
                  }}
                />
                <span className="setting-slider" aria-hidden="true"></span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </header>
  );
}

interface AssetListProps {
  assets: AssetDefinition[];
  activeAssetId: string | null;
  onAssetClick: (assetId: string) => void;
}

function AssetList(props: AssetListProps) {
  if (props.assets.length === 0) {
    return <div className="asset-empty">No assets match the current filter.</div>;
  }

  return (
    <div className="asset-list">
      {props.assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          className={`asset-row${props.activeAssetId === asset.id ? " is-active" : ""}`}
          onClick={() => {
            props.onAssetClick(asset.id);
          }}
        >
          <span className="asset-swatch" style={{ background: asset.placeholder.color }}></span>
          <span className="asset-copy">
            <span className="asset-name">{asset.name}</span>
            <span className="asset-meta">{`${asset.category} | ${asset.fileName}`}</span>
          </span>
          <img
            className="asset-thumb"
            alt=""
            loading="lazy"
            src={getAssetThumbnailUrl(asset)}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        </button>
      ))}
    </div>
  );
}

interface SelectionPanelProps {
  viewState: EditorViewState;
}

function SelectionPanel({ viewState }: SelectionPanelProps) {
  if (!viewState.selection.selectedAssetName) {
    return (
      <div className="properties-empty">
        <strong>No object selected.</strong>
        <span>Active asset: {viewState.selection.activeAssetName ?? "None"}</span>
        <span>Preview: {viewState.selection.previewAssetName ?? "None"}</span>
        <span>Use Delete Selected for one item or Clear Scene for all.</span>
      </div>
    );
  }

  return (
    <div className="properties-grid">
      <span className="properties-label">Asset</span>
      <span>{viewState.selection.selectedAssetName}</span>
      <span className="properties-label">Position</span>
      <span>{viewState.selection.positionText ?? "-"}</span>
      <span className="properties-label">Rotation</span>
      <span>{viewState.selection.rotationText ?? "-"}</span>
      <span className="properties-label">Snap</span>
      <span>{viewState.selection.snapText ?? "-"}</span>
    </div>
  );
}

interface AssetSidebarProps {
  searchQuery: string;
  activeCategory: AssetCategory | "All";
  filteredAssets: AssetDefinition[];
  viewState: EditorViewState;
  onSearchQueryChange: (value: string) => void;
  onActiveCategoryChange: (value: AssetCategory | "All") => void;
  onAssetClick: (assetId: string) => void;
}

function AssetSidebar(props: AssetSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <label className="panel-label" htmlFor="asset-search">
          Assets
        </label>
        <input
          id="asset-search"
          className="editor-input"
          type="text"
          placeholder="Search assets"
          value={props.searchQuery}
          onChange={(event) => {
            props.onSearchQueryChange(event.target.value);
          }}
        />
      </div>
      <div className="sidebar-section">
        <div className="chip-row">
          <button
            type="button"
            className={`chip${props.activeCategory === "All" ? " is-active" : ""}`}
            onClick={() => {
              props.onActiveCategoryChange("All");
            }}
          >
            All
          </button>
          {ASSET_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`chip${props.activeCategory === category ? " is-active" : ""}`}
              onClick={() => {
                props.onActiveCategoryChange(category);
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <AssetList
        assets={props.filteredAssets}
        activeAssetId={props.viewState.activeAssetId}
        onAssetClick={props.onAssetClick}
      />
      <div className="sidebar-section sidebar-properties">
        <div className="panel-label">{`Selection${props.viewState.objectCount ? ` (${props.viewState.objectCount})` : ""}`}</div>
        <div className="properties-panel">
          <SelectionPanel viewState={props.viewState} />
        </div>
      </div>
    </aside>
  );
}

function ViewportPanel({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  return (
    <main className="viewport-panel">
      <canvas id="renderCanvas" ref={canvasRef}></canvas>
    </main>
  );
}

function StatusBar({ viewState }: { viewState: EditorViewState }) {
  const { status } = viewState;
  return (
    <footer className="statusbar">
      <span>
        <strong>Mode</strong> <span>{status.mode === "place" ? "Placement" : "Selection"}</span>
      </span>
      <span>
        <strong>Asset</strong> <span>{status.activeAssetName ?? "None"}</span>
      </span>
      <span>
        <strong>Snap</strong>{" "}
        <span>
          {status.snapEnabled ? `${status.gridSize}u | ${status.rotationStepDegrees}deg` : `Free | ${status.rotationStepDegrees}deg`}
        </span>
      </span>
      <span>
        <strong>Objects</strong> <span>{viewState.objectCount}</span>
      </span>
      <span className="statusbar-hint">{status.hint}</span>
    </footer>
  );
}

interface EditorShellProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  activeCategory: AssetCategory | "All";
  filteredAssets: AssetDefinition[];
  exportMenuOpen: boolean;
  settingsMenuOpen: boolean;
  viewState: EditorViewState;
  onSearchQueryChange: (value: string) => void;
  onActiveCategoryChange: (value: AssetCategory | "All") => void;
  onAssetClick: (assetId: string) => void;
  onToggleSnap: () => void;
  onSelectMode: () => void;
  onPlaceMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onImportFile: (file: File) => void;
  onLoadLastSaved: () => void;
  onDeleteSelected: () => void;
  onClearScene: () => void;
  onGridSizeChange: (value: number) => void;
  onRotationStepChange: (value: number) => void;
  onToggleExportMenu: () => void;
  onToggleSettingsMenu: () => void;
  onEnvironmentToggle: (enabled: boolean) => void;
}

export function EditorShell(props: EditorShellProps) {
  return (
    <section className="shell">
      <EditorToolbar
        viewState={props.viewState}
        exportMenuOpen={props.exportMenuOpen}
        settingsMenuOpen={props.settingsMenuOpen}
        importInputRef={props.importInputRef}
        onToggleSnap={props.onToggleSnap}
        onSelectMode={props.onSelectMode}
        onPlaceMode={props.onPlaceMode}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onExportJson={props.onExportJson}
        onImportJson={props.onImportJson}
        onImportFile={props.onImportFile}
        onLoadLastSaved={props.onLoadLastSaved}
        onDeleteSelected={props.onDeleteSelected}
        onClearScene={props.onClearScene}
        onGridSizeChange={props.onGridSizeChange}
        onRotationStepChange={props.onRotationStepChange}
        onToggleExportMenu={props.onToggleExportMenu}
        onToggleSettingsMenu={props.onToggleSettingsMenu}
        onEnvironmentToggle={props.onEnvironmentToggle}
      />
      <div className="workspace">
        <AssetSidebar
          searchQuery={props.searchQuery}
          activeCategory={props.activeCategory}
          filteredAssets={props.filteredAssets}
          viewState={props.viewState}
          onSearchQueryChange={props.onSearchQueryChange}
          onActiveCategoryChange={props.onActiveCategoryChange}
          onAssetClick={props.onAssetClick}
        />
        <ViewportPanel canvasRef={props.canvasRef} />
      </div>
      <StatusBar viewState={props.viewState} />
    </section>
  );
}

export function filterAssets(query: string, activeCategory: AssetCategory | "All") {
  const normalized = query.trim().toLowerCase();
  return ASSETS.filter((asset) => {
    const matchesCategory = activeCategory === "All" || asset.category === activeCategory;
    const haystack = `${asset.name} ${asset.category} ${asset.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !normalized || haystack.includes(normalized);
    return matchesCategory && matchesQuery;
  });
}
