import { useEffect, useRef, useState } from "react";
import type { AssetCategory } from "./assets";
import { EditorShell, filterAssets, type SceneSortMode } from "./components/editor-shell";
import { ModularEditorApp } from "./editor";
import { createInitialEditorViewState } from "./editor/view-state";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const appRef = useRef<ModularEditorApp | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<AssetCategory | "All">("All");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [sceneSortMode, setSceneSortMode] = useState<SceneSortMode>("manual");
  const [viewState, setViewState] = useState(createInitialEditorViewState);

  useEffect(() => {
    if (appRef.current || !canvasRef.current) {
      return;
    }

    appRef.current = new ModularEditorApp({
      canvas: canvasRef.current,
      onViewStateChange: setViewState,
    });

    return () => {
      appRef.current?.destroy();
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!settingsMenuOpen && !exportMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest(".toolbar-popover")) {
        return;
      }

      setExportMenuOpen(false);
      setSettingsMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [exportMenuOpen, settingsMenuOpen]);

  const filteredAssets = filterAssets(searchQuery, activeCategory);

  return (
    <EditorShell
      canvasRef={canvasRef}
      importInputRef={importInputRef}
      searchQuery={searchQuery}
      activeCategory={activeCategory}
      filteredAssets={filteredAssets}
      exportMenuOpen={exportMenuOpen}
      settingsMenuOpen={settingsMenuOpen}
      sceneSortMode={sceneSortMode}
      viewState={viewState}
      onSearchQueryChange={setSearchQuery}
      onActiveCategoryChange={setActiveCategory}
      onAssetClick={(assetId) => {
        void appRef.current?.activateAsset(assetId);
      }}
      onSceneItemSelect={(selectionIds, primaryId) => {
        appRef.current?.setSceneItemSelection(selectionIds, primaryId);
      }}
      onSceneItemMove={(draggedId, targetId) => {
        appRef.current?.moveSceneItem(draggedId, targetId);
      }}
      onSceneItemFrame={(objectId) => {
        appRef.current?.frameSceneItem(objectId);
      }}
      onSceneItemDelete={(objectId) => {
        appRef.current?.deleteSceneItem(objectId);
      }}
      onSceneItemDuplicate={(objectId) => {
        appRef.current?.duplicateSceneItem(objectId);
      }}
      onSceneItemRename={(objectId, nextName) => {
        appRef.current?.renameSceneItem(objectId, nextName);
      }}
      onSceneItemToggleHidden={(objectId) => {
        appRef.current?.toggleSceneItemHidden(objectId);
      }}
      onSceneItemToggleLocked={(objectId) => {
        appRef.current?.toggleSceneItemLocked(objectId);
      }}
      onSceneItemPromote={(objectId) => {
        appRef.current?.promoteSceneItem(objectId);
      }}
      onSceneItemDemote={(objectId) => {
        appRef.current?.demoteSceneItem(objectId);
      }}
      onSceneItemUngroup={(objectId) => {
        appRef.current?.ungroupSceneItem(objectId);
      }}
      onSceneItemUnchildGroup={(groupId) => {
        appRef.current?.unchildGroup(groupId);
      }}
      onToggleSelectedHidden={() => {
        appRef.current?.toggleSelectedHidden();
      }}
      onToggleSelectedLocked={() => {
        appRef.current?.toggleSelectedLocked();
      }}
      onToggleSnap={() => {
        appRef.current?.toggleSnap();
      }}
      onToggleYSnap={() => {
        appRef.current?.toggleYSnap();
      }}
      onSelectMode={() => {
        appRef.current?.enterSelectionMode();
      }}
      onPlaceMode={() => {
        void appRef.current?.enterPlacementMode();
      }}
      onUndo={() => {
        void appRef.current?.undo();
      }}
      onRedo={() => {
        void appRef.current?.redo();
      }}
      onSaveScene={() => {
        appRef.current?.saveSceneToLocalStorage();
      }}
      onExportJson={() => {
        appRef.current?.exportToFile();
        setExportMenuOpen(false);
      }}
      onExportGlb={() => {
        void appRef.current?.exportToGlb();
        setExportMenuOpen(false);
      }}
      onImportJson={() => {
        importInputRef.current?.click();
        setExportMenuOpen(false);
      }}
      onImportFile={(file) => {
        void appRef.current?.importFromFile(file);
        setExportMenuOpen(false);
      }}
      onLoadLastSaved={() => {
        void appRef.current?.loadLastSavedScene();
        setExportMenuOpen(false);
      }}
      onLoadAutosave={() => {
        void appRef.current?.loadAutosavedScene();
        setExportMenuOpen(false);
      }}
      onDeleteSelected={() => {
        appRef.current?.deleteSelected();
      }}
      onClearScene={() => {
        appRef.current?.clearSceneContents();
      }}
      onGridSizeChange={(value) => {
        appRef.current?.setGridSize(value);
      }}
      onRotationStepChange={(value) => {
        appRef.current?.setRotationStepDegrees(value);
      }}
      onToggleSettingsMenu={() => {
        setExportMenuOpen(false);
        setSettingsMenuOpen((open) => !open);
      }}
      onToggleExportMenu={() => {
        setSettingsMenuOpen(false);
        setExportMenuOpen((open) => !open);
      }}
      onEnvironmentToggle={(enabled) => {
        appRef.current?.setEnvironmentEnabled(enabled);
      }}
      onEnvironmentIntensityChange={(value) => {
        appRef.current?.setEnvironmentIntensity(value);
      }}
      onLightIntensityChange={(value) => {
        appRef.current?.setLightIntensity(value);
      }}
      onGridVisibleChange={(visible) => {
        appRef.current?.setGridVisible(visible);
      }}
      onGridColorChange={(value) => {
        appRef.current?.setGridColor(value);
      }}
      onGroundColorChange={(value) => {
        appRef.current?.setGroundColor(value);
      }}
      onNewObjectPlacementKindChange={(value) => {
        appRef.current?.setNewObjectPlacementKind(value);
      }}
      onHeightLabelModeChange={(value) => {
        appRef.current?.setHeightLabelMode(value);
      }}
      onSaveOnEveryUiUpdateChange={(value) => {
        appRef.current?.setSaveOnEveryUiUpdate(value);
      }}
      onAutosaveEnabledChange={(value) => {
        appRef.current?.setAutosaveEnabled(value);
      }}
      onAutosaveIntervalChange={(value) => {
        appRef.current?.setAutosaveIntervalSeconds(value);
      }}
      onRestoreDefaults={() => {
        appRef.current?.restoreDefaultUserSettings();
      }}
      onSceneSortModeChange={setSceneSortMode}
      onCreateEmptyGroup={() => {
        appRef.current?.createEmptyGroup();
      }}
      onCreateGroupFromSelected={() => {
        appRef.current?.createGroupFromSelected();
      }}
      onSelectionPositionChange={(axis, value) => {
        appRef.current?.setSelectionPosition(axis, value);
      }}
      onSelectionRotationChange={(value) => {
        appRef.current?.setSelectionRotationDegrees(value);
      }}
      onSelectionDropToGround={() => {
        appRef.current?.dropSelectionToGround();
      }}
    />
  );
}
