import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { getAssetThumbnailUrlForLibrary, type AssetCategory, type AssetDefinition, type AssetLibraryBundle } from "../assets";
import type { EditorViewState } from "../editor/view-state";
import { FilterBar } from "./filter-bar";
import {
  ClearIcon,
  ChevronRightIcon,
  DuplicateIcon,
  DragHandleIcon,
  ExportIcon,
  FocusIcon,
  GroupAddIcon,
  GroupIcon,
  HideIcon,
  ImportIcon,
  LockIcon,
  PromoteIcon,
  PlaceIcon,
  RedoIcon,
  RenameIcon,
  SaveIcon,
  SaveLoadIcon,
  SelectIcon,
  SettingsIcon,
  ShowIcon,
  SnapIcon,
  TrashIcon,
  UndoIcon,
  DemoteIcon,
  UngroupIcon,
  UnlockIcon,
} from "./icons";
import { TreeView } from "./tree-view";

function getAssetThumbnailStyleUrl(libraryId: string, asset: AssetDefinition) {
  return getAssetThumbnailUrlForLibrary(libraryId, asset.thumbnailFileName);
}

export type SceneSortMode = "manual" | "name" | "asset";

const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = "snap:right-sidebar-width";
const RIGHT_SIDEBAR_MIN_WIDTH = 240;
const RIGHT_SIDEBAR_MAX_WIDTH = 520;
const GRID_PLANE_SIZE_OPTIONS = [16, 32, 64, 128, 256] as const;
const CAMERA_CLOSE_LIMIT_OPTIONS = [0.01, 0.05, 0.1, 0.25, 0.5, 1] as const;

interface EditorToolbarProps {
  viewState: EditorViewState;
  exportMenuOpen: boolean;
  settingsMenuOpen: boolean;
  importInputRef: RefObject<HTMLInputElement | null>;
  onToggleSnap: () => void;
  onToggleYSnap: () => void;
  onSelectMode: () => void;
  onPlaceMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveScene: () => void;
  onExportJson: () => void;
  onExportGlb: () => void;
  onExportGltf: () => void;
  onImportJson: () => void;
  onImportFile: (file: File) => void;
  onLoadLastSaved: () => void;
  onLoadAutosave: () => void;
  onDeleteSelected: () => void;
  onClearScene: () => void;
  onGridSizeChange: (value: number) => void;
  onRotationStepChange: (value: number) => void;
  onRotationAxisChange: (value: "x" | "y" | "z") => void;
  onToggleExportMenu: () => void;
  onToggleSettingsMenu: () => void;
  onEnvironmentToggle: (enabled: boolean) => void;
  onEnvironmentIntensityChange: (value: number) => void;
  onLightIntensityChange: (value: number) => void;
  onCameraCloseLimitChange: (value: number) => void;
  onViewportGizmoEnabledChange: (value: boolean) => void;
  onGridVisibleChange: (visible: boolean) => void;
  onGridRenderModeChange: (value: "material" | "lines") => void;
  onGridColorChange: (value: string) => void;
  onGroundColorChange: (value: string) => void;
  onFreezeModelMaterialsChange: (value: boolean) => void;
  onNewObjectPlacementKindChange: (value: "clone" | "instance") => void;
  onHeightLabelModeChange: (value: "transform" | "geometry") => void;
  onSaveOnEveryUiUpdateChange: (value: boolean) => void;
  onAutosaveEnabledChange: (value: boolean) => void;
  onAutosaveIntervalChange: (value: number) => void;
  onGridPlaneSizeChange: (value: number) => void;
  onRetuneCamera: () => void;
  onRestoreDefaults: () => void;
}

