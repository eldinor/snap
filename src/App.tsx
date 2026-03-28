import { useEffect, useRef, useState } from "react";
import { getAssetLibraryBundle, getAssetLibraryBundles, loadImportedLibraryBundles, type AssetCategory, type AssetLibraryBundle } from "./assets";
import { EditorShell, filterAssets, type LoadingOverlayState, type SceneSortMode } from "./components/editor-shell";
import { ModularEditorApp } from "./editor";
import { createInitialEditorViewState } from "./editor/view-state";

const WARM_LIBRARY_STORAGE_KEY = "snap:warm-library-id";
const WARM_OVERLAY_SKIPPED_STORAGE_KEY = "snap:warm-overlay-skipped";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const appRef = useRef<ModularEditorApp | null>(null);
  const [selectedWarmLibraryId, setSelectedWarmLibraryId] = useState(() => {
    try {
      return window.localStorage.getItem(WARM_LIBRARY_STORAGE_KEY) ?? getAssetLibraryBundles()[0]?.library.id ?? "built-in";
    } catch {
      return getAssetLibraryBundles()[0]?.library.id ?? "built-in";
    }
  });
  const [loadingOverlayState, setLoadingOverlayState] = useState<LoadingOverlayState>({
    phase: "booting",
    progress: null,
    progressLabel: null,
    detail: null,
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      return window.localStorage.getItem(WARM_OVERLAY_SKIPPED_STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });
  const [skipWarm, setSkipWarm] = useState(() => {
    try {
      return window.localStorage.getItem(WARM_OVERLAY_SKIPPED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [libraries, setLibraries] = useState<AssetLibraryBundle[]>(() => getAssetLibraryBundles());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLibraryId, setActiveLibraryId] = useState(libraries[0]?.library.id ?? "built-in");
  const [activeCategory, setActiveCategory] = useState<AssetCategory | "All">("All");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [sceneSortMode, setSceneSortMode] = useState<SceneSortMode>("manual");
  const [viewState, setViewState] = useState(createInitialEditorViewState);

  const refreshLibraries = () => {
    void loadImportedLibraryBundles()
      .then((nextLibraries) => {
        setLibraries(nextLibraries);
      })
      .catch(() => {
        // Imported libraries are optional in local/dev mode.
      });
  };

  useEffect(() => {
    if (appRef.current || !canvasRef.current) {
      return;
    }

    let cancelled = false;
    let readyFrameId = 0;
    appRef.current = new ModularEditorApp({
      canvas: canvasRef.current,
      onViewStateChange: setViewState,
    });
    readyFrameId = window.requestAnimationFrame(() => {
      if (!cancelled) {
        if (isLoading) {
          setLoadingOverlayState({
            phase: "ready",
            progress: null,
            progressLabel: null,
            detail: null,
          });
        }
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(readyFrameId);
      appRef.current?.destroy();
      appRef.current = null;
    };
  }, [isLoading]);

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

  useEffect(() => {
    if (libraries.some((library) => library.library.id === selectedWarmLibraryId)) {
      return;
    }
    setSelectedWarmLibraryId(libraries[0]?.library.id ?? "built-in");
  }, [libraries, selectedWarmLibraryId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WARM_LIBRARY_STORAGE_KEY, selectedWarmLibraryId);
    } catch {
      // Ignore persistence failures so the selector still works for this session.
    }
  }, [selectedWarmLibraryId]);

  const setWarmOverlaySkipped = (value: boolean) => {
    try {
      window.localStorage.setItem(WARM_OVERLAY_SKIPPED_STORAGE_KEY, value ? "true" : "false");
    } catch {
      // Ignore persistence failures; the choice just won't survive reloads.
    }
  };

  const handleSkipWarmChange = (value: boolean) => {
    setSkipWarm(value);
    setWarmOverlaySkipped(value);
  };

  const dismissLoadingOverlay = () => {
    handleSkipWarmChange(true);
    setIsLoading(false);
  };

  const warmAssets = () => {
    const libraryId = selectedWarmLibraryId;
    const library = getAssetLibraryBundle(libraryId);
    const totalAssets = library.assets.length;
    const app = appRef.current;
    if (!app) {
      setIsLoading(false);
      return;
    }

    setLoadingOverlayState({
      phase: "warming",
      progress: 0,
      progressLabel: `Warming assets 0 / ${totalAssets}`,
      detail: `Starting ${library.library.name} warmup.`,
    });

    void app
      .warmLibraryAssets(libraryId, ({ completed, total, assetName }) => {
        setLoadingOverlayState({
          phase: "warming",
          progress: total > 0 ? (completed / total) * 100 : 100,
          progressLabel: `Warming assets ${completed} / ${total}`,
          detail: assetName,
        });
      })
      .then(() => {
        handleSkipWarmChange(true);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  return (
    <EditorShell
      isLoading={isLoading}
      loadingOverlayState={loadingOverlayState}
      warmLibraries={libraries}
      selectedWarmLibraryId={selectedWarmLibraryId}
      warmProgressLabel={loadingOverlayState.progressLabel}
      warmDetail={loadingOverlayState.detail}
      isWarmingAssets={loadingOverlayState.phase === "warming"}
      skipWarm={skipWarm}
      canvasRef={canvasRef}
      importInputRef={importInputRef}
      searchQuery={searchQuery}
      availableLibraries={libraries}
      activeLibraryId={activeLibrary.library.id}
      availableCategories={activeLibrary.categories}
      activeCategory={activeCategory}
      filteredAssets={filteredAssets}
      exportMenuOpen={exportMenuOpen}
      settingsMenuOpen={settingsMenuOpen}
      sceneSortMode={sceneSortMode}
      viewState={viewState}
      onSearchQueryChange={setSearchQuery}
      onWarmAssets={warmAssets}
      onWarmLibraryChange={setSelectedWarmLibraryId}
      onSkipWarmChange={handleSkipWarmChange}
      onDismissLoadingOverlay={dismissLoadingOverlay}
      onActiveLibraryChange={setActiveLibraryId}
      onRefreshLibraries={refreshLibraries}
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
