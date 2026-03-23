import { useEffect, useRef, useState } from "react";
import { getAssetLibraryCacheState, isAssetLibraryCacheSupported, warmAssetLibrary, type AssetLibraryCacheState } from "./asset-library-cache";
import { getAssetLibraryBundle, getAssetLibraryBundles, loadImportedLibraryBundles, type AssetCategory, type AssetLibraryBundle } from "./assets";
import { EditorShell, filterAssets, type SceneSortMode } from "./components/editor-shell";
import { ModularEditorApp } from "./editor";
import { createInitialEditorViewState } from "./editor/view-state";

function formatByteCount(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const appRef = useRef<ModularEditorApp | null>(null);
  const [libraries, setLibraries] = useState<AssetLibraryBundle[]>(() => getAssetLibraryBundles());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLibraryId, setActiveLibraryId] = useState(libraries[0]?.library.id ?? "built-in");
  const [activeCategory, setActiveCategory] = useState<AssetCategory | "All">("All");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [sceneSortMode, setSceneSortMode] = useState<SceneSortMode>("manual");
  const [viewState, setViewState] = useState(createInitialEditorViewState);
  const [libraryCacheStates, setLibraryCacheStates] = useState<Record<string, AssetLibraryCacheState>>({});
  const [warmingLibraryId, setWarmingLibraryId] = useState<string | null>(null);
  const [warmingProgressText, setWarmingProgressText] = useState<string | null>(null);
  const [libraryCacheErrors, setLibraryCacheErrors] = useState<Record<string, string>>({});
  const assetCacheSupported = isAssetLibraryCacheSupported();

  const refreshLibraries = () => {
    void loadImportedLibraryBundles()
      .then((nextLibraries) => {
        setLibraries(nextLibraries);
      })
      .catch(() => {
        // Imported libraries are optional in local/dev mode.
      });
  };

  const refreshLibraryCacheStates = (nextLibraries: AssetLibraryBundle[]) => {
    void Promise.all(
      nextLibraries.map(async (bundle) => [bundle.library.id, await getAssetLibraryCacheState(bundle)] as const),
    )
      .then((entries) => {
        setLibraryCacheStates(Object.fromEntries(entries));
      })
      .catch(() => {
        // Ignore cache status refresh failures so asset browsing continues normally.
      });
  };

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
    let cancelled = false;

    void loadImportedLibraryBundles()
      .then((nextLibraries) => {
        if (cancelled) {
          return;
        }
        setLibraries(nextLibraries);
      })
      .catch(() => {
        // Imported libraries are optional in local/dev mode.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshLibraryCacheStates(libraries);
  }, [libraries]);

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

  const activeLibrary = getAssetLibraryBundle(activeLibraryId);
  const filteredAssets = filterAssets(activeLibrary.assets, searchQuery, activeCategory);
  const activeLibraryCacheState = libraryCacheStates[activeLibrary.library.id] ?? null;
  const activeLibraryCacheMessage = (() => {
    if (!assetCacheSupported) {
      return "IndexedDB cache is unavailable in this browser.";
    }

    if (warmingLibraryId === activeLibrary.library.id) {
      return warmingProgressText ?? "Warming library into IndexedDB...";
    }

    const cachedError = libraryCacheErrors[activeLibrary.library.id];
    if (cachedError) {
      return cachedError;
    }

    if (!activeLibraryCacheState) {
      return "Checking IndexedDB cache status...";
    }

    if (activeLibraryCacheState.kind === "not_warmed") {
      return viewState.toolbar.useIndexedDbAssetCache
        ? "Library is not warmed in IndexedDB yet."
        : "Library is not warmed. Cache usage is currently off.";
    }

    if (activeLibraryCacheState.kind === "outdated") {
      return "Library cache is outdated. Warm it again to refresh the stored files.";
    }

    if (activeLibraryCacheState.kind === "warmed") {
      const storageSummary = `${activeLibraryCacheState.fileCount} files, ${formatByteCount(activeLibraryCacheState.totalBytes)}`;
      return viewState.toolbar.useIndexedDbAssetCache
        ? `Library warmed in IndexedDB (${storageSummary}).`
        : `Library warmed in IndexedDB (${storageSummary}), but cache usage is off.`;
    }

    return "IndexedDB cache is unavailable in this browser.";
  })();
  const warmLibraryButtonLabel =
    warmingLibraryId === activeLibrary.library.id ? "Warming..." : "Warm Library";

  useEffect(() => {
    if (activeCategory !== "All" && !activeLibrary.categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, activeLibrary]);

  useEffect(() => {
    if (libraries.some((library) => library.library.id === activeLibraryId)) {
      return;
    }
    setActiveLibraryId(libraries[0]?.library.id ?? "built-in");
  }, [activeLibraryId, libraries]);

  const warmSelectedLibrary = async () => {
    if (!assetCacheSupported || warmingLibraryId) {
      return;
    }

    setLibraryCacheErrors((current) => {
      if (!(activeLibrary.library.id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[activeLibrary.library.id];
      return next;
    });
    setWarmingLibraryId(activeLibrary.library.id);
    setWarmingProgressText("Preparing library warmup...");

    try {
      await warmAssetLibrary(activeLibrary, (progress) => {
        const percentage = progress.totalAssets > 0
          ? Math.max(1, Math.min(100, Math.round((progress.completedAssets / progress.totalAssets) * 100)))
          : 100;
        setWarmingProgressText(
          `Warming ${percentage}% · ${progress.completedAssets}/${progress.totalAssets} assets · ${progress.filesDiscovered} files`,
        );
      });
      const nextState = await getAssetLibraryCacheState(activeLibrary);
      setLibraryCacheStates((current) => ({
        ...current,
        [activeLibrary.library.id]: nextState,
      }));
    } catch (error) {
      setLibraryCacheErrors((current) => ({
        ...current,
        [activeLibrary.library.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setWarmingLibraryId(null);
      setWarmingProgressText(null);
    }
  };

  return (
    <EditorShell
      canvasRef={canvasRef}
      importInputRef={importInputRef}
      searchQuery={searchQuery}
      availableLibraries={libraries}
      activeLibraryId={activeLibrary.library.id}
      availableCategories={activeLibrary.categories}
      activeCategory={activeCategory}
      filteredAssets={filteredAssets}
      assetCacheSupported={assetCacheSupported}
      assetCacheEnabled={viewState.toolbar.useIndexedDbAssetCache}
      activeLibraryCacheMessage={activeLibraryCacheMessage}
      warmLibraryButtonLabel={warmLibraryButtonLabel}
      activeLibraryWarmInProgress={warmingLibraryId === activeLibrary.library.id}
      exportMenuOpen={exportMenuOpen}
      settingsMenuOpen={settingsMenuOpen}
      sceneSortMode={sceneSortMode}
      viewState={viewState}
      onSearchQueryChange={setSearchQuery}
      onActiveLibraryChange={setActiveLibraryId}
      onRefreshLibraries={refreshLibraries}
      onWarmLibrary={() => {
        void warmSelectedLibrary();
      }}
      onActiveCategoryChange={setActiveCategory}
      onAssetClick={(libraryId, assetId) => {
        void appRef.current?.activateAsset(libraryId, assetId);
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
      onExportGltf={() => {
        void appRef.current?.exportToGltf();
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
      onRotationAxisChange={(value) => {
        appRef.current?.setRotationAxis(value);
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
      onCameraCloseLimitChange={(value) => {
        appRef.current?.setCameraCloseLimit(value);
      }}
      onViewportGizmoEnabledChange={(value) => {
        appRef.current?.setViewportGizmoEnabled(value);
      }}
      onGridVisibleChange={(visible) => {
        appRef.current?.setGridVisible(visible);
      }}
      onGridRenderModeChange={(value) => {
        appRef.current?.setGridRenderMode(value);
      }}
      onGridColorChange={(value) => {
        appRef.current?.setGridColor(value);
      }}
      onGroundColorChange={(value) => {
        appRef.current?.setGroundColor(value);
      }}
      onFreezeModelMaterialsChange={(value) => {
        appRef.current?.setFreezeModelMaterials(value);
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
      onUseIndexedDbAssetCacheChange={(value) => {
        appRef.current?.setUseIndexedDbAssetCache(value);
      }}
      onGridPlaneSizeChange={(value) => {
        appRef.current?.setGridPlaneSize(value);
      }}
      onRetuneCamera={() => {
        appRef.current?.retuneCamera();
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
      onSelectionRotationChange={(axis, value) => {
        appRef.current?.setSelectionRotationDegrees(axis, value);
      }}
      onSelectionDropToGround={() => {
        appRef.current?.dropSelectionToGround();
      }}
    />
  );
}