function formatSavedAt(value: string | null) {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
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
            <span>[Snap]</span>
          </span>
        </button>
        <button
          type="button"
          className={`tool-button${toolbar.ySnapEnabled ? " is-active" : ""}`}
          onClick={props.onToggleYSnap}
          title="Snap vertical movement to the grid"
        >
          <span className="tool-button-content">
            <span>Y Snap</span>
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
        <label className="tool-field">
          <span>Axis</span>
          <select
            value={toolbar.rotationAxis}
            onChange={(event) => {
              props.onRotationAxisChange(event.target.value as "x" | "y" | "z");
            }}
          >
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="z">Z</option>
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
        <div className="toolbar-file-group">
          <button type="button" className="tool-button" onClick={props.onSaveScene}>
            <span className="tool-button-content">
              <SaveIcon className="tool-icon" />
              <span>Save</span>
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
                <button type="button" className="toolbar-menu-button" onClick={props.onExportGlb}>
                  <ExportIcon className="tool-icon" />
                  <span>Export GLB</span>
                </button>
                <button type="button" className="toolbar-menu-button" onClick={props.onExportGltf}>
                  <ExportIcon className="tool-icon" />
                  <span>Export GLTF</span>
                </button>
                <button type="button" className="toolbar-menu-button" onClick={props.onImportJson}>
                  <ImportIcon className="tool-icon" />
                  <span>Import JSON</span>
                </button>
                <button type="button" className="toolbar-menu-button" onClick={props.onLoadLastSaved}>
                  <SaveLoadIcon className="tool-icon" />
                  <span>Load Last Saved</span>
                </button>
                <button type="button" className="toolbar-menu-button" onClick={props.onLoadAutosave}>
                  <SaveLoadIcon className="tool-icon" />
                  <span>Load Autosave</span>
                </button>
              </div>
              <div className="toolbar-menu-meta">
                <span>Last Saved</span>
                <strong>{formatSavedAt(props.viewState.lastManualSaveAt)}</strong>
              </div>
              <div className="toolbar-menu-meta">
                <span>Last Timed Autosave</span>
                <strong>{formatSavedAt(props.viewState.lastAutosaveAt)}</strong>
              </div>
              <div className="toolbar-menu-meta">
                <span>Autosave Recovered</span>
                <strong>{formatSavedAt(props.viewState.lastRecoveredAutosaveAt)}</strong>
              </div>
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
              <span className="setting-copy">Save On UI Update</span>
              <span className="setting-switch">
                <input
                  type="checkbox"
                  checked={toolbar.saveOnEveryUiUpdate}
                  onChange={(event) => {
                    props.onSaveOnEveryUiUpdateChange(event.target.checked);
                  }}
                />
                <span className="setting-slider" aria-hidden="true"></span>
              </span>
            </label>
            <label className="setting-row">
              <span className="setting-copy">Autosave</span>
              <span className="setting-switch">
                <input
                  type="checkbox"
                  checked={toolbar.autosaveEnabled}
                  onChange={(event) => {
                    props.onAutosaveEnabledChange(event.target.checked);
                  }}
                />
                <span className="setting-slider" aria-hidden="true"></span>
              </span>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Autosave Every</span>
              <select
                className="editor-input"
                value={String(toolbar.autosaveIntervalSeconds)}
                disabled={!toolbar.autosaveEnabled}
                onChange={(event) => {
                  props.onAutosaveIntervalChange(Number(event.target.value));
                }}
              >
                <option value="15">15 sec</option>
                <option value="30">30 sec</option>
                <option value="60">1 min</option>
                <option value="120">2 min</option>
                <option value="300">5 min</option>
              </select>
            </label>
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
            <label className="setting-stack">
              <span className="setting-copy">Environment Intensity</span>
              <span className="setting-meter-row">
                <input
                  className="setting-range"
                  type="range"
                  min="0"
                  max="4"
                  step="0.05"
                  value={toolbar.environmentIntensity}
                  onChange={(event) => {
                    props.onEnvironmentIntensityChange(Number(event.target.value));
                  }}
                />
                <span className="setting-value">{toolbar.environmentIntensity.toFixed(2)}</span>
              </span>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Light Intensity</span>
              <span className="setting-meter-row">
                <input
                  className="setting-range"
                  type="range"
                  min="0"
                  max="4"
                  step="0.05"
                  value={toolbar.lightIntensity}
                  onChange={(event) => {
                    props.onLightIntensityChange(Number(event.target.value));
                  }}
                />
                <span className="setting-value">{toolbar.lightIntensity.toFixed(2)}</span>
              </span>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Camera Close Limit</span>
              <select
                className="editor-input"
                value={String(toolbar.cameraCloseLimit)}
                onChange={(event) => {
                  props.onCameraCloseLimitChange(Number(event.target.value));
                }}
              >
                {CAMERA_CLOSE_LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="setting-row setting-row-spaced">
              <span className="setting-copy">Viewport Gizmo</span>
              <span className="setting-switch">
                <input
                  type="checkbox"
                  checked={toolbar.viewportGizmoEnabled}
                  onChange={(event) => {
                    props.onViewportGizmoEnabledChange(event.target.checked);
                  }}
                />
                <span className="setting-slider" aria-hidden="true"></span>
              </span>
            </label>
            <label className="setting-row setting-row-spaced">
              <span className="setting-copy">Grid Visible</span>
              <span className="setting-switch">
                <input
                  type="checkbox"
                  checked={toolbar.gridVisible}
                  onChange={(event) => {
                    props.onGridVisibleChange(event.target.checked);
                  }}
                />
                <span className="setting-slider" aria-hidden="true"></span>
              </span>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Grid Renderer</span>
              <select
                className="editor-input"
                value={toolbar.gridRenderMode}
                onChange={(event) => {
                  props.onGridRenderModeChange(event.target.value as "material" | "lines");
                }}
              >
                <option value="material">Babylon GridMaterial</option>
                <option value="lines">Procedural LineSystem</option>
              </select>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Grid Plane Size</span>
              <select
                className="editor-input"
                value={String(toolbar.gridPlaneSize)}
                onChange={(event) => {
                  props.onGridPlaneSizeChange(Number(event.target.value));
                }}
              >
                {GRID_PLANE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="toolbar-menu-button setting-action" onClick={props.onRetuneCamera}>
              <span>Retune Camera</span>
            </button>
            <label className="setting-stack">
              <span className="setting-copy">Grid Color</span>
              <input
                className="setting-color"
                type="color"
                value={toolbar.gridColor}
                onChange={(event) => {
                  props.onGridColorChange(event.target.value);
                }}
              />
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Ground Color</span>
              <input
                className="setting-color"
                type="color"
                value={toolbar.groundColor}
                onChange={(event) => {
                  props.onGroundColorChange(event.target.value);
                }}
              />
            </label>
            <label className="setting-row">
              <span className="setting-copy">Freeze Model Materials</span>
              <span className="setting-switch">
                <input
                  type="checkbox"
                  checked={toolbar.freezeModelMaterials}
                  onChange={(event) => {
                    props.onFreezeModelMaterialsChange(event.target.checked);
                  }}
                />
                <span className="setting-slider" aria-hidden="true"></span>
              </span>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">New Objects</span>
              <select
                className="editor-input"
                value={toolbar.newObjectPlacementKind}
                onChange={(event) => {
                  props.onNewObjectPlacementKindChange(event.target.value as "clone" | "instance");
                }}
              >
                <option value="instance">Instance</option>
                <option value="clone">Clone</option>
              </select>
            </label>
            <label className="setting-stack">
              <span className="setting-copy">Height Label</span>
              <select
                className="editor-input"
                value={toolbar.heightLabelMode}
                onChange={(event) => {
                  props.onHeightLabelModeChange(event.target.value as "transform" | "geometry");
                }}
              >
                <option value="transform">Transform Y</option>
                <option value="geometry">Geometry Bottom</option>
              </select>
            </label>
            <button type="button" className="toolbar-menu-button setting-action" onClick={props.onRestoreDefaults}>
              <span>Restore Defaults</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface AssetListProps {
  libraryId: string;
  assets: AssetDefinition[];
  activeAssetId: string | null;
  activeAssetLibraryId: string | null;
  onAssetClick: (libraryId: string, assetId: string) => void;
}

function AssetList(props: AssetListProps) {
  return (
    <TreeView
      items={props.assets}
      emptyMessage="No assets match the current filter."
      className="asset-list"
      getKey={(asset) => asset.id}
      renderItem={(asset) => (
        <button
          key={asset.id}
          type="button"
          className={`asset-row${props.activeAssetId === asset.id && props.activeAssetLibraryId === props.libraryId ? " is-active" : ""}`}
          onClick={() => {
            props.onAssetClick(props.libraryId, asset.id);
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
            src={getAssetThumbnailStyleUrl(props.libraryId, asset)}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        </button>
      )}
    />
  );
}

interface SelectionPanelProps {
  viewState: EditorViewState;
  onCreateGroupFromSelected: () => void;
  onToggleSelectedHidden: () => void;
  onToggleSelectedLocked: () => void;
  onSelectionPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionRotationChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionDropToGround: () => void;
}

function SelectionPanel(props: SelectionPanelProps) {
  const { selection } = props.viewState;
  const [draftPosition, setDraftPosition] = useState({ x: "", y: "", z: "" });
  const [draftRotation, setDraftRotation] = useState({ x: "", y: "", z: "" });

  useEffect(() => {
    const [x, y, z] = selection.position ?? [null, null, null];
    setDraftPosition({
      x: x === null ? "" : x.toFixed(3),
      y: y === null ? "" : y.toFixed(3),
      z: z === null ? "" : z.toFixed(3),
    });
    const [rotX, rotY, rotZ] = selection.rotationDegrees ?? [null, null, null];
    setDraftRotation({
      x: rotX === null ? "" : rotX.toFixed(0),
      y: rotY === null ? "" : rotY.toFixed(0),
      z: rotZ === null ? "" : rotZ.toFixed(0),
    });
  }, [selection.position, selection.rotationDegrees, selection.selectedObjectId]);

  const commitPosition = (axis: "x" | "y" | "z") => {
    const raw = draftPosition[axis].trim();
    if (!raw) {
      return;
    }

    const nextValue = Number(raw);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    props.onSelectionPositionChange(axis, nextValue);
  };

  const commitRotation = (axis: "x" | "y" | "z") => {
    const raw = draftRotation[axis].trim();
    if (!raw) {
      return;
    }

    const nextValue = Number(raw);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    props.onSelectionRotationChange(axis, nextValue);
  };

  const resetDrafts = () => {
    const [x, y, z] = selection.position ?? [null, null, null];
    setDraftPosition({
      x: x === null ? "" : x.toFixed(3),
      y: y === null ? "" : y.toFixed(3),
      z: z === null ? "" : z.toFixed(3),
    });
    const [rotX, rotY, rotZ] = selection.rotationDegrees ?? [null, null, null];
    setDraftRotation({
      x: rotX === null ? "" : rotX.toFixed(0),
      y: rotY === null ? "" : rotY.toFixed(0),
      z: rotZ === null ? "" : rotZ.toFixed(0),
    });
  };

  const handleTransformFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>, commit: () => void) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetDrafts();
    }
  };

  if (!selection.selectedAssetName) {
    return (
      <div className="properties-empty">
        <strong>No object selected.</strong>
        <span>Active asset: {selection.activeAssetName ?? "None"}</span>
        <span>Preview: {selection.previewAssetName ?? "None"}</span>
        <span>Use Delete Selected for one item or Clear Scene for all.</span>
      </div>
    );
  }

  if (selection.multiSelected) {
    const selectedItems = props.viewState.sceneItems.filter((item) => item.selected);
    const allHidden = selectedItems.length > 0 && selectedItems.every((item) => item.hidden);
    const allLocked = selectedItems.length > 0 && selectedItems.every((item) => item.locked);
    return (
      <div className="properties-empty">
        <strong>{selection.selectedAssetName}</strong>
        <span>Shift selects a range. Ctrl adds or removes individual items.</span>
        <span>Transforms still apply to the primary selection only.</span>
        <div className="transform-actions">
          <button type="button" className="toolbar-menu-button" onClick={props.onCreateGroupFromSelected}>
            <span>Group Selected</span>
          </button>
          <button type="button" className="toolbar-menu-button" onClick={props.onToggleSelectedHidden}>
            <span>{allHidden ? "Show Selected" : "Hide Selected"}</span>
          </button>
          <button type="button" className="toolbar-menu-button" onClick={props.onToggleSelectedLocked}>
            <span>{allLocked ? "Unlock Selected" : "Lock Selected"}</span>
          </button>
        </div>
      </div>
    );
  }

  const positionFields: Array<{ axis: "x" | "y" | "z"; label: string }> = [
    { axis: "x", label: "X" },
    { axis: "y", label: "Y" },
    { axis: "z", label: "Z" },
  ];

  return (
    <div className="properties-grid">
      <span className="properties-label">Asset</span>
      <span>{selection.selectedAssetName}</span>
      <span className="properties-label">Position</span>
      <div className="transform-fields">
        {positionFields.map((field) => (
          <label key={field.axis} className="transform-field">
            <span>{field.label}</span>
              <input
                className="transform-input"
                type="number"
                step="0.001"
                value={draftPosition[field.axis]}
              onChange={(event) => {
                setDraftPosition((current) => ({ ...current, [field.axis]: event.target.value }));
              }}
              onBlur={() => {
                commitPosition(field.axis);
              }}
              onKeyDown={(event) => {
                handleTransformFieldKeyDown(event, () => {
                  commitPosition(field.axis);
                });
              }}
            />
          </label>
        ))}
      </div>
      <span className="properties-label">Rotation</span>
      <div className="transform-fields">
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis} className="transform-field">
            <span>{axis.toUpperCase()}</span>
            <input
              className="transform-input"
              type="number"
              step="15"
              value={draftRotation[axis]}
              onChange={(event) => {
                setDraftRotation((current) => ({
                  ...current,
                  [axis]: event.target.value,
                }));
              }}
              onBlur={() => {
                commitRotation(axis);
              }}
              onKeyDown={(event) => {
                handleTransformFieldKeyDown(event, () => {
                  commitRotation(axis);
                });
              }}
            />
          </label>
        ))}
      </div>
      <span className="properties-label">Snap</span>
      <span>{selection.snapText ?? "-"}</span>
      <span className="properties-label">Actions</span>
      <div className="transform-actions">
        <button type="button" className="toolbar-menu-button" onClick={props.onSelectionDropToGround}>
          <span>Drop To Ground</span>
        </button>
      </div>
    </div>
  );
}

