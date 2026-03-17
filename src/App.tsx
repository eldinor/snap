import { useEffect, useRef, useState } from "react";
import type { AssetCategory } from "./assets";
import { EditorShell, filterAssets } from "./components/editor-shell";
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
      viewState={viewState}
      onSearchQueryChange={setSearchQuery}
      onActiveCategoryChange={setActiveCategory}
      onAssetClick={(assetId) => {
        void appRef.current?.activateAsset(assetId);
      }}
      onToggleSnap={() => {
        appRef.current?.toggleSnap();
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
      onExportJson={() => {
        appRef.current?.exportToFile();
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
    />
  );
}
