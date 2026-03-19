import { useEffect, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { ASSETS, ASSET_CATEGORIES, type AssetCategory, type AssetDefinition } from "../assets";
import type { EditorViewState } from "../editor/view-state";
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
  UngroupIcon,
  UnlockIcon,
} from "./icons";

function getAssetThumbnailUrl(asset: AssetDefinition) {
  return `/generated/asset-previews/${asset.fileName.replace(/\.[^.]+$/u, ".png")}`;
}

export type SceneSortMode = "manual" | "name" | "asset";

const RIGHT_SIDEBAR_WIDTH_STORAGE_KEY = "snap:right-sidebar-width";
const RIGHT_SIDEBAR_MIN_WIDTH = 240;
const RIGHT_SIDEBAR_MAX_WIDTH = 520;

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
  onEnvironmentIntensityChange: (value: number) => void;
  onLightIntensityChange: (value: number) => void;
  onGridVisibleChange: (visible: boolean) => void;
  onGridColorChange: (value: string) => void;
  onGroundColorChange: (value: string) => void;
  onNewObjectPlacementKindChange: (value: "clone" | "instance") => void;
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
            <span>Snap</span>
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
        <button type="button" className="tool-button" onClick={props.onSaveScene}>
          <span className="tool-button-content">
            <SaveIcon className="tool-icon" />
            <span>Save</span>
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
            <div className="toolbar-menu-meta">
              <span>Last Saved</span>
              <strong>{formatSavedAt(props.viewState.lastManualSaveAt)}</strong>
            </div>
            <div className="toolbar-menu-meta">
              <span>Autosave Recovered</span>
              <strong>{formatSavedAt(props.viewState.lastRecoveredAutosaveAt)}</strong>
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
  onCreateGroupFromSelected: () => void;
  onToggleSelectedHidden: () => void;
  onToggleSelectedLocked: () => void;
  onSelectionPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionRotationChange: (value: number) => void;
  onSelectionDropToGround: () => void;
}