interface SceneListProps {
  sceneItems: EditorViewState["sceneItems"];
  sceneSortMode: SceneSortMode;
  searchQuery: string;
  itemTypeFilter: "all" | "object" | "group";
  visibilityFilter: "all" | "visible" | "hidden";
  lockFilter: "all" | "unlocked" | "locked";
  onSceneItemMove: (draggedId: string, targetId: string) => void;
  onSceneItemSelect: (selectionIds: string[], primaryId: string | null) => void;
  onSceneItemFrame: (objectId: string) => void;
  onSceneItemDelete: (objectId: string) => void;
  onSceneItemDuplicate: (objectId: string) => void;
  onSceneItemRename: (objectId: string, nextName: string) => void;
  onSceneItemToggleHidden: (objectId: string) => void;
  onSceneItemToggleLocked: (objectId: string) => void;
  onSceneItemPromote: (objectId: string) => void;
  onSceneItemDemote: (objectId: string) => void;
  onSceneItemUngroup: (objectId: string) => void;
  onSceneItemUnchildGroup: (groupId: string) => void;
}

function SceneList(props: SceneListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ id: string; mode: "into" | "before" } | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());

  const sortedItems = [...props.sceneItems];
  if (props.sceneSortMode === "name") {
    sortedItems.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  } else if (props.sceneSortMode === "asset") {
    sortedItems.sort((a, b) => {
      const assetCompare = a.assetName.localeCompare(b.assetName, undefined, { sensitivity: "base" });
      return assetCompare !== 0 ? assetCompare : a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
  }

  const commitRename = (objectId: string) => {
    const nextName = editingName.trim();
    if (nextName) {
      props.onSceneItemRename(objectId, nextName);
    }
    setEditingId(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, objectId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(objectId);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  const itemsById = new Map(sortedItems.map((item) => [item.id, item]));
  const actualItemsById = new Map(props.sceneItems.map((item) => [item.id, item]));
  const normalizedQuery = props.searchQuery.trim().toLowerCase();
  const hasActiveFilter =
    !!normalizedQuery ||
    props.itemTypeFilter !== "all" ||
    props.visibilityFilter !== "all" ||
    props.lockFilter !== "all";

  const matchesFilters = (item: EditorViewState["sceneItems"][number]) => {
    const matchesQuery =
      !normalizedQuery ||
      item.label.toLowerCase().includes(normalizedQuery) ||
      item.assetName.toLowerCase().includes(normalizedQuery);
    const matchesType = props.itemTypeFilter === "all" || item.type === props.itemTypeFilter;
    const matchesVisibility =
      props.visibilityFilter === "all" ||
      (props.visibilityFilter === "hidden" ? item.hidden : !item.hidden);
    const matchesLock =
      props.lockFilter === "all" ||
      (props.lockFilter === "locked" ? item.locked : !item.locked);
    return matchesQuery && matchesType && matchesVisibility && matchesLock;
  };

  const includedIds = new Set<string>();
  if (hasActiveFilter) {
    sortedItems.forEach((item) => {
      if (!matchesFilters(item)) {
        return;
      }
      let currentId: string | null = item.id;
      while (currentId) {
        includedIds.add(currentId);
        currentId = itemsById.get(currentId)?.parentId ?? null;
      }
    });
  }

  const visibleItems = sortedItems.filter((item) => {
    if (hasActiveFilter && !includedIds.has(item.id)) {
      return false;
    }
    if (hasActiveFilter) {
      return true;
    }

    let currentParentId = item.parentId;
    while (currentParentId) {
      if (collapsedGroupIds.includes(currentParentId)) {
        return false;
      }
      currentParentId = itemsById.get(currentParentId)?.parentId ?? null;
    }

    return true;
  });

  const selectedIds = props.sceneItems.filter((item) => item.selected).map((item) => item.id);
  const selectedIdSet = new Set(selectedIds);
  const primarySelectedId = selectedIds[selectedIds.length - 1] ?? null;

  useEffect(() => {
    if (!primarySelectedId) {
      return;
    }

    const expandedAncestorIds: string[] = [];
    let currentParentId = actualItemsById.get(primarySelectedId)?.parentId ?? null;
    while (currentParentId) {
      expandedAncestorIds.push(currentParentId);
      currentParentId = actualItemsById.get(currentParentId)?.parentId ?? null;
    }

    if (expandedAncestorIds.length === 0) {
      return;
    }

    setCollapsedGroupIds((current) => {
      const next = current.filter((groupId) => !expandedAncestorIds.includes(groupId));
      return next.length === current.length ? current : next;
    });
  }, [actualItemsById, primarySelectedId]);

  useLayoutEffect(() => {
    if (!primarySelectedId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const container = listContainerRef.current;
      const row = rowElementsRef.current.get(primarySelectedId);
      if (!container || !row) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      if (rowRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - rowRect.top + 6;
      } else if (rowRect.bottom > containerRect.bottom) {
        container.scrollTop += rowRect.bottom - containerRect.bottom + 6;
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [primarySelectedId, visibleItems]);

  if (props.sceneItems.length === 0) {
    return <div className="properties-empty">No placed objects yet.</div>;
  }

  const canPromote = (itemId: string) => {
    return (actualItemsById.get(itemId)?.parentId ?? null) !== null;
  };

  const canDemote = (itemId: string) => {
    const item = actualItemsById.get(itemId);
    if (!item) {
      return false;
    }
    const siblings = props.sceneItems.filter((candidate) => candidate.parentId === item.parentId);
    const itemIndex = siblings.findIndex((candidate) => candidate.id === item.id);
    if (itemIndex <= 0) {
      return false;
    }

    for (let index = itemIndex - 1; index >= 0; index -= 1) {
      if (siblings[index]?.type === "group") {
        return true;
      }
    }

    return false;
  };

  const applyTreeSelection = (
    itemId: string,
    event: Pick<MouseEvent<HTMLButtonElement>, "shiftKey" | "ctrlKey" | "metaKey">,
  ) => {
    const additive = event.ctrlKey || event.metaKey;

    if (event.shiftKey) {
      const anchorId = selectionAnchorId && visibleItems.some((item) => item.id === selectionAnchorId) ? selectionAnchorId : itemId;
      const anchorIndex = visibleItems.findIndex((item) => item.id === anchorId);
      const itemIndex = visibleItems.findIndex((item) => item.id === itemId);
      if (anchorIndex >= 0 && itemIndex >= 0) {
        const rangeIds = visibleItems
          .slice(Math.min(anchorIndex, itemIndex), Math.max(anchorIndex, itemIndex) + 1)
          .map((item) => item.id);
        props.onSceneItemSelect(additive ? Array.from(new Set([...selectedIds, ...rangeIds])) : rangeIds, itemId);
        return;
      }
    }

    if (additive) {
      const nextIds = selectedIdSet.has(itemId)
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId];
      setSelectionAnchorId(itemId);
      props.onSceneItemSelect(nextIds, nextIds.includes(itemId) ? itemId : nextIds[nextIds.length - 1] ?? null);
      return;
    }

    setSelectionAnchorId(itemId);
    props.onSceneItemSelect([itemId], itemId);
  };

  return (
    <TreeView
      items={visibleItems}
      emptyMessage="No scene items match the current filter."
      className="scene-list"
      containerRef={listContainerRef}
      getKey={(item) => item.id}
      renderItem={(item) => (
        <div
          key={item.id}
          ref={(element) => {
            if (element) {
              rowElementsRef.current.set(item.id, element);
            } else {
              rowElementsRef.current.delete(item.id);
            }
          }}
          className={`scene-row${item.selected ? " is-active" : ""}${item.hidden ? " is-hidden" : ""}${dragTarget?.id === item.id ? " is-drag-over" : ""}${dragTarget?.id === item.id && dragTarget.mode === "into" ? " is-drag-into" : ""}${dragTarget?.id === item.id && dragTarget.mode === "before" ? " is-drag-before" : ""}`}
          onDragOver={(event) => {
            if (props.sceneSortMode !== "manual" || !draggedId || draggedId === item.id) {
              return;
            }
            event.preventDefault();
            setDragTarget({ id: item.id, mode: item.type === "group" ? "into" : "before" });
          }}
          onDragLeave={() => {
            if (dragTarget?.id === item.id) {
              setDragTarget(null);
            }
          }}
          onDrop={(event) => {
            if (props.sceneSortMode !== "manual" || !draggedId || draggedId === item.id) {
              return;
            }
            event.preventDefault();
            props.onSceneItemMove(draggedId, item.id);
            setDraggedId(null);
            setDragTarget(null);
          }}
          onDragEnd={() => {
            setDraggedId(null);
            setDragTarget(null);
          }}
          style={{ marginLeft: `${item.depth * 14}px` }}
        >
          <div
            role="button"
            tabIndex={-1}
            className={`scene-row-handle${props.sceneSortMode === "manual" ? " is-enabled" : ""}`}
            aria-label={props.sceneSortMode === "manual" ? `Drag ${item.label}` : "Manual sort only"}
            title={props.sceneSortMode === "manual" ? "Drag to reorder" : "Switch to Manual sort to drag"}
            draggable={props.sceneSortMode === "manual" && editingId !== item.id}
            onDragStart={(event) => {
              if (props.sceneSortMode !== "manual" || editingId === item.id) {
                event.preventDefault();
                return;
              }
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
              setDraggedId(item.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDragTarget(null);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <DragHandleIcon className="tool-icon" />
          </div>
          {dragTarget?.id === item.id ? (
            <span className={`scene-row-drop-hint scene-row-drop-hint-${dragTarget.mode}`}>
              {dragTarget.mode === "into" ? "Drop into group" : "Drop before item"}
            </span>
          ) : null}
          <button
            type="button"
            className="scene-row-main"
            onClick={(event) => {
              applyTreeSelection(item.id, event);
            }}
          >
            {editingId === item.id ? (
              <input
                className="scene-row-input"
                type="text"
                value={editingName}
                autoFocus
                onChange={(event) => {
                  setEditingName(event.target.value);
                }}
                onBlur={() => {
                  commitRename(item.id);
                }}
                onKeyDown={(event) => {
                  handleRenameKeyDown(event, item.id);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              />
            ) : (
              <span className="scene-row-title-row">
                {item.type === "group" ? (
                  <button
                    type="button"
                    className={`scene-row-collapse${collapsedGroupIds.includes(item.id) ? " is-collapsed" : ""}`}
                    aria-label={collapsedGroupIds.includes(item.id) ? `Expand ${item.label}` : `Collapse ${item.label}`}
                    title={collapsedGroupIds.includes(item.id) ? "Expand children" : "Collapse children"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCollapsedGroupIds((current) =>
                        current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
                      );
                    }}
                  >
                    <ChevronRightIcon className="tool-icon" />
                  </button>
                ) : (
                  <span className="scene-row-collapse-spacer" aria-hidden="true"></span>
                )}
                <span className="scene-row-title">{item.label}</span>
                <span className={`scene-row-kind scene-row-kind-${item.type}`}>{item.type === "group" ? "Group" : "Object"}</span>
                {item.type === "group" && item.childCount !== null ? (
                  <span className="scene-row-kind scene-row-kind-count">{item.childCount}</span>
                ) : null}
                {item.type === "object" && item.placementKind ? (
                  <span className={`scene-row-kind scene-row-kind-placement scene-row-kind-${item.placementKind}`}>
                    {item.placementKind === "instance" ? "Instance" : "Clone"}
                  </span>
                ) : null}
              </span>
            )}
          </button>
          <div className="scene-row-actions">
            {item.type === "object" ? <button
              type="button"
              className="scene-row-action"
              aria-label={`Duplicate ${item.assetName}`}
              title="Duplicate"
              onClick={() => {
                props.onSceneItemDuplicate(item.id);
              }}
            >
              <DuplicateIcon className="tool-icon" />
            </button> : null}
            <button
              type="button"
              className="scene-row-action"
              aria-label={`Promote ${item.label}`}
              title="Promote"
              disabled={!canPromote(item.id)}
              onClick={() => {
                props.onSceneItemPromote(item.id);
              }}
            >
              <PromoteIcon className="tool-icon" />
            </button>
            <button
              type="button"
              className="scene-row-action"
              aria-label={`Demote ${item.label}`}
              title="Demote"
              disabled={!canDemote(item.id)}
              onClick={() => {
                props.onSceneItemDemote(item.id);
              }}
            >
              <DemoteIcon className="tool-icon" />
            </button>
            {item.type === "object" && item.parentId ? <button
              type="button"
              className="scene-row-action"
              aria-label={`Ungroup ${item.assetName}`}
              title="Remove from group"
              onClick={() => {
                props.onSceneItemUngroup(item.id);
              }}
            >
              <UngroupIcon className="tool-icon" />
            </button> : null}
            {item.type === "group" && item.parentId ? <button
              type="button"
              className="scene-row-action"
              aria-label={`Remove ${item.label} from parent group`}
              title="Remove from parent group"
              onClick={() => {
                props.onSceneItemUnchildGroup(item.id);
              }}
            >
              <UngroupIcon className="tool-icon" />
            </button> : null}
            <button
              type="button"
              className="scene-row-action"
              aria-label={`Rename ${item.label}`}
              title="Rename"
              onClick={() => {
                setEditingId(item.id);
                setEditingName(item.label);
              }}
            >
              <RenameIcon className="tool-icon" />
            </button>
            <button
              type="button"
              className={`scene-row-action${item.hidden ? " is-toggled" : ""}`}
              aria-label={`${item.hidden ? "Show" : "Hide"} ${item.label}`}
              title={item.hidden ? "Show" : "Hide"}
              onClick={() => {
                props.onSceneItemToggleHidden(item.id);
              }}
            >
              {item.hidden ? <ShowIcon className="tool-icon" /> : <HideIcon className="tool-icon" />}
            </button>
            <button
              type="button"
              className={`scene-row-action${item.locked ? " is-toggled" : ""}`}
              aria-label={`${item.locked ? "Unlock" : "Lock"} ${item.label}`}
              title={item.locked ? "Unlock" : "Lock"}
              onClick={() => {
                props.onSceneItemToggleLocked(item.id);
              }}
            >
              {item.locked ? <LockIcon className="tool-icon" /> : <UnlockIcon className="tool-icon" />}
            </button>
            <button
              type="button"
              className="scene-row-action"
              aria-label={`Frame ${item.label}`}
              title="Frame"
              onClick={() => {
                props.onSceneItemFrame(item.id);
              }}
            >
              <FocusIcon className="tool-icon" />
            </button>
            <button
              type="button"
              className="scene-row-action scene-row-action-danger"
              aria-label={`Delete ${item.assetName}`}
              title="Delete"
              onClick={() => {
                props.onSceneItemDelete(item.id);
              }}
            >
              <TrashIcon className="tool-icon" />
            </button>
            {item.locked || item.hidden ? (
              <span className="scene-row-meta">
                {item.locked ? <span className="scene-row-meta-locked">Locked</span> : null}
                {item.hidden ? <span className="scene-row-meta-hidden">Hidden</span> : null}
              </span>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}

interface AssetSidebarProps {
  searchQuery: string;
  availableLibraries: AssetLibraryBundle[];
  activeLibraryId: string;
  availableCategories: string[];
  activeCategory: AssetCategory | "All";
  filteredAssets: AssetDefinition[];
  viewState: EditorViewState;
  onSearchQueryChange: (value: string) => void;
  onActiveLibraryChange: (value: string) => void;
  onRefreshLibraries: () => void;
  onActiveCategoryChange: (value: AssetCategory | "All") => void;
  onAssetClick: (libraryId: string, assetId: string) => void;
}

function AssetSidebar(props: AssetSidebarProps) {
  return (
      <aside className="sidebar sidebar-left">
        <div className="sidebar-section">
          <label className="panel-label" htmlFor="asset-search">
            Assets
          </label>
          <label className="panel-label" htmlFor="asset-library">
            Library
          </label>
          <div className="library-select-row">
            <select
              id="asset-library"
              className="filter-select"
              value={props.activeLibraryId}
              onChange={(event) => {
                props.onActiveLibraryChange(event.target.value);
              }}
            >
              {props.availableLibraries.map((bundle) => (
                <option key={bundle.library.id} value={bundle.library.id}>
                  {bundle.meta.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tool-button tool-button-icon-only"
              aria-label="Refresh libraries"
              title="Refresh libraries"
              onClick={props.onRefreshLibraries}
            >
              <RedoIcon className="tool-icon" />
            </button>
          </div>
          <FilterBar
            className="filter-bar-compact"
            searchId="asset-search"
            searchPlaceholder="Search assets"
            searchValue={props.searchQuery}
            onSearchChange={props.onSearchQueryChange}
            chips={{
              selectedValue: props.activeCategory,
              options: [
                { value: "All", label: "All" },
                ...props.availableCategories.map((category) => ({ value: category, label: category })),
              ],
              onChange: props.onActiveCategoryChange,
            }}
        />
      </div>
      <AssetList
        libraryId={props.activeLibraryId}
        assets={props.filteredAssets}
        activeAssetId={props.viewState.activeAssetId}
        activeAssetLibraryId={props.viewState.activeAssetLibraryId}
        onAssetClick={props.onAssetClick}
      />
    </aside>
  );
}

interface RightSidebarProps {
  viewState: EditorViewState;
  width: number;
  sceneSortMode: SceneSortMode;
  onSceneSortModeChange: (mode: SceneSortMode) => void;
  onResizeStart: (clientX: number) => void;
  onCreateEmptyGroup: () => void;
  onCreateGroupFromSelected: () => void;
  onSceneItemMove: (draggedId: string, targetId: string) => void;
  onSceneItemSelect: (selectionIds: string[], primaryId: string | null) => void;
  onSceneItemFrame: (objectId: string) => void;
  onSceneItemDelete: (objectId: string) => void;
  onSceneItemDuplicate: (objectId: string) => void;
  onSceneItemRename: (objectId: string, nextName: string) => void;
  onSceneItemToggleHidden: (objectId: string) => void;
  onSceneItemToggleLocked: (objectId: string) => void;
  onSceneItemPromote: (objectId: string) => void;
  onSceneItemDemote: (objectId: string) => void;
  onSceneItemUngroup: (objectId: string) => void;
  onSceneItemUnchildGroup: (groupId: string) => void;
  onCreateGroupFromSelected: () => void;
  onToggleSelectedHidden: () => void;
  onToggleSelectedLocked: () => void;
  onSelectionPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionRotationChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionDropToGround: () => void;
}

function RightSidebar(props: RightSidebarProps) {
  const [sceneSearchQuery, setSceneSearchQuery] = useState("");
  const [sceneItemTypeFilter, setSceneItemTypeFilter] = useState<"all" | "object" | "group">("all");
  const [sceneVisibilityFilter, setSceneVisibilityFilter] = useState<"all" | "visible" | "hidden">("all");
  const [sceneLockFilter, setSceneLockFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [showSceneSearch, setShowSceneSearch] = useState(true);
  const [showSceneFilters, setShowSceneFilters] = useState(true);

  return (
    <aside className="sidebar sidebar-right" style={{ width: `${props.width}px` }}>
      <button
        type="button"
        className="sidebar-resize-handle"
        aria-label="Resize right sidebar"
        onPointerDown={(event) => {
          event.preventDefault();
          props.onResizeStart(event.clientX);
        }}
      />
      <div className="sidebar-section sidebar-scene">
        <div className="sidebar-header-row">
          <div className="panel-label">{`Scene${props.viewState.objectCount ? ` (${props.viewState.objectCount})` : ""}`}</div>
          <div className="scene-header-actions">
            <button type="button" className="scene-header-button" onClick={props.onCreateEmptyGroup} title="Create empty group">
              <GroupAddIcon className="tool-icon" />
            </button>
            <button type="button" className="scene-header-button" onClick={props.onCreateGroupFromSelected} title="Group selected">
              <GroupIcon className="tool-icon" />
            </button>
            <select
              className="scene-sort-select"
              value={props.sceneSortMode}
              onChange={(event) => {
                props.onSceneSortModeChange(event.target.value as SceneSortMode);
              }}
            >
              <option value="manual">Manual</option>
              <option value="name">Name</option>
              <option value="asset">Asset</option>
            </select>
          </div>
        </div>
        <div className="scene-filter-panel">
          <FilterBar
            className="filter-bar-compact"
            hideSearch={!showSceneSearch}
            searchId="scene-search"
            searchPlaceholder="Search scene items"
            searchValue={sceneSearchQuery}
            onSearchChange={setSceneSearchQuery}
            searchActions={
              <>
                <button
                  type="button"
                  className={`scene-filter-toggle${showSceneFilters ? " is-active" : ""}`}
                  disabled={!showSceneSearch}
                  onClick={() => {
                    if (showSceneFilters) {
                      setSceneItemTypeFilter("all");
                      setSceneVisibilityFilter("all");
                      setSceneLockFilter("all");
                    }
                    setShowSceneFilters((value) => !value);
                  }}
                >
                  {showSceneFilters ? "Hide Filters" : "Show Filters"}
                </button>
                <button
                  type="button"
                  className={`scene-filter-toggle${showSceneSearch ? " is-active" : ""}`}
                  onClick={() => {
                    if (showSceneSearch) {
                      setSceneSearchQuery("");
                      setShowSceneFilters(false);
                      setSceneItemTypeFilter("all");
                      setSceneVisibilityFilter("all");
                      setSceneLockFilter("all");
                    }
                    setShowSceneSearch((value) => !value);
                  }}
                >
                  {showSceneSearch ? "Hide Search" : "Show Search"}
                </button>
              </>
            }
            selects={
              showSceneSearch && showSceneFilters
                ? [
                    {
                      label: "Item",
                      value: sceneItemTypeFilter,
                      options: [
                        { value: "all", label: "All" },
                        { value: "object", label: "Objects" },
                        { value: "group", label: "Groups" },
                      ],
                      onChange: setSceneItemTypeFilter,
                    },
                    {
                      label: "Visible",
                      value: sceneVisibilityFilter,
                      options: [
                        { value: "all", label: "All" },
                        { value: "visible", label: "Visible" },
                        { value: "hidden", label: "Hidden" },
                      ],
                      onChange: setSceneVisibilityFilter,
                    },
                    {
                      label: "Lock",
                      value: sceneLockFilter,
                      options: [
                        { value: "all", label: "All" },
                        { value: "unlocked", label: "Unlocked" },
                        { value: "locked", label: "Locked" },
                      ],
                      onChange: setSceneLockFilter,
                    },
                  ]
                : undefined
            }
          />
        </div>
        <div className="scene-list-panel">
          <SceneList
            sceneItems={props.viewState.sceneItems}
            sceneSortMode={props.sceneSortMode}
            searchQuery={sceneSearchQuery}
            itemTypeFilter={sceneItemTypeFilter}
            visibilityFilter={sceneVisibilityFilter}
            lockFilter={sceneLockFilter}
            onSceneItemMove={props.onSceneItemMove}
            onSceneItemSelect={props.onSceneItemSelect}
            onSceneItemFrame={props.onSceneItemFrame}
            onSceneItemDelete={props.onSceneItemDelete}
            onSceneItemDuplicate={props.onSceneItemDuplicate}
            onSceneItemRename={props.onSceneItemRename}
            onSceneItemToggleHidden={props.onSceneItemToggleHidden}
            onSceneItemToggleLocked={props.onSceneItemToggleLocked}
            onSceneItemPromote={props.onSceneItemPromote}
            onSceneItemDemote={props.onSceneItemDemote}
            onSceneItemUngroup={props.onSceneItemUngroup}
            onSceneItemUnchildGroup={props.onSceneItemUnchildGroup}
          />
        </div>
      </div>
      <div className="sidebar-section sidebar-properties">
        <div className="panel-label">
          {`Selection${props.viewState.selectionCount ? ` (${props.viewState.selectionCount})` : ""}`}
        </div>
        <div className="properties-panel">
          <SelectionPanel
            viewState={props.viewState}
            onCreateGroupFromSelected={props.onCreateGroupFromSelected}
            onToggleSelectedHidden={props.onToggleSelectedHidden}
            onToggleSelectedLocked={props.onToggleSelectedLocked}
            onSelectionPositionChange={props.onSelectionPositionChange}
            onSelectionRotationChange={props.onSelectionRotationChange}
            onSelectionDropToGround={props.onSelectionDropToGround}
          />
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

function LoadingOverlay({ visible }: { visible: boolean }) {
  return (
    <div className={`shell-loader${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
      <div className="shell-loader-card">
        <div className="shell-loader-mark">
          <SnapIcon className="shell-loader-icon" />
        </div>
        <div className="shell-loader-copy">
          <div className="shell-loader-title">[Snap]</div>
          <div className="shell-loader-subtitle">Loading workspace</div>
        </div>
        <div className="shell-loader-meter" role="presentation">
          <span className="shell-loader-meter-fill"></span>
        </div>
      </div>
    </div>
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
          {status.snapEnabled
            ? `${status.gridSize}u${status.ySnapEnabled ? " +Y" : ""} | ${status.rotationStepDegrees}deg ${status.rotationAxis.toUpperCase()}`
            : `Free${status.ySnapEnabled ? " +Y" : ""} | ${status.rotationStepDegrees}deg ${status.rotationAxis.toUpperCase()}`}
        </span>
      </span>
      <span>
        <strong>Objects</strong> <span>{viewState.objectCount}</span>
      </span>
      <span>
        <strong>Draw Calls</strong> <span>{status.drawCalls}</span>
      </span>
      <span>
        <strong>Materials</strong> <span>{status.materials}</span>
      </span>
      <span>
        <strong>Textures</strong> <span>{status.textures}</span>
      </span>
      <span>
        <strong>Vertices</strong> <span>{status.totalVertices.toLocaleString()}</span>
      </span>
      <span className="statusbar-hint">{status.hint}</span>
    </footer>
  );
}

interface EditorShellProps {
  isLoading: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  availableLibraries: AssetLibraryBundle[];
  activeLibraryId: string;
  availableCategories: string[];
  activeCategory: AssetCategory | "All";
  filteredAssets: AssetDefinition[];
  exportMenuOpen: boolean;
  settingsMenuOpen: boolean;
  sceneSortMode: SceneSortMode;
  viewState: EditorViewState;
  onSearchQueryChange: (value: string) => void;
  onActiveLibraryChange: (value: string) => void;
  onRefreshLibraries: () => void;
  onActiveCategoryChange: (value: AssetCategory | "All") => void;
  onAssetClick: (libraryId: string, assetId: string) => void;
  onSceneItemSelect: (selectionIds: string[], primaryId: string | null) => void;
  onSceneItemMove: (draggedId: string, targetId: string) => void;
  onSceneItemFrame: (objectId: string) => void;
  onSceneItemDelete: (objectId: string) => void;
  onSceneItemDuplicate: (objectId: string) => void;
  onSceneItemRename: (objectId: string) => void;
  onSceneItemToggleHidden: (objectId: string) => void;
  onSceneItemToggleLocked: (objectId: string) => void;
  onSceneItemPromote: (objectId: string) => void;
  onSceneItemDemote: (objectId: string) => void;
  onSceneItemUngroup: (objectId: string) => void;
  onSceneItemUnchildGroup: (groupId: string) => void;
  onToggleSelectedHidden: () => void;
  onToggleSelectedLocked: () => void;
  onToggleSnap: () => void;
  onToggleYSnap: () => void;
  onSelectMode: () => void;
  onPlaceMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveScene: () => void;
  onExportJson: () => void;
  onExportGlb: () => void;
  onExportGltf: () => void;
  onImportJson: () => void;
  onImportFile: (file: File) => void;
  onLoadLastSaved: () => void;
  onLoadAutosave: () => void;
  onDeleteSelected: () => void;
  onClearScene: () => void;
  onGridSizeChange: (value: number) => void;
  onRotationStepChange: (value: number) => void;
  onRotationAxisChange: (value: "x" | "y" | "z") => void;
  onToggleExportMenu: () => void;
  onToggleSettingsMenu: () => void;
  onEnvironmentToggle: (enabled: boolean) => void;
  onEnvironmentIntensityChange: (value: number) => void;
  onLightIntensityChange: (value: number) => void;
  onCameraCloseLimitChange: (value: number) => void;
  onGridVisibleChange: (visible: boolean) => void;
  onGridRenderModeChange: (value: "material" | "lines") => void;
  onGridColorChange: (value: string) => void;
  onGroundColorChange: (value: string) => void;
  onFreezeModelMaterialsChange: (value: boolean) => void;
  onNewObjectPlacementKindChange: (value: "clone" | "instance") => void;
  onHeightLabelModeChange: (value: "transform" | "geometry") => void;
  onSaveOnEveryUiUpdateChange: (value: boolean) => void;
  onAutosaveEnabledChange: (value: boolean) => void;
  onAutosaveIntervalChange: (value: number) => void;
  onGridPlaneSizeChange: (value: number) => void;
  onRetuneCamera: () => void;
  onRestoreDefaults: () => void;
  onSceneSortModeChange: (mode: SceneSortMode) => void;
  onCreateEmptyGroup: () => void;
  onCreateGroupFromSelected: () => void;
  onSelectionPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionRotationChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionDropToGround: () => void;
}

export function EditorShell(props: EditorShellProps) {
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    try {
      const raw = window.localStorage.getItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : 300;
      return Number.isFinite(parsed)
        ? Math.min(RIGHT_SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, parsed))
        : 300;
    } catch {
      return 300;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(RIGHT_SIDEBAR_WIDTH_STORAGE_KEY, String(rightSidebarWidth));
    } catch {
      // Ignore persistence failures so resizing still works.
    }
  }, [rightSidebarWidth]);

  const startRightSidebarResize = (startClientX: number) => {
    const initialWidth = rightSidebarWidth;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = startClientX - event.clientX;
      setRightSidebarWidth(
        Math.min(RIGHT_SIDEBAR_MAX_WIDTH, Math.max(RIGHT_SIDEBAR_MIN_WIDTH, initialWidth + delta)),
      );
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <section className="shell">
      <LoadingOverlay visible={props.isLoading} />
      <EditorToolbar
        viewState={props.viewState}
        exportMenuOpen={props.exportMenuOpen}
        settingsMenuOpen={props.settingsMenuOpen}
        importInputRef={props.importInputRef}
        onToggleSnap={props.onToggleSnap}
        onToggleYSnap={props.onToggleYSnap}
        onSelectMode={props.onSelectMode}
        onPlaceMode={props.onPlaceMode}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onSaveScene={props.onSaveScene}
        onExportJson={props.onExportJson}
        onExportGlb={props.onExportGlb}
        onExportGltf={props.onExportGltf}
        onImportJson={props.onImportJson}
        onImportFile={props.onImportFile}
        onLoadLastSaved={props.onLoadLastSaved}
        onLoadAutosave={props.onLoadAutosave}
        onDeleteSelected={props.onDeleteSelected}
        onClearScene={props.onClearScene}
        onGridSizeChange={props.onGridSizeChange}
        onRotationStepChange={props.onRotationStepChange}
        onRotationAxisChange={props.onRotationAxisChange}
        onToggleExportMenu={props.onToggleExportMenu}
        onToggleSettingsMenu={props.onToggleSettingsMenu}
        onEnvironmentToggle={props.onEnvironmentToggle}
        onEnvironmentIntensityChange={props.onEnvironmentIntensityChange}
        onLightIntensityChange={props.onLightIntensityChange}
        onCameraCloseLimitChange={props.onCameraCloseLimitChange}
        onGridVisibleChange={props.onGridVisibleChange}
        onGridRenderModeChange={props.onGridRenderModeChange}
        onGridColorChange={props.onGridColorChange}
        onGroundColorChange={props.onGroundColorChange}
        onFreezeModelMaterialsChange={props.onFreezeModelMaterialsChange}
        onNewObjectPlacementKindChange={props.onNewObjectPlacementKindChange}
        onHeightLabelModeChange={props.onHeightLabelModeChange}
        onSaveOnEveryUiUpdateChange={props.onSaveOnEveryUiUpdateChange}
        onAutosaveEnabledChange={props.onAutosaveEnabledChange}
        onAutosaveIntervalChange={props.onAutosaveIntervalChange}
        onGridPlaneSizeChange={props.onGridPlaneSizeChange}
        onRetuneCamera={props.onRetuneCamera}
        onRestoreDefaults={props.onRestoreDefaults}
      />
      <div
        className="workspace"
        style={{ gridTemplateColumns: `300px minmax(0, 1fr) ${rightSidebarWidth}px` }}
      >
        <AssetSidebar
          searchQuery={props.searchQuery}
          availableLibraries={props.availableLibraries}
          activeLibraryId={props.activeLibraryId}
          availableCategories={props.availableCategories}
          activeCategory={props.activeCategory}
          filteredAssets={props.filteredAssets}
          viewState={props.viewState}
          onSearchQueryChange={props.onSearchQueryChange}
          onActiveLibraryChange={props.onActiveLibraryChange}
          onRefreshLibraries={props.onRefreshLibraries}
          onActiveCategoryChange={props.onActiveCategoryChange}
          onAssetClick={props.onAssetClick}
        />
        <ViewportPanel canvasRef={props.canvasRef} />
        <RightSidebar
          viewState={props.viewState}
          width={rightSidebarWidth}
          sceneSortMode={props.sceneSortMode}
          onSceneSortModeChange={props.onSceneSortModeChange}
          onResizeStart={startRightSidebarResize}
          onCreateEmptyGroup={props.onCreateEmptyGroup}
          onCreateGroupFromSelected={props.onCreateGroupFromSelected}
          onSceneItemMove={props.onSceneItemMove}
          onSceneItemSelect={props.onSceneItemSelect}
          onSceneItemFrame={props.onSceneItemFrame}
          onSceneItemDelete={props.onSceneItemDelete}
          onSceneItemDuplicate={props.onSceneItemDuplicate}
          onSceneItemRename={props.onSceneItemRename}
          onSceneItemToggleHidden={props.onSceneItemToggleHidden}
          onSceneItemToggleLocked={props.onSceneItemToggleLocked}
          onSceneItemPromote={props.onSceneItemPromote}
          onSceneItemDemote={props.onSceneItemDemote}
          onSceneItemUngroup={props.onSceneItemUngroup}
          onSceneItemUnchildGroup={props.onSceneItemUnchildGroup}
          onToggleSelectedHidden={props.onToggleSelectedHidden}
          onToggleSelectedLocked={props.onToggleSelectedLocked}
          onSelectionPositionChange={props.onSelectionPositionChange}
          onSelectionRotationChange={props.onSelectionRotationChange}
          onSelectionDropToGround={props.onSelectionDropToGround}
        />
      </div>
      <StatusBar viewState={props.viewState} />
    </section>
  );
}

export function filterAssets(assets: AssetDefinition[], query: string, activeCategory: AssetCategory | "All") {
  const normalized = query.trim().toLowerCase();
  return assets.filter((asset) => {
    const matchesCategory = activeCategory === "All" || asset.category === activeCategory;
    const haystack = `${asset.name} ${asset.category} ${asset.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !normalized || haystack.includes(normalized);
    return matchesCategory && matchesQuery;
  });
}