function SelectionPanel(props: SelectionPanelProps) {
  const { selection } = props.viewState;
  const [draftPosition, setDraftPosition] = useState({ x: "", y: "", z: "" });
  const [draftRotation, setDraftRotation] = useState("");

  useEffect(() => {
    const [x, y, z] = selection.position ?? [null, null, null];
    setDraftPosition({
      x: x === null ? "" : x.toFixed(2),
      y: y === null ? "" : y.toFixed(2),
      z: z === null ? "" : z.toFixed(2),
    });
    setDraftRotation(selection.rotationYDegrees === null ? "" : selection.rotationYDegrees.toFixed(0));
  }, [selection.position, selection.rotationYDegrees, selection.selectedObjectId]);

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

  const commitRotation = () => {
    const raw = draftRotation.trim();
    if (!raw) {
      return;
    }

    const nextValue = Number(raw);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    props.onSelectionRotationChange(nextValue);
  };

  const resetDrafts = () => {
    const [x, y, z] = selection.position ?? [null, null, null];
    setDraftPosition({
      x: x === null ? "" : x.toFixed(2),
      y: y === null ? "" : y.toFixed(2),
      z: z === null ? "" : z.toFixed(2),
    });
    setDraftRotation(selection.rotationYDegrees === null ? "" : selection.rotationYDegrees.toFixed(0));
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
              step="0.25"
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
      <div className="transform-fields transform-fields-single">
        <label className="transform-field">
          <span>Y</span>
          <input
            className="transform-input"
            type="number"
            step="15"
            value={draftRotation}
            onChange={(event) => {
              setDraftRotation(event.target.value);
            }}
            onBlur={commitRotation}
            onKeyDown={(event) => {
              handleTransformFieldKeyDown(event, commitRotation);
            }}
          />
        </label>
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
  viewState: EditorViewState;
  sceneSortMode: SceneSortMode;
  onSceneItemMove: (draggedId: string, targetId: string) => void;
  onSceneItemSelect: (selectionIds: string[], primaryId: string | null) => void;
  onSceneItemFrame: (objectId: string) => void;
  onSceneItemDelete: (objectId: string) => void;
  onSceneItemDuplicate: (objectId: string) => void;
  onSceneItemRename: (objectId: string, nextName: string) => void;
  onSceneItemToggleHidden: (objectId: string) => void;
  onSceneItemToggleLocked: (objectId: string) => void;
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

  if (props.viewState.sceneItems.length === 0) {
    return <div className="properties-empty">No placed objects yet.</div>;
  }

  const sortedItems = [...props.viewState.sceneItems];
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
  const visibleItems = sortedItems.filter((item) => {
    let currentParentId = item.parentId;
    while (currentParentId) {
      if (collapsedGroupIds.includes(currentParentId)) {
        return false;
      }
      currentParentId = itemsById.get(currentParentId)?.parentId ?? null;
    }

    return true;
  });

  const selectedIds = props.viewState.sceneItems.filter((item) => item.selected).map((item) => item.id);
  const selectedIdSet = new Set(selectedIds);

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
    <div className="scene-list">
      {visibleItems.map((item) => (
        <div
          key={item.id}
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
      ))}
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
    <aside className="sidebar sidebar-left">
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
  onSceneItemUngroup: (objectId: string) => void;
  onSceneItemUnchildGroup: (groupId: string) => void;
  onCreateGroupFromSelected: () => void;
  onToggleSelectedHidden: () => void;
  onToggleSelectedLocked: () => void;
  onSelectionPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionRotationChange: (value: number) => void;
  onSelectionDropToGround: () => void;
}

function RightSidebar(props: RightSidebarProps) {
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
        <SceneList
          viewState={props.viewState}
          sceneSortMode={props.sceneSortMode}
          onSceneItemMove={props.onSceneItemMove}
          onSceneItemSelect={props.onSceneItemSelect}
          onSceneItemFrame={props.onSceneItemFrame}
          onSceneItemDelete={props.onSceneItemDelete}
          onSceneItemDuplicate={props.onSceneItemDuplicate}
          onSceneItemRename={props.onSceneItemRename}
          onSceneItemToggleHidden={props.onSceneItemToggleHidden}
          onSceneItemToggleLocked={props.onSceneItemToggleLocked}
          onSceneItemUngroup={props.onSceneItemUngroup}
          onSceneItemUnchildGroup={props.onSceneItemUnchildGroup}
        />
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
            ? `${status.gridSize}u${status.ySnapEnabled ? " +Y" : ""} | ${status.rotationStepDegrees}deg`
            : `Free${status.ySnapEnabled ? " +Y" : ""} | ${status.rotationStepDegrees}deg`}
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
  sceneSortMode: SceneSortMode;
  viewState: EditorViewState;
  onSearchQueryChange: (value: string) => void;
  onActiveCategoryChange: (value: AssetCategory | "All") => void;
  onAssetClick: (assetId: string) => void;
  onSceneItemSelect: (selectionIds: string[], primaryId: string | null) => void;
  onSceneItemMove: (draggedId: string, targetId: string) => void;
  onSceneItemFrame: (objectId: string) => void;
  onSceneItemDelete: (objectId: string) => void;
  onSceneItemDuplicate: (objectId: string) => void;
  onSceneItemRename: (objectId: string) => void;
  onSceneItemToggleHidden: (objectId: string) => void;
  onSceneItemToggleLocked: (objectId: string) => void;
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
  onEnvironmentIntensityChange: (value: number) => void;
  onLightIntensityChange: (value: number) => void;
  onGridVisibleChange: (visible: boolean) => void;
  onGridColorChange: (value: string) => void;
  onGroundColorChange: (value: string) => void;
  onNewObjectPlacementKindChange: (value: "clone" | "instance") => void;
  onRestoreDefaults: () => void;
  onSceneSortModeChange: (mode: SceneSortMode) => void;
  onCreateEmptyGroup: () => void;
  onCreateGroupFromSelected: () => void;
  onSelectionPositionChange: (axis: "x" | "y" | "z", value: number) => void;
  onSelectionRotationChange: (value: number) => void;
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
        onEnvironmentIntensityChange={props.onEnvironmentIntensityChange}
        onLightIntensityChange={props.onLightIntensityChange}
        onGridVisibleChange={props.onGridVisibleChange}
        onGridColorChange={props.onGridColorChange}
        onGroundColorChange={props.onGroundColorChange}
        onNewObjectPlacementKindChange={props.onNewObjectPlacementKindChange}
        onRestoreDefaults={props.onRestoreDefaults}
      />
      <div
        className="workspace"
        style={{ gridTemplateColumns: `300px minmax(0, 1fr) ${rightSidebarWidth}px` }}
      >
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

export function filterAssets(query: string, activeCategory: AssetCategory | "All") {
  const normalized = query.trim().toLowerCase();
  return ASSETS.filter((asset) => {
    const matchesCategory = activeCategory === "All" || asset.category === activeCategory;
    const haystack = `${asset.name} ${asset.category} ${asset.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !normalized || haystack.includes(normalized);
    return matchesCategory && matchesQuery;
  });
}
