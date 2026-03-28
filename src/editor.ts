import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
// Registers ArcRotateCamera input plugins used by camera.attachControl(...).
import "@babylonjs/core/Cameras/arcRotateCameraInputsManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import type { PickingInfo } from "@babylonjs/core/Collisions/pickingInfo";
// Adds the ray/picking pieces behind scene.pick(...) and scene.multiPick(...).
import "@babylonjs/core/Culling/ray";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
// Adds Scene helper extensions like scene.createDefaultEnvironment(...).
import "@babylonjs/core/Helpers/sceneHelpers";
import type { EnvironmentHelper } from "@babylonjs/core/Helpers/environmentHelper";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { HemisphericLight as BabylonHemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Node } from "@babylonjs/core/node";
import { Scene } from "@babylonjs/core/scene";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Nullable } from "@babylonjs/core/types";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0/glTFSerializer";
import { GridMaterial } from "@babylonjs/materials/grid";
import JSZip from "jszip";
import {
  ACTIVE_LIBRARY,
  findAssetByRef,
  getAssetBasePathForLibrary,
  getAssetRefKey,
  type AssetDefinition,
} from "./assets";
import {
  instantiateAsset,
  loadAssetTemplate,
  setRootMaterialsFrozen,
  type AssetTemplate,
} from "./editor/asset-runtime";
import { SceneCoreController } from "./editor/scene-core-controller";
import {
  loadAutosavedScene,
  loadLatestAutosaveVersion,
  loadManualSavedScene,
  saveAutosaveVersion,
  saveAutosavedScene,
  saveManualSavedScene,
} from "./editor/scene-persistence";
import { SceneSessionController } from "./editor/scene-session-controller";
import { SnapshotHistory } from "./editor/snapshot-history";
import {
  serializeAssetScene,
  type AssetSceneSerializableObject,
  type SerializedSceneGroup,
  type SerializedAssetSceneMetadata,
  type SerializedAssetScene,
} from "./editor/scene-serialization";
import { snapAngle as snapPlacementAngle, snapScalar, snapVectorForSize } from "./editor/placement";
import {
  createSequentialSceneObjectName,
  deriveSceneObjectNameBase,
  normalizeSceneObjectName,
} from "./editor/object-naming";
import {
  clearSceneObjects,
  clearSelection as clearSceneSelection,
  deleteSelectedObject as deleteSceneObject,
  selectObject as selectSceneObject,
} from "./editor/scene-actions";
import {
  CAMERA_CLOSE_LIMIT_OPTIONS,
  DEFAULT_USER_SETTINGS,
  GRID_PLANE_SIZE_OPTIONS,
  GRID_SIZE_OPTIONS,
  loadUserSettings,
  saveUserSettings,
  type UserSettings,
} from "./editor/user-settings";
import {
  createInitialEditorViewState,
  type EditorViewState,
  type RotationAxis,
  type SceneItemViewState,
  type SelectionViewState,
  type StatusViewState,
  type ToolbarViewState,
} from "./editor/view-state";
import { ViewportGizmoController } from "./editor/viewport-gizmo-controller";

interface EditorObject {
  id: string;
  libraryId: string;
  assetId: string;
  placementKind: "clone" | "instance";
  root: TransformNode;
  name: string;
  hidden: boolean;
  locked: boolean;
  type: "object";
  parentId: string | null;
}

interface EditorGroup {
  id: string;
  name: string;
  type: "group";
  childIds: string[];
  hidden: boolean;
  locked: boolean;
  parentId: string | null;
  root: TransformNode;
}

interface ModularEditorAppOptions {
  canvas: HTMLCanvasElement;
  onViewStateChange?: (state: EditorViewState) => void;
}

export class ModularEditorApp {
  private static readonly CAMERA_BASE_LOWER_RADIUS_LIMIT = 6;
  private static readonly CAMERA_BASE_UPPER_RADIUS_LIMIT = 48;
  private static readonly CAMERA_BASE_WHEEL_DELTA_PERCENTAGE = 0.02;
  private static readonly CAMERA_BASE_PANNING_SENSIBILITY = 1000;
  private static readonly CAMERA_BASE_GRID_PLANE_SIZE = DEFAULT_USER_SETTINGS.gridPlaneSize;
  private static readonly HELD_MOVEMENT_INITIAL_DELAY_MS = 220;
  private static readonly HELD_MOVEMENT_REPEAT_INTERVAL_MS = 90;

  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly gizmoManager: GizmoManager;
  private ground!: Mesh;
  private groundMaterial: Material;
  private readonly mainLight: HemisphericLight;
  private readonly onViewStateChange;
  private readonly defaultEnvironment: EnvironmentHelper | null;
  private readonly defaultEnvironmentTexture: Scene["environmentTexture"];
  private readonly assetTemplates = new Map<string, Promise<AssetTemplate>>();
  private readonly objects = new Map<string, EditorObject>();
  private readonly groups = new Map<string, EditorGroup>();
  private readonly settings: UserSettings;
  private readonly history = new SnapshotHistory();
  private readonly sceneCore: SceneCoreController;
  private readonly viewportGizmo: ViewportGizmoController;
  private readonly sessionController: SceneSessionController;
  private readonly resizeObserver: ResizeObserver;
  private readonly handleWindowResize = () => {
    this.engine.resize();
  };
  private readonly handleWindowKeyUp = (event: KeyboardEvent) => {
    const code = event.code;
    if (!this.isMovementKeyCode(code)) {
      return;
    }

    this.heldMovementKeys.delete(code);
    if (this.heldMovementKeys.size === 0) {
      this.completeHistoryGesture();
    }
  };
  private readonly handleWindowKeyDown = async (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) {
      return;
    }

    const code = event.code;

    if ((event.ctrlKey || event.metaKey) && code === "KeyZ") {
      event.preventDefault();
      if (event.shiftKey) {
        await this.sessionController.redo();
      } else {
        await this.sessionController.undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && code === "KeyY") {
      event.preventDefault();
      await this.sessionController.redo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && code === "KeyS") {
      event.preventDefault();
      this.saveSceneToLocalStorage();
      return;
    }

    if (event.shiftKey && code === "KeyD") {
      event.preventDefault();
      await this.duplicateSelectedObject();
      return;
    }

    if (event.shiftKey && code === "KeyA") {
      if (this.activeAssetId && this.activeAssetLibraryId) {
        event.preventDefault();
        await this.enterPlacementMode();
      }
      return;
    }

    if (event.shiftKey && code === "KeyF") {
      event.preventDefault();
      this.frameSelectedObject();
      return;
    }

    if (code === "KeyR") {
      event.preventDefault();
      this.rotateActiveTarget();
    }

    if (this.mode === "select") {
      if (code === "KeyW") {
        event.preventDefault();
        if (!event.repeat) {
          this.beginHeldMovement(code, 1, 0);
        }
        return;
      }
      if (code === "KeyS") {
        event.preventDefault();
        if (!event.repeat) {
          this.beginHeldMovement(code, -1, 0);
        }
        return;
      }
      if (code === "KeyA") {
        event.preventDefault();
        if (!event.repeat) {
          this.beginHeldMovement(code, 0, -1);
        }
        return;
      }
      if (code === "KeyD") {
        event.preventDefault();
        if (!event.repeat) {
          this.beginHeldMovement(code, 0, 1);
        }
        return;
      }
    }

    if (event.key === "Delete") {
      event.preventDefault();
      this.deleteSelectedObject();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.mode = "select";
      this.disposePreview();
      this.emitViewState();
    }

    if (event.key === "Enter" && this.mode === "place" && this.previewAssetId && this.placementPreview) {
      event.preventDefault();
      await this.placeActiveAsset();
    }
  };

  private gridMesh: Nullable<LinesMesh> = null;
  private originMarker: Nullable<Mesh> = null;
  private selectionVerticalHelper: Nullable<LinesMesh> = null;
  private selectionHeightLabel: Nullable<Mesh> = null;
  private selectionVerticalHelperMarker: Nullable<Mesh> = null;
  private selectionHelperVisualsEnabled = true;
  private lastSelectionHelperRenderKey: string | null = null;
  private activeAssetLibraryId: string | null = null;
  private activeAssetId: string | null = null;
  private selectedSceneItemIds = new Set<string>();
  private selectedObjectId: string | null = null;
  private placementPreview: TransformNode | null = null;
  private previewAssetLibraryId: string | null = null;
  private previewAssetId: string | null = null;
  private previewTemplateSize = new Vector3(1, 1, 1);
  private lastPreviewTransformKey: string | null = null;
  private mode: "select" | "place" = "select";
  private snapEnabled = true;
  private ySnapEnabled = false;
  private gridSize = DEFAULT_USER_SETTINGS.gridSize; // check if valid
  private gridPlaneSize = DEFAULT_USER_SETTINGS.gridPlaneSize;
  private rotationStepDegrees = 90;
  private rotationAxis: RotationAxis = "y";
  private previewRotation = Vector3.Zero();
  private objectSequence = 0;
  private groupSequence = 0;
  private sceneRootOrder: string[] = [];
  private selectedGroupId: string | null = null;
  private lastPointerPoint = Vector3.Zero();
  private statusNotice: string | null = null;
  private viewState: EditorViewState = createInitialEditorViewState();
  private lastAutosavedSnapshotText: string | null = null;
  private lastTimedAutosaveSnapshotText: string | null = null;
  private pendingTimedAutosaveSnapshotText: string | null = null;
  private autosaveTimeoutId: number | null = null;
  private lastAutosaveAt: string | null = null;
  private lastManualSaveAt: string | null = null;
  private lastRecoveredAutosaveAt: string | null = null;
  private persistenceReady = false;
  private drawCalls = 0;
  private materialCount = 0;
  private textureCount = 0;
  private totalVertices = 0;
  private lastDrawCallSampleAt = 0;
  private readonly heldMovementKeys = new Set<string>();
  private heldMovementRepeatReadyAt = 0;
  private lastHeldMovementAt = 0;
  private lastHeldMovementViewStateAt = 0;
  private beforeAnimationsObserver: Observer<Scene> | null = null;
  private afterRenderObserver: Observer<Scene> | null = null;

  constructor(options: ModularEditorAppOptions) {
    this.onViewStateChange = options.onViewStateChange;
    this.canvas = options.canvas;
    this.engine = new Engine(options.canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.09, 0.1, 0.12, 1);
    this.defaultEnvironment = this.scene.createDefaultEnvironment({
      createGround: false,
      createSkybox: false,
      environmentTexture: "/photoStudio.env",
    });
    this.defaultEnvironmentTexture = this.scene.environmentTexture;
    this.settings = loadUserSettings();
    this.gridSize = this.settings.gridSize;
    this.gridPlaneSize = this.settings.gridPlaneSize;
    this.sessionController = new SceneSessionController({
      history: this.history,
      getSnapshotText: () => this.getSerializedSceneText(),
      restoreSnapshot: async (scene) => {
        await this.restoreSerializedScene(scene);
      },
      onStateChanged: () => {
        this.emitViewState();
      },
      onNotice: (message) => {
        this.setStatusNotice(message);
      },
    });

    this.camera = new ArcRotateCamera("camera", Math.PI / 3, Math.PI / 2.9, 22, new Vector3(0, 2, 0), this.scene);
    this.camera.attachControl(options.canvas, true);
    this.retuneCameraForGridPlaneSize(false);

    this.mainLight = new BabylonHemisphericLight("light", new Vector3(0.4, 1, 0.2), this.scene);
    this.mainLight.intensity = this.settings.lightIntensity;
    this.mainLight.groundColor = new Color3(0.06, 0.07, 0.08);

    this.groundMaterial = new StandardMaterial("ground-material", this.scene);
    this.recreateGround();
    this.applyGroundAppearance();

    this.gizmoManager = new GizmoManager(this.scene);
    this.gizmoManager.usePointerToAttachGizmos = false;
    this.gizmoManager.clearGizmoOnEmptyPointerEvent = false;
    this.gizmoManager.positionGizmoEnabled = true;
    this.gizmoManager.rotationGizmoEnabled = true;
    this.gizmoManager.scaleGizmoEnabled = false;

    if (this.gizmoManager.gizmos.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      this.gizmoManager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragStartObservable.add(() => {
        this.beginHistoryGesture();
      });
      this.gizmoManager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
        this.completeHistoryGesture();
      });
      this.gizmoManager.gizmos.positionGizmo.yGizmo.dragBehavior.onDragStartObservable.add(() => {
        this.beginHistoryGesture();
      });
      this.gizmoManager.gizmos.positionGizmo.yGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
        this.completeHistoryGesture();
      });
      this.gizmoManager.gizmos.positionGizmo.zGizmo.dragBehavior.onDragStartObservable.add(() => {
        this.beginHistoryGesture();
      });
      this.gizmoManager.gizmos.positionGizmo.zGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
        this.completeHistoryGesture();
      });
    }

    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      [
        this.gizmoManager.gizmos.rotationGizmo.xGizmo,
        this.gizmoManager.gizmos.rotationGizmo.yGizmo,
        this.gizmoManager.gizmos.rotationGizmo.zGizmo,
      ].forEach((gizmo) => {
        gizmo.dragBehavior.onDragStartObservable.add(() => {
          this.beginHistoryGesture();
        });
        gizmo.dragBehavior.onDragEndObservable.add(() => {
          this.snapSelectedObject();
          this.completeHistoryGesture();
        });
      });
    }

    this.sceneCore = new SceneCoreController(this.scene, this.gizmoManager);
    this.renderGrid();
    this.applyEnvironmentSetting();
    this.viewportGizmo = new ViewportGizmoController(this.scene, {
      enabled: this.settings.viewportGizmoEnabled,
      anchor: "top-right",
      size: 108,
      margin: 14,
      showAxisLabels: true,
      showNegativeAxes: true,
      showCenter: true,
    });

    this.bindSceneInteractions();
    this.bindShortcuts();
    this.bindDrawCallCounter();
    this.applySnapSettings();
    this.applyRotationAxis();
    this.emitViewState();
    void this.initializePersistence();

    this.engine.runRenderLoop(() => {
      this.processHeldMovement(performance.now());
      if (this.selectionHelperVisualsEnabled) {
        try {
          this.renderSelectionVerticalHelperIfNeeded();
        } catch {
          this.selectionHelperVisualsEnabled = false;
          this.selectionVerticalHelper?.dispose();
          this.selectionVerticalHelper = null;
          this.selectionHeightLabel?.dispose(false, false);
          this.selectionHeightLabel = null;
          this.selectionVerticalHelperMarker?.dispose(false, false);
          this.selectionVerticalHelperMarker = null;
          this.setStatusNotice("Selection height helper was disabled after a rendering error.");
        }
      }
      this.scene.render();
    });

    window.addEventListener("resize", this.handleWindowResize);

    this.resizeObserver = new ResizeObserver(() => {
      this.engine.resize();
    });
    this.resizeObserver.observe(options.canvas);
    if (options.canvas.parentElement) {
      this.resizeObserver.observe(options.canvas.parentElement);
    }
  }

  private async initializePersistence() {
    const manualSaved = loadManualSavedScene();
    this.lastManualSaveAt = manualSaved?.savedAt ?? null;

    const liveAutosaved = loadAutosavedScene();
    const timedAutosaved = loadLatestAutosaveVersion();
    this.lastAutosaveAt = timedAutosaved?.savedAt ?? null;
    if (liveAutosaved) {
      await this.restoreSerializedScene(liveAutosaved.scene);
      this.lastRecoveredAutosaveAt = liveAutosaved.savedAt;
      this.statusNotice = `Recovered autosaved scene (${liveAutosaved.scene.objects.length} objects).`;
    }

    this.persistenceReady = true;
    this.sessionController.resetHistory();
    this.emitViewState();
  }

  private bindSceneInteractions() {
    this.scene.onPointerObservable.add(async (pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        if (this.mode !== "place" || !this.placementPreview || !this.previewAssetId) {
          return;
        }
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.ground);
        if (pick?.pickedPoint) {
          if (Vector3.DistanceSquared(this.lastPointerPoint, pick.pickedPoint) > 0.000001) {
            this.lastPointerPoint.copyFrom(pick.pickedPoint);
            this.updatePreviewTransform();
          }
        }
      }

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pointerEvent = pointerInfo.event as PointerEvent | undefined;
        const isPrimaryButton = (pointerEvent?.button ?? 0) === 0;

        if (this.mode === "place" && this.previewAssetId && this.placementPreview && isPrimaryButton) {
          const groundPick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.ground);
          if (!groundPick?.pickedPoint) {
            this.enterSelectionMode();
            return;
          }
          await this.placeActiveAsset();
          return;
        }

        const nearestSceneItemId = this.findNearestPickedSceneItemId(
          this.scene.multiPick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh !== this.ground) ?? [],
        );
        if (nearestSceneItemId) {
          this.selectSceneItem(nearestSceneItemId);
          return;
        }

        this.clearSelection();
      }
    });
  }

  private readonly handleWindowPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    if (this.mode !== "place" || !this.previewAssetId || !this.placementPreview) {
      return;
    }

    if (event.composedPath().includes(this.canvas)) {
      return;
    }

    this.enterSelectionMode();
  };

  private findNearestPickedSceneItemId(hits: PickingInfo[]) {
    const closestHitByItemId = new Map<string, number>();

    hits.forEach((hit) => {
      const pickedMesh = hit.pickedMesh;
      if (!pickedMesh || !hit.hit) {
        return;
      }

      const objectId = this.findObjectId(pickedMesh);
      if (objectId) {
        const object = this.objects.get(objectId);
        if (!object || this.isObjectHidden(object) || this.isObjectLocked(object)) {
          return;
        }
        const currentDistance = closestHitByItemId.get(objectId);
        if (currentDistance === undefined || hit.distance < currentDistance) {
          closestHitByItemId.set(objectId, hit.distance);
        }
        return;
      }

      const groupId = pickedMesh.metadata?.groupId as string | undefined;
      if (!groupId) {
        return;
      }

      const group = this.groups.get(groupId);
      if (!group || this.isGroupHidden(group.id) || this.isGroupLocked(group.id)) {
        return;
      }
      const currentDistance = closestHitByItemId.get(groupId);
      if (currentDistance === undefined || hit.distance < currentDistance) {
        closestHitByItemId.set(groupId, hit.distance);
      }
    });

    let nearestItemId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    closestHitByItemId.forEach((distance, itemId) => {
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestItemId = itemId;
      }
    });

    return nearestItemId;
  }

  private bindShortcuts() {
    window.addEventListener("pointerdown", this.handleWindowPointerDown);
    window.addEventListener("keydown", this.handleWindowKeyDown);
    window.addEventListener("keyup", this.handleWindowKeyUp);
  }

  private getEffectiveGridSize() {
    if (GRID_SIZE_OPTIONS.includes(this.gridSize as (typeof GRID_SIZE_OPTIONS)[number])) {
      return this.gridSize;
    }

    this.gridSize = DEFAULT_USER_SETTINGS.gridSize;
    this.settings.gridSize = this.gridSize;
    return this.gridSize;
  }

  private buildSelectionViewState(): SelectionViewState {
    const selectionCount = this.selectedSceneItemIds.size;
    if (selectionCount > 1) {
      return {
        selectedObjectId: null,
        selectedAssetName: `${selectionCount} items selected`,
        multiSelected: true,
        activeAssetName:
          this.activeAssetId && this.activeAssetLibraryId
            ? (findAssetByRef({ libraryId: this.activeAssetLibraryId, assetId: this.activeAssetId })?.name ?? null)
            : null,
        previewAssetName:
          this.previewAssetId && this.previewAssetLibraryId
            ? (findAssetByRef({ libraryId: this.previewAssetLibraryId, assetId: this.previewAssetId })?.name ?? null)
            : null,
        objectPlacementKind: null,
        position: null,
        rotationDegrees: null,
        positionText: null,
        rotationText: null,
        snapText: this.snapEnabled ? `Grid ${this.gridSize}${this.ySnapEnabled ? " + Y" : ""}` : "Off",
      };
    }

    const selected = this.selectedObjectId ? this.objects.get(this.selectedObjectId) : null;
    const selectedGroup = this.selectedGroupId ? this.groups.get(this.selectedGroupId) : null;
    const selectedAsset = selected
      ? findAssetByRef({ libraryId: selected.libraryId, assetId: selected.assetId })
      : null;
    const activeAsset =
      this.activeAssetId && this.activeAssetLibraryId
        ? findAssetByRef({ libraryId: this.activeAssetLibraryId, assetId: this.activeAssetId })
        : null;
    const previewAsset =
      this.previewAssetId && this.previewAssetLibraryId
        ? findAssetByRef({ libraryId: this.previewAssetLibraryId, assetId: this.previewAssetId })
        : null;
    const position = selected ? selected.root.position : (selectedGroup?.root.position ?? null);
    const rotation = selected ? selected.root.rotation : (selectedGroup?.root.rotation ?? null);
    const rotationDegrees = rotation
      ? ([
          this.normalizeDisplayDegrees(Math.round(this.toDegrees(rotation.x))),
          this.normalizeDisplayDegrees(Math.round(this.toDegrees(rotation.y))),
          this.normalizeDisplayDegrees(Math.round(this.toDegrees(rotation.z))),
        ] as [number, number, number])
      : null;

    return {
      selectedObjectId: this.selectedObjectId ?? this.selectedGroupId,
      selectedAssetName: selectedAsset?.name ?? selectedGroup?.name ?? null,
      multiSelected: false,
      activeAssetName: activeAsset?.name ?? null,
      previewAssetName: previewAsset?.name ?? null,
      objectPlacementKind: selected?.placementKind ?? null,
      position: position ? [position.x, position.y, position.z] : null,
      rotationDegrees,
      positionText: position ? `${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}` : null,
      rotationText: rotationDegrees
        ? `${rotationDegrees[0]}deg, ${rotationDegrees[1]}deg, ${rotationDegrees[2]}deg`
        : null,
      snapText: this.snapEnabled ? `Grid ${this.gridSize}${this.ySnapEnabled ? " + Y" : ""}` : "Off",
    };
  }

  private buildSceneItemsViewState(): SceneItemViewState[] {
    this.normalizeSceneRootOrder();
    const items: SceneItemViewState[] = [];
    const visitedIds = new Set<string>();

    const pushObject = (object: EditorObject, depth: number) => {
      visitedIds.add(object.id);
      const asset = findAssetByRef({ libraryId: object.libraryId, assetId: object.assetId });
      items.push({
        id: object.id,
        libraryId: object.libraryId,
        assetId: object.assetId,
        assetName: asset?.name ?? object.assetId,
        placementKind: object.placementKind,
        childCount: null,
        label: object.name || `${asset?.name ?? object.assetId}`,
        selected: this.selectedSceneItemIds.has(object.id),
        hidden: this.isObjectHidden(object),
        locked: this.isObjectLocked(object),
        type: object.type,
        parentId: object.parentId,
        depth,
      });
    };

    const pushGroup = (group: EditorGroup, depth: number) => {
      if (visitedIds.has(group.id)) {
        return;
      }
      visitedIds.add(group.id);
      items.push({
        id: group.id,
        libraryId: ACTIVE_LIBRARY.id,
        assetId: "",
        assetName: "Group",
        placementKind: null,
        childCount: group.childIds.length,
        label: group.name,
        selected: this.selectedSceneItemIds.has(group.id),
        hidden: this.isGroupHidden(group.id),
        locked: this.isGroupLocked(group.id),
        type: "group",
        parentId: group.parentId,
        depth,
      });

      group.childIds.forEach((childId) => {
        const childGroup = this.groups.get(childId);
        if (childGroup) {
          pushGroup(childGroup, depth + 1);
          return;
        }

        const childObject = this.objects.get(childId);
        if (childObject) {
          pushObject(childObject, depth + 1);
        }
      });
    };

    this.sceneRootOrder.forEach((rootId) => {
      const group = this.groups.get(rootId);
      if (group && !group.parentId) {
        pushGroup(group, 0);
        return;
      }

      const object = this.objects.get(rootId);
      if (object && !object.parentId) {
        pushObject(object, 0);
      }
    });

    this.groups.forEach((group) => {
      if (visitedIds.has(group.id) || group.parentId) {
        return;
      }
      pushGroup(group, 0);
    });

    this.objects.forEach((object) => {
      if (!object.parentId && !visitedIds.has(object.id)) {
        pushObject(object, 0);
      }
    });

    return items;
  }

  private normalizeSceneRootOrder() {
    const seen = new Set<string>();
    const validRootIds = new Set<string>([
      ...Array.from(this.groups.values())
        .filter((group) => !group.parentId)
        .map((group) => group.id),
      ...Array.from(this.objects.values())
        .filter((object) => !object.parentId)
        .map((object) => object.id),
    ]);

    this.sceneRootOrder = this.sceneRootOrder.filter((id) => {
      if (!validRootIds.has(id) || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });

    this.groups.forEach((group) => {
      if (!group.parentId && !seen.has(group.id)) {
        this.sceneRootOrder.push(group.id);
        seen.add(group.id);
      }
    });

    this.objects.forEach((object) => {
      if (!object.parentId && !seen.has(object.id)) {
        this.sceneRootOrder.push(object.id);
        seen.add(object.id);
      }
    });
  }

  private buildToolbarViewState(): ToolbarViewState {
    return {
      snapEnabled: this.snapEnabled,
      ySnapEnabled: this.ySnapEnabled,
      newObjectPlacementKind: this.settings.newObjectPlacementKind,
      heightLabelMode: this.settings.heightLabelMode,
      saveOnEveryUiUpdate: this.settings.saveOnEveryUiUpdate,
      autosaveEnabled: this.settings.autosaveEnabled,
      autosaveIntervalSeconds: this.settings.autosaveIntervalSeconds,
      mode: this.mode,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      hasSelection: this.selectedSceneItemIds.size > 0,
      hasObjects: this.objects.size > 0,
      gridSize: this.gridSize,
      gridPlaneSize: this.gridPlaneSize,
      rotationStepDegrees: this.rotationStepDegrees,
      rotationAxis: this.rotationAxis,
      environmentEnabled: this.settings.environmentEnabled,
      environmentIntensity: this.settings.environmentIntensity,
      lightIntensity: this.settings.lightIntensity,
      cameraCloseLimit: this.settings.cameraCloseLimit,
      viewportGizmoEnabled: this.settings.viewportGizmoEnabled,
      gridVisible: this.settings.gridVisible,
      gridRenderMode: this.settings.gridRenderMode,
      gridColor: this.settings.gridColor,
      groundColor: this.settings.groundColor,
      freezeModelMaterials: this.settings.freezeModelMaterials,
    };
  }

  private buildStatusViewState(): StatusViewState {
    const activeAsset =
      this.activeAssetId && this.activeAssetLibraryId
        ? findAssetByRef({ libraryId: this.activeAssetLibraryId, assetId: this.activeAssetId })
        : null;
    return {
      mode: this.mode,
      activeAssetName: activeAsset?.name ?? null,
      snapEnabled: this.snapEnabled,
      ySnapEnabled: this.ySnapEnabled,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      rotationAxis: this.rotationAxis,
      drawCalls: this.drawCalls,
      materials: this.materialCount,
      textures: this.textureCount,
      totalVertices: this.totalVertices,
      hint:
        this.statusNotice ??
        (this.mode === "place"
          ? "R rotate · Click or Enter place · Esc cancel"
          : "Click object select · Delete remove · R rotate"),
    };
  }

  private buildViewState(): EditorViewState {
    return {
      activeAssetLibraryId: this.activeAssetLibraryId,
      activeAssetId: this.activeAssetId,
      previewAssetLibraryId: this.previewAssetLibraryId,
      previewAssetId: this.previewAssetId,
      objectCount: this.objects.size,
      selectionCount: this.selectedSceneItemIds.size,
      noticeMessage: this.statusNotice,
      lastManualSaveAt: this.lastManualSaveAt,
      lastAutosaveAt: this.lastAutosaveAt,
      lastRecoveredAutosaveAt: this.lastRecoveredAutosaveAt,
      sceneItems: this.buildSceneItemsViewState(),
      toolbar: this.buildToolbarViewState(),
      status: this.buildStatusViewState(),
      selection: this.buildSelectionViewState(),
    };
  }

  private emitViewState() {
    this.viewState = this.buildViewState();
    this.persistLiveAutosave();
    this.scheduleTimedAutosave();
    this.onViewStateChange?.(this.viewState);
  }

  private sampleDrawCalls() {
    const now = performance.now();
    if (now - this.lastDrawCallSampleAt < 500) {
      return;
    }
    this.lastDrawCallSampleAt = now;

    const nextDrawCalls = this.getCurrentDrawCalls();
    const nextMaterialCount = this.getCurrentMaterialCount();
    const nextTextureCount = this.getCurrentTextureCount();
    const nextTotalVertices = this.getCurrentTotalVertices();
    if (
      nextDrawCalls === this.drawCalls &&
      nextMaterialCount === this.materialCount &&
      nextTextureCount === this.textureCount &&
      nextTotalVertices === this.totalVertices
    ) {
      return;
    }

    this.drawCalls = nextDrawCalls;
    this.materialCount = nextMaterialCount;
    this.textureCount = nextTextureCount;
    this.totalVertices = nextTotalVertices;
    this.viewState = {
      ...this.viewState,
      status: {
        ...this.viewState.status,
        drawCalls: nextDrawCalls,
        materials: nextMaterialCount,
        textures: nextTextureCount,
        totalVertices: nextTotalVertices,
      },
    };
    this.onViewStateChange?.(this.viewState);
  }

  private getCurrentDrawCalls() {
    const engineWithCounter = this.engine as Engine & {
      _drawCalls?: {
        current?: number;
        fetchNewFrame?: () => void;
      };
    };
    return engineWithCounter._drawCalls?.current ?? 0;
  }

  private getCurrentMaterialCount() {
    return this.scene.materials.length;
  }

  private getCurrentTextureCount() {
    return this.scene.textures.length;
  }

  private getCurrentTotalVertices() {
    return this.scene.meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0);
  }

  private bindDrawCallCounter() {
    const engineWithCounter = this.engine as Engine & {
      _drawCalls?: {
        fetchNewFrame?: () => void;
      };
    };

    this.beforeAnimationsObserver = this.scene.onBeforeAnimationsObservable.add(() => {
      engineWithCounter._drawCalls?.fetchNewFrame?.();
    });

    this.afterRenderObserver = this.scene.onAfterRenderObservable.add(() => {
      this.sampleDrawCalls();
    });
  }

  private persistLiveAutosave() {
    if (!this.persistenceReady) {
      return;
    }

    if (!this.settings.saveOnEveryUiUpdate) {
      return;
    }

    const snapshotText = this.getSerializedSceneText();
    if (snapshotText === this.lastAutosavedSnapshotText) {
      return;
    }

    this.lastAutosavedSnapshotText = snapshotText;
    saveAutosavedScene(JSON.parse(snapshotText) as SerializedAssetScene);
  }

  private scheduleTimedAutosave() {
    if (!this.persistenceReady) {
      return;
    }

    if (!this.settings.autosaveEnabled) {
      this.clearPendingTimedAutosave();
      return;
    }

    const snapshotText = this.getSerializedSceneText();
    if (snapshotText === this.lastTimedAutosaveSnapshotText || snapshotText === this.pendingTimedAutosaveSnapshotText) {
      return;
    }

    this.pendingTimedAutosaveSnapshotText = snapshotText;
    this.clearPendingAutosaveTimer();
    this.autosaveTimeoutId = window.setTimeout(() => {
      this.flushTimedAutosave();
    }, this.settings.autosaveIntervalSeconds * 1000);
  }

  private flushTimedAutosave() {
    if (!this.persistenceReady || !this.settings.autosaveEnabled || !this.pendingTimedAutosaveSnapshotText) {
      return;
    }

    this.lastTimedAutosaveSnapshotText = this.pendingTimedAutosaveSnapshotText;
    this.lastAutosaveAt = saveAutosaveVersion(
      JSON.parse(this.pendingTimedAutosaveSnapshotText) as SerializedAssetScene,
    );
    this.pendingTimedAutosaveSnapshotText = null;
    this.clearPendingAutosaveTimer();
    this.viewState = this.buildViewState();
    this.onViewStateChange?.(this.viewState);
  }

  private clearPendingAutosaveTimer() {
    if (this.autosaveTimeoutId !== null) {
      window.clearTimeout(this.autosaveTimeoutId);
      this.autosaveTimeoutId = null;
    }
  }

  private clearPendingTimedAutosave() {
    this.pendingTimedAutosaveSnapshotText = null;
    this.clearPendingAutosaveTimer();
  }

  private buildSceneMetadata(): SerializedAssetSceneMetadata {
    return {
      snapEnabled: this.snapEnabled,
      ySnapEnabled: this.ySnapEnabled,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      environmentIntensity: this.settings.environmentIntensity,
      lightIntensity: this.settings.lightIntensity,
      gridVisible: this.settings.gridVisible,
      gridColor: this.settings.gridColor,
      groundColor: this.settings.groundColor,
      sceneGroups: Array.from(
        this.groups.values(),
        (group): SerializedSceneGroup => ({
          id: group.id,
          name: group.name,
          childIds: [...group.childIds],
          hidden: group.hidden,
          locked: group.locked,
          parentId: group.parentId,
        }),
      ),
      sceneRootOrder: [...this.sceneRootOrder],
    };
  }

  private getSerializedScene() {
    const serializableObjects: AssetSceneSerializableObject[] = Array.from(this.objects.values(), (object) => ({
      id: object.id,
      libraryId: object.libraryId,
      assetId: object.assetId,
      position: [object.root.position.x, object.root.position.y, object.root.position.z],
      rotationDegrees: [
        this.toDegrees(object.root.rotation.x),
        this.toDegrees(object.root.rotation.y),
        this.toDegrees(object.root.rotation.z),
      ],
      rotationYDegrees: this.toDegrees(object.root.rotation.y),
      name: object.name,
      hidden: object.hidden,
      locked: object.locked,
      parentId: object.parentId,
    }));

    return serializeAssetScene(serializableObjects, this.buildSceneMetadata());
  }

  private getSerializedSceneText() {
    return JSON.stringify(this.getSerializedScene(), null, 2);
  }

  private async restoreSerializedScene(serialized: SerializedAssetScene) {
    this.disposePreview();
    this.clearSelection();
    clearSceneObjects(this.objects, this.gizmoManager);
    this.disposeAllGroups();
    this.sceneRootOrder = [];
    this.applySceneMetadata(serialized.metadata);

    for (const entry of serialized.objects) {
      const objectLibraryId = entry.libraryId;
      const asset = findAssetByRef({ libraryId: objectLibraryId, assetId: entry.assetId });
      if (!asset) {
        continue;
      }

      const template = await this.getAssetTemplate(asset, objectLibraryId);
      const root = await instantiateAsset(
        asset,
        false,
        template,
        this.scene,
        entry.placementKind === "clone" || entry.placementKind === "instance" ? entry.placementKind : "instance",
        this.settings.freezeModelMaterials,
      );
      if (!root) {
        continue;
      }

      root.position.set(entry.position[0], entry.position[1], entry.position[2]);
      const rotationDegrees = Array.isArray(entry.rotationDegrees)
        ? entry.rotationDegrees
        : [0, entry.rotationYDegrees ?? 0, 0];
      root.rotation.set(
        this.toRadians(rotationDegrees[0] ?? 0),
        this.toRadians(rotationDegrees[1] ?? 0),
        this.toRadians(rotationDegrees[2] ?? 0),
      );

      const id = typeof entry.id === "string" && entry.id ? entry.id : `object-${++this.objectSequence}`;
      const numericObjectId = Number(id.replace("object-", ""));
      if (Number.isFinite(numericObjectId)) {
        this.objectSequence = Math.max(this.objectSequence, numericObjectId);
      }
      const defaultName = this.createNextSceneObjectName(asset.name);
      root.metadata = {
        objectId: id,
        libraryId: objectLibraryId,
        assetId: asset.id,
        templateSize: template.size.asArray(),
      };
      this.tagHierarchy(root, id);
      this.objects.set(id, {
        id,
        libraryId: objectLibraryId,
        assetId: asset.id,
        placementKind:
          entry.placementKind === "clone" || entry.placementKind === "instance" ? entry.placementKind : "instance",
        root,
        name: entry.name?.trim() || defaultName,
        hidden: !!entry.hidden,
        locked: !!entry.locked,
        type: "object",
        parentId: entry.parentId ?? null,
      });
      root.name = entry.name?.trim() || defaultName;
      this.applyObjectVisibility(id);
      if (!entry.parentId && !this.sceneRootOrder.includes(id)) {
        this.sceneRootOrder.push(id);
      }
    }

    this.groups.forEach((group) => {
      group.childIds.forEach((childId) => {
        const childGroup = this.groups.get(childId);
        if (childGroup) {
          childGroup.root.setParent(group.root);
          childGroup.parentId = group.id;
          return;
        }

        const childObject = this.objects.get(childId);
        if (!childObject) {
          return;
        }
        childObject.root.setParent(group.root);
        childObject.parentId = group.id;
      });
    });

    Array.from(this.groups.values())
      .sort((left, right) => this.getGroupDepth(left.id) - this.getGroupDepth(right.id))
      .reverse()
      .forEach((group) => {
        this.recenterGroupRoot(group.id);
      });

    this.groups.forEach((group) => {
      if (!group.parentId && !this.sceneRootOrder.includes(group.id)) {
        this.sceneRootOrder.push(group.id);
      }
    });

    this.normalizeSceneRootOrder();

    this.mode = "select";
    this.emitViewState();
  }

  private applySceneMetadata(metadata?: SerializedAssetSceneMetadata) {
    if (!metadata) {
      return;
    }

    if (typeof metadata.snapEnabled === "boolean") {
      this.snapEnabled = metadata.snapEnabled;
    }
    if (typeof metadata.ySnapEnabled === "boolean") {
      this.ySnapEnabled = metadata.ySnapEnabled;
    }
    if (GRID_SIZE_OPTIONS.includes(metadata.gridSize as (typeof GRID_SIZE_OPTIONS)[number])) {
      this.gridSize = metadata.gridSize as number;
      this.settings.gridSize = this.gridSize;
    }
    if (typeof metadata.rotationStepDegrees === "number") {
      this.rotationStepDegrees = metadata.rotationStepDegrees;
    }
    if (typeof metadata.environmentIntensity === "number") {
      this.settings.environmentIntensity = metadata.environmentIntensity;
    }
    if (typeof metadata.lightIntensity === "number") {
      this.settings.lightIntensity = metadata.lightIntensity;
    }
    if (typeof metadata.gridVisible === "boolean") {
      this.settings.gridVisible = metadata.gridVisible;
    }
    if (typeof metadata.gridColor === "string") {
      this.settings.gridColor = metadata.gridColor;
    }
    if (typeof metadata.groundColor === "string") {
      this.settings.groundColor = metadata.groundColor;
    }
    if (Array.isArray(metadata.sceneGroups)) {
      metadata.sceneGroups.forEach((group) => {
        this.groups.set(group.id, {
          id: group.id,
          name: group.name,
          type: "group",
          childIds: [...group.childIds],
          hidden: !!group.hidden,
          locked: !!group.locked,
          parentId: group.parentId ?? null,
          root: this.createGroupRoot(group.id),
        });
      });
      this.groupSequence = Math.max(
        0,
        ...metadata.sceneGroups.map((group) => Number(group.id.replace("group-", "")) || 0),
      );
    }
    if (Array.isArray(metadata.sceneRootOrder)) {
      this.sceneRootOrder = [...metadata.sceneRootOrder];
    }

    this.applySnapSettings();
    this.renderGrid();
    this.applyEnvironmentSetting();
    this.applyLightIntensity();
    this.applyGroundColor();
    this.saveUserSettings();
  }

  private beginHistoryGesture() {
    this.sessionController.beginHistoryGesture(!!this.selectedObjectId || !!this.selectedGroupId);
  }

  private completeHistoryGesture() {
    this.sessionController.completeHistoryGesture();
  }

  private pushHistoryCheckpoint(previousSnapshot?: string) {
    this.sessionController.pushHistoryCheckpoint(previousSnapshot);
  }

  private setStatusNotice(message: string | null) {
    this.statusNotice = message;
    this.emitViewState();
  }

  private clearSelectionVisuals() {
    this.selectedSceneItemIds.forEach((itemId) => {
      const selectedGroup = this.groups.get(itemId);
      if (selectedGroup) {
        this.setGroupHighlight(selectedGroup, false);
      }
    });

    if (this.selectedObjectId) {
      this.selectedObjectId = clearSceneSelection(this.objects, this.selectedObjectId, this.gizmoManager);
    } else {
      this.gizmoManager.attachToNode(null);
    }
  }

  private applySceneItemSelection(selectionIds: Iterable<string>, primaryId: string | null, emit = true) {
    this.clearSelectionVisuals();

    const nextSelectedIds = Array.from(
      new Set(Array.from(selectionIds).filter((id) => this.objects.has(id) || this.groups.has(id))),
    );
    this.selectedSceneItemIds = new Set(nextSelectedIds);

    const nextPrimaryId =
      primaryId && this.selectedSceneItemIds.has(primaryId)
        ? primaryId
        : (nextSelectedIds[nextSelectedIds.length - 1] ?? null);

    this.selectedObjectId = null;
    this.selectedGroupId = null;

    if (nextPrimaryId) {
      const selectedGroup = this.groups.get(nextPrimaryId);
      if (selectedGroup && !this.isGroupHidden(selectedGroup.id)) {
        this.selectedGroupId = selectedGroup.id;
      } else {
        const selectedObject = this.objects.get(nextPrimaryId);
        if (selectedObject && !this.isObjectHidden(selectedObject)) {
          this.selectedObjectId = nextPrimaryId;
        }
      }
    }

    this.selectedSceneItemIds.forEach((itemId) => {
      const selectedGroup = this.groups.get(itemId);
      if (selectedGroup) {
        this.setGroupHighlight(selectedGroup, true);
      }
    });

    this.refreshSelectionAttachment();

    if (emit) {
      this.emitViewState();
    }
  }

  private createGroupRoot(groupId: string) {
    const root = new TransformNode(`group-root-${groupId}`, this.scene);
    root.metadata = { ...(root.metadata ?? {}), groupId };
    return root;
  }

  private disposeAllGroups() {
    this.groups.forEach((group) => {
      group.root.dispose();
    });
    this.groups.clear();
    this.selectedGroupId = null;
  }

  private setGroupHighlight(group: EditorGroup, highlighted: boolean) {
    group.root.getChildMeshes().forEach((mesh) => {
      mesh.showBoundingBox = highlighted;
      mesh.outlineColor = new Color3(0.55, 0.82, 1);
      mesh.outlineWidth = 0.03;
      mesh.renderOutline = highlighted;
    });
  }

  private getGroupDepth(groupId: string) {
    let depth = 0;
    let current = this.groups.get(groupId);
    while (current?.parentId) {
      const next = this.groups.get(current.parentId);
      if (!next) {
        break;
      }
      depth += 1;
      current = next;
    }
    return depth;
  }

  private isGroupHidden(groupId: string) {
    let current = this.groups.get(groupId);
    while (current) {
      if (current.hidden) {
        return true;
      }
      current = current.parentId ? (this.groups.get(current.parentId) ?? null) : null;
    }
    return false;
  }

  private isGroupLocked(groupId: string) {
    let current = this.groups.get(groupId);
    while (current) {
      if (current.locked) {
        return true;
      }
      current = current.parentId ? (this.groups.get(current.parentId) ?? null) : null;
    }
    return false;
  }

  private isObjectHidden(object: EditorObject) {
    return object.hidden || (object.parentId ? this.isGroupHidden(object.parentId) : false);
  }

  private isObjectLocked(object: EditorObject) {
    return object.locked || (object.parentId ? this.isGroupLocked(object.parentId) : false);
  }

  private isObjectInGroup(object: EditorObject, groupId: string) {
    let currentGroupId = object.parentId;
    while (currentGroupId) {
      if (currentGroupId === groupId) {
        return true;
      }
      currentGroupId = this.groups.get(currentGroupId)?.parentId ?? null;
    }
    return false;
  }

  private isGroupInGroup(groupId: string, ancestorGroupId: string) {
    let currentGroupId = this.groups.get(groupId)?.parentId ?? null;
    while (currentGroupId) {
      if (currentGroupId === ancestorGroupId) {
        return true;
      }
      currentGroupId = this.groups.get(currentGroupId)?.parentId ?? null;
    }
    return false;
  }

  private isSceneItemWithinGroup(itemId: string, ancestorGroupId: string) {
    const object = this.objects.get(itemId);
    if (object) {
      return this.isObjectInGroup(object, ancestorGroupId);
    }

    const group = this.groups.get(itemId);
    if (group) {
      return group.id === ancestorGroupId || this.isGroupInGroup(group.id, ancestorGroupId);
    }

    return false;
  }

  private getOrderedSelectedTopLevelSceneItemIds() {
    const selectedIds = new Set(this.selectedSceneItemIds);
    return this.buildSceneItemsViewState()
      .map((item) => item.id)
      .filter((itemId) => selectedIds.has(itemId))
      .filter((itemId) => {
        const object = this.objects.get(itemId);
        if (
          object?.parentId &&
          Array.from(selectedIds).some(
            (selectedId) => this.groups.has(selectedId) && this.isObjectInGroup(object, selectedId),
          )
        ) {
          return false;
        }

        const group = this.groups.get(itemId);
        return !Array.from(selectedIds).some(
          (selectedId) =>
            selectedId !== itemId && this.groups.has(selectedId) && this.isGroupInGroup(itemId, selectedId),
        );
      });
  }

  private getSceneItemParentId(itemId: string) {
    const object = this.objects.get(itemId);
    if (object) {
      return object.parentId;
    }

    return this.groups.get(itemId)?.parentId ?? null;
  }

  private getSceneItemInsertIndex(itemId: string, parentId: string | null) {
    return this.getContainerInsertIndex(parentId, itemId);
  }

  private getSceneItemRoot(itemId: string) {
    return this.objects.get(itemId)?.root ?? this.groups.get(itemId)?.root ?? null;
  }

  private getSceneItemLabel(itemId: string) {
    return this.objects.get(itemId)?.name ?? this.groups.get(itemId)?.name ?? "item";
  }

  private canMoveSceneItem(itemId: string) {
    const object = this.objects.get(itemId);
    if (object) {
      return !this.isObjectHidden(object) && !this.isObjectLocked(object);
    }

    const group = this.groups.get(itemId);
    if (group) {
      return !this.isGroupHidden(group.id) && !this.isGroupLocked(group.id);
    }

    return false;
  }

  private moveSelectedByCameraAxes(forwardAmount: number, rightAmount: number, emit = true) {
    const selectionIds = this.getOrderedSelectedTopLevelSceneItemIds().filter((itemId) =>
      this.canMoveSceneItem(itemId),
    );
    if (selectionIds.length === 0) {
      return;
    }

    const cameraForward = this.camera.getTarget().subtract(this.camera.position);
    cameraForward.y = 0;
    if (cameraForward.lengthSquared() <= 0.0001) {
      return;
    }
    cameraForward.normalize();
    const step = this.snapEnabled ? this.gridSize : 0.25;
    const forwardAxis =
      Math.abs(cameraForward.x) >= Math.abs(cameraForward.z)
        ? new Vector3(Math.sign(cameraForward.x) || 1, 0, 0)
        : new Vector3(0, 0, Math.sign(cameraForward.z) || 1);
    const rightAxis = new Vector3(forwardAxis.z, 0, -forwardAxis.x);
    const delta = forwardAxis.scale(forwardAmount * step).add(rightAxis.scale(rightAmount * step));
    if (delta.lengthSquared() <= 0.0001) {
      return;
    }

    const affectedParentGroupIds = new Set<string>();
    selectionIds.forEach((itemId) => {
      const root = this.getSceneItemRoot(itemId);
      if (!root) {
        return;
      }

      root.setAbsolutePosition(root.getAbsolutePosition().add(delta));
      const parentId = this.getSceneItemParentId(itemId);
      if (parentId) {
        affectedParentGroupIds.add(parentId);
      }
    });

    affectedParentGroupIds.forEach((groupId) => {
      this.recenterGroupRoot(groupId);
    });

    if (emit) {
      this.emitViewState();
    }
  }

  private getDefaultPlacementKindForAsset(asset: AssetDefinition) {
    return asset.defaultPlacementKind ?? this.settings.newObjectPlacementKind;
  }

  private isMovementKeyCode(code: string) {
    return code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD";
  }

  private beginHeldMovement(code: string, forwardAmount: number, rightAmount: number) {
    const wasEmpty = this.heldMovementKeys.size === 0;
    this.heldMovementKeys.add(code);
    if (wasEmpty) {
      this.beginHistoryGesture();
    }
    if (forwardAmount !== 0 || rightAmount !== 0) {
      this.moveSelectedByCameraAxes(forwardAmount, rightAmount);
      const now = performance.now();
      this.lastHeldMovementAt = now;
      this.heldMovementRepeatReadyAt = now + ModularEditorApp.HELD_MOVEMENT_INITIAL_DELAY_MS;
      this.lastHeldMovementViewStateAt = this.lastHeldMovementAt;
    }
  }

  private processHeldMovement(now: number) {
    if (this.mode !== "select" || this.heldMovementKeys.size === 0) {
      return;
    }

    if (now < this.heldMovementRepeatReadyAt) {
      return;
    }

    if (now - this.lastHeldMovementAt < ModularEditorApp.HELD_MOVEMENT_REPEAT_INTERVAL_MS) {
      return;
    }

    let forwardAmount = 0;
    let rightAmount = 0;
    if (this.heldMovementKeys.has("KeyW")) {
      forwardAmount += 1;
    }
    if (this.heldMovementKeys.has("KeyS")) {
      forwardAmount -= 1;
    }
    if (this.heldMovementKeys.has("KeyA")) {
      rightAmount -= 1;
    }
    if (this.heldMovementKeys.has("KeyD")) {
      rightAmount += 1;
    }

    if (forwardAmount === 0 && rightAmount === 0) {
      return;
    }

    const shouldEmitViewState = now - this.lastHeldMovementViewStateAt >= 180;
    this.moveSelectedByCameraAxes(forwardAmount, rightAmount, shouldEmitViewState);
    this.lastHeldMovementAt = now;
    if (shouldEmitViewState) {
      this.lastHeldMovementViewStateAt = now;
    }
  }

  private clearHeldMovement() {
    const shouldFlushViewState = this.heldMovementKeys.size > 0;
    this.heldMovementKeys.clear();
    this.heldMovementRepeatReadyAt = 0;
    this.completeHistoryGesture();
    if (shouldFlushViewState) {
      this.emitViewState();
    }
  }

  private clearSelectionIfInsideGroup(groupId: string) {
    const remainingSelectionIds = Array.from(this.selectedSceneItemIds).filter((itemId) => {
      const selectedObject = this.objects.get(itemId);
      if (selectedObject) {
        return !this.isObjectInGroup(selectedObject, groupId);
      }

      const selectedGroup = this.groups.get(itemId);
      if (selectedGroup) {
        return selectedGroup.id !== groupId && !this.isGroupInGroup(selectedGroup.id, groupId);
      }

      return false;
    });

    if (remainingSelectionIds.length === this.selectedSceneItemIds.size) {
      return false;
    }

    this.applySceneItemSelection(
      remainingSelectionIds,
      remainingSelectionIds[remainingSelectionIds.length - 1] ?? null,
    );
    return true;
  }

  private isGroupWithinGroup(groupId: string, potentialAncestorId: string) {
    let current = this.groups.get(groupId);
    while (current?.parentId) {
      if (current.parentId === potentialAncestorId) {
        return true;
      }
      current = this.groups.get(current.parentId);
    }
    return false;
  }

  private getGroupChildren(group: EditorGroup) {
    return group.childIds
      .map((childId) => this.groups.get(childId)?.root ?? this.objects.get(childId)?.root ?? null)
      .filter((child): child is TransformNode => !!child && child.getChildMeshes().length > 0);
  }

  private getContainerInsertIndex(containerId: string | null, targetId: string) {
    const children = containerId ? (this.groups.get(containerId)?.childIds ?? []) : this.sceneRootOrder;
    return children.indexOf(targetId);
  }

  private forEachGroupDescendantObject(groupId: string, callback: (object: EditorObject) => void) {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    group.childIds.forEach((childId) => {
      const childGroup = this.groups.get(childId);
      if (childGroup) {
        this.forEachGroupDescendantObject(childGroup.id, callback);
        return;
      }

      const childObject = this.objects.get(childId);
      if (childObject) {
        callback(childObject);
      }
    });
  }

  private insertRootId(itemId: string, insertIndex?: number) {
    const nextRootOrder = this.sceneRootOrder.filter((id) => id !== itemId);
    const safeIndex =
      insertIndex === undefined ? nextRootOrder.length : Math.min(nextRootOrder.length, Math.max(0, insertIndex));
    nextRootOrder.splice(safeIndex, 0, itemId);
    this.sceneRootOrder = nextRootOrder;
  }

  private removeRootId(itemId: string) {
    this.sceneRootOrder = this.sceneRootOrder.filter((id) => id !== itemId);
  }

  private removeGroupFromParentContainer(group: EditorGroup) {
    if (group.parentId) {
      const parentGroupId = group.parentId;
      const parentGroup = this.groups.get(parentGroupId);
      if (parentGroup) {
        parentGroup.childIds = parentGroup.childIds.filter((id) => id !== group.id);
      }
      group.root.setParent(null);
      group.parentId = null;
      this.cleanupGroupAfterChildRemoval(parentGroupId);
      return;
    }

    this.removeRootId(group.id);
  }

  private insertGroupIntoRoot(group: EditorGroup, insertIndex?: number) {
    group.root.setParent(null);
    group.parentId = null;
    this.insertRootId(group.id, insertIndex);
  }

  private insertGroupIntoGroup(group: EditorGroup, parentGroupId: string, insertIndex?: number) {
    const parentGroup = this.groups.get(parentGroupId);
    if (!parentGroup || parentGroup.id === group.id || this.isGroupWithinGroup(parentGroup.id, group.id)) {
      return false;
    }

    group.root.setParent(parentGroup.root);
    group.parentId = parentGroup.id;
    const nextChildIds = parentGroup.childIds.filter((id) => id !== group.id);
    const safeIndex =
      insertIndex === undefined ? nextChildIds.length : Math.min(nextChildIds.length, Math.max(0, insertIndex));
    nextChildIds.splice(safeIndex, 0, group.id);
    parentGroup.childIds = nextChildIds;
    this.recenterGroupRoot(parentGroup.id);
    return true;
  }

  private getNextParentContainerId(parentId: string | null) {
    const parentGroup = parentId ? this.groups.get(parentId) : null;
    return parentGroup?.parentId ?? null;
  }

  private getSiblingInsertIndexAfterParent(parentId: string | null) {
    if (!parentId) {
      return this.sceneRootOrder.length;
    }

    const parentGroup = this.groups.get(parentId);
    if (!parentGroup) {
      return this.sceneRootOrder.length;
    }

    const parentContainerId = parentGroup.parentId;
    const parentInsertIndex = this.getContainerInsertIndex(parentContainerId, parentGroup.id);
    return parentInsertIndex >= 0 ? parentInsertIndex + 1 : undefined;
  }

  private getPreviousSiblingGroupId(itemId: string) {
    const parentId = this.getSceneItemParentId(itemId);
    const siblings = parentId ? (this.groups.get(parentId)?.childIds ?? []) : this.sceneRootOrder;
    const itemIndex = siblings.indexOf(itemId);
    if (itemIndex <= 0) {
      return null;
    }

    for (let index = itemIndex - 1; index >= 0; index -= 1) {
      const siblingId = siblings[index];
      if (this.groups.has(siblingId)) {
        return siblingId;
      }
    }

    return null;
  }

  private recenterGroupRoot(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    const children = this.getGroupChildren(group);

    if (children.length === 0) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;

    children.forEach((child) => {
      const bounds = child.getHierarchyBoundingVectors();
      min = min ? Vector3.Minimize(min, bounds.min) : bounds.min.clone();
      max = max ? Vector3.Maximize(max, bounds.max) : bounds.max.clone();
    });

    if (!min || !max) {
      return;
    }

    const center = min.add(max).scale(0.5);
    children.forEach((child) => {
      child.setParent(null);
    });
    group.root.position.copyFrom(center);
    children.forEach((child) => {
      child.setParent(group.root);
    });

    if (group.parentId) {
      this.recenterGroupRoot(group.parentId);
    }
  }

  private cleanupGroupAfterChildRemoval(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    if (group.childIds.length === 0) {
      if (group.parentId) {
        this.recenterGroupRoot(group.parentId);
      }
      return;
    }

    this.recenterGroupRoot(groupId);
  }

  private applyObjectVisibility(objectId: string) {
    const object = this.objects.get(objectId);
    if (!object) {
      return;
    }

    const hidden = this.isObjectHidden(object);
    object.root.setEnabled(!hidden);
    object.root.getChildMeshes().forEach((mesh) => {
      mesh.isPickable = !hidden;
    });
  }

  private applyGroupVisibility(groupId: string) {
    this.forEachGroupDescendantObject(groupId, (object) => {
      this.applyObjectVisibility(object.id);
    });
  }

  private refreshSelectionAttachment() {
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group || this.isGroupHidden(group.id) || this.isGroupLocked(group.id)) {
        this.gizmoManager.attachToNode(null);
        return;
      }
      this.gizmoManager.attachToNode(group.root);
      this.applyRotationAxis();
      return;
    }

    if (!this.selectedObjectId) {
      this.gizmoManager.attachToNode(null);
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || this.isObjectHidden(object) || this.isObjectLocked(object)) {
      this.gizmoManager.attachToNode(null);
      return;
    }

    this.gizmoManager.attachToNode(object.root);
    this.applyRotationAxis();
  }

  private getSelectedRoot() {
    if (this.selectedGroupId) {
      return this.groups.get(this.selectedGroupId)?.root ?? null;
    }

    if (!this.selectedObjectId) {
      return null;
    }

    return this.objects.get(this.selectedObjectId)?.root ?? null;
  }

  private getSelectionHelperRenderKey() {
    const root = this.getSelectedRoot();
    if (!root) {
      return "none";
    }

    const absolutePosition = root.getAbsolutePosition();
    const rotation = root.rotationQuaternion
      ? [root.rotationQuaternion.x, root.rotationQuaternion.y, root.rotationQuaternion.z, root.rotationQuaternion.w]
      : [root.rotation.x, root.rotation.y, root.rotation.z, 0];

    return [
      root.uniqueId,
      absolutePosition.x.toFixed(4),
      absolutePosition.y.toFixed(4),
      absolutePosition.z.toFixed(4),
      rotation.map((value) => value.toFixed(4)).join(","),
      root.scaling.x.toFixed(4),
      root.scaling.y.toFixed(4),
      root.scaling.z.toFixed(4),
      this.ySnapEnabled ? "ysnap:1" : "ysnap:0",
      `label:${this.settings.heightLabelMode}`,
    ].join("|");
  }

  private renderSelectionVerticalHelperIfNeeded() {
    const nextRenderKey = this.getSelectionHelperRenderKey();
    if (nextRenderKey === this.lastSelectionHelperRenderKey) {
      return;
    }

    this.lastSelectionHelperRenderKey = nextRenderKey;
    this.renderSelectionVerticalHelper();
  }

  private renderSelectionVerticalHelper() {
    this.selectionVerticalHelper = this.sceneCore.renderVerticalHelper(
      this.selectionVerticalHelper,
      this.getSelectedRoot(),
      this.ySnapEnabled,
    );
    this.selectionHeightLabel = this.sceneCore.renderHeightLabel(
      this.selectionHeightLabel,
      this.getSelectedRoot(),
      this.ySnapEnabled,
      this.settings.heightLabelMode,
    );
    this.selectionVerticalHelperMarker = this.sceneCore.renderVerticalHelperMarker(
      this.selectionVerticalHelperMarker,
      this.getSelectedRoot(),
      this.ySnapEnabled,
    );
  }

  private async ensurePreviewForAsset(libraryId: string, assetId: string) {
    this.disposePreview();
    const asset = findAssetByRef({ libraryId, assetId });
    if (!asset) {
      return;
    }

    const template = await this.getAssetTemplate(asset, libraryId);
    const preview = await instantiateAsset(asset, true, template, this.scene, "clone", false);
    if (!preview) {
      return;
    }

    this.previewTemplateSize = template.size.clone();
    this.placementPreview = preview;
    this.previewAssetLibraryId = libraryId;
    this.previewAssetId = assetId;
    this.updatePreviewTransform();
  }

  private async placeActiveAsset() {
    if (!this.previewAssetId) {
      return;
    }

    const asset = this.previewAssetLibraryId
      ? findAssetByRef({ libraryId: this.previewAssetLibraryId, assetId: this.previewAssetId })
      : null;
    if (!asset) {
      return;
    }

    const template = await this.getAssetTemplate(asset, this.previewAssetLibraryId ?? ACTIVE_LIBRARY.id);
    const placementKind = this.getDefaultPlacementKindForAsset(asset);
    const root = await instantiateAsset(asset, false, template, this.scene, placementKind, this.settings.freezeModelMaterials);
    if (!root) {
      return;
    }

    root.position.copyFrom(this.placementPreview?.position ?? Vector3.Zero());
    root.rotation.copyFrom(this.placementPreview?.rotation ?? Vector3.Zero());

    const id = `object-${++this.objectSequence}`;
    const defaultName = this.createNextSceneObjectName(asset.name);
    root.metadata = {
      objectId: id,
      libraryId: this.previewAssetLibraryId ?? ACTIVE_LIBRARY.id,
      assetId: asset.id,
      templateSize: this.previewTemplateSize.asArray(),
    };
    this.tagHierarchy(root, id);
    this.objects.set(id, {
      id,
      libraryId: this.previewAssetLibraryId ?? ACTIVE_LIBRARY.id,
      assetId: asset.id,
      placementKind,
      root,
      name: defaultName,
      hidden: false,
      locked: false,
      type: "object",
      parentId: null,
    });
    root.name = defaultName;
    this.sceneRootOrder.push(id);
    this.selectObjectByRoot(root);
    this.pushHistoryCheckpoint();

    if (this.activeAssetId === asset.id) {
      this.mode = "place";
      await this.ensurePreviewForAsset(this.activeAssetLibraryId, asset.id);
      this.emitViewState();
    }
  }

  private async getAssetTemplate(asset: AssetDefinition, libraryId: string): Promise<AssetTemplate> {
    const templateKey = getAssetRefKey({ libraryId, assetId: asset.id });
    if (!this.assetTemplates.has(templateKey)) {
      this.assetTemplates.set(templateKey, this.loadAssetTemplate(asset, libraryId));
    }
    return this.assetTemplates.get(templateKey)!;
  }

  private async loadAssetTemplate(asset: AssetDefinition, libraryId: string): Promise<AssetTemplate> {
    return loadAssetTemplate(
      asset,
      this.scene,
      getAssetBasePathForLibrary(libraryId),
      false,
    );
  }

  private renderGrid() {
    this.applyGroundAppearance();
    this.gridMesh = this.sceneCore.renderProceduralGrid(
      this.gridMesh,
      this.gridSize,
      this.gridPlaneSize,
      this.settings.gridVisible && this.settings.gridRenderMode === "lines",
      this.settings.gridColor,
    );
    this.originMarker = this.sceneCore.renderOriginMarker(
      this.originMarker,
      this.settings.gridVisible,
      this.settings.gridColor,
    );
  }

  private updatePreviewTransform() {
    const gridSize = this.getEffectiveGridSize();
    const previewRotationRadians = new Vector3(
      this.toRadians(this.previewRotation.x),
      this.toRadians(this.previewRotation.y),
      this.toRadians(this.previewRotation.z),
    );
    const targetPoint = this.snapEnabled
      ? snapVectorForSize(this.lastPointerPoint, this.previewTemplateSize, this.snapEnabled, gridSize)
      : this.lastPointerPoint.clone();
    const nextPreviewTransformKey = [
      targetPoint.x.toFixed(4),
      targetPoint.y.toFixed(4),
      targetPoint.z.toFixed(4),
      previewRotationRadians.x.toFixed(4),
      previewRotationRadians.y.toFixed(4),
      previewRotationRadians.z.toFixed(4),
      this.snapEnabled ? "snap:1" : "snap:0",
      gridSize.toFixed(4),
    ].join("|");
    if (nextPreviewTransformKey === this.lastPreviewTransformKey) {
      return;
    }

    this.lastPreviewTransformKey = nextPreviewTransformKey;
    this.sceneCore.updatePreviewTransform(
      this.placementPreview,
      this.lastPointerPoint,
      this.previewTemplateSize,
      this.snapEnabled,
      gridSize,
      previewRotationRadians,
    );
  }

  private snapSelectedObject() {
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group) {
        return;
      }

      if (this.snapEnabled) {
        const snapped = snapVectorForSize(group.root.position, new Vector3(1, 1, 1), this.snapEnabled, this.gridSize);
        group.root.position.x = snapped.x;
        group.root.position.z = snapped.z;
        if (this.ySnapEnabled) {
          group.root.position.y = snapScalar(group.root.position.y, this.gridSize);
        }
        group.root.rotation[this.rotationAxis] = this.snapAngle(group.root.rotation[this.rotationAxis]);
      }

      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object) {
      return;
    }

    if (this.snapEnabled) {
      const templateSize = Array.isArray(object.root.metadata?.templateSize)
        ? Vector3.FromArray(object.root.metadata.templateSize as number[])
        : new Vector3(1, 1, 1);
      const snapped = snapVectorForSize(object.root.position, templateSize, this.snapEnabled, this.gridSize);
      object.root.position.x = snapped.x;
      object.root.position.z = snapped.z;
      if (this.ySnapEnabled) {
        object.root.position.y = snapScalar(object.root.position.y, this.gridSize);
      }
      object.root.rotation[this.rotationAxis] = this.snapAngle(object.root.rotation[this.rotationAxis]);
    }

    this.emitViewState();
  }

  private snapAngle(valueRadians: number) {
    return this.normalizeRadians(
      snapPlacementAngle(valueRadians, this.snapEnabled, this.toRadians(this.rotationStepDegrees)),
    );
  }

  private rotateActiveTarget() {
    if (this.mode === "place" && this.placementPreview) {
      this.previewRotation[this.rotationAxis] =
        (this.previewRotation[this.rotationAxis] + this.rotationStepDegrees) % 360;
      this.updatePreviewTransform();
      return;
    }

    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group) {
        return;
      }

      group.root.rotation[this.rotationAxis] = this.snapAngle(
        group.root.rotation[this.rotationAxis] + this.toRadians(this.rotationStepDegrees),
      );
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || this.isObjectLocked(object) || this.isObjectHidden(object)) {
      return;
    }

    object.root.rotation[this.rotationAxis] = this.snapAngle(
      object.root.rotation[this.rotationAxis] + this.toRadians(this.rotationStepDegrees),
    );
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private async duplicateSelectedObject() {
    if (this.selectedGroupId) {
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const source = this.objects.get(this.selectedObjectId);
    if (!source) {
      return;
    }

    const asset = findAssetByRef({ libraryId: source.libraryId, assetId: source.assetId });
    if (!asset) {
      return;
    }

    const template = await this.getAssetTemplate(asset, source.libraryId);
    const placementKind = source.placementKind ?? this.getDefaultPlacementKindForAsset(asset);
    const root = await instantiateAsset(asset, false, template, this.scene, placementKind, this.settings.freezeModelMaterials);
    if (!root) {
      return;
    }

    const templateSize = Array.isArray(source.root.metadata?.templateSize)
      ? Vector3.FromArray(source.root.metadata.templateSize as number[])
      : template.size.clone();
    root.position.copyFrom(source.root.position);
    root.position.x += Math.max(this.gridSize, templateSize.x || this.gridSize);
    root.rotation.copyFrom(source.root.rotation);

    if (this.snapEnabled) {
      const snapped = snapVectorForSize(root.position, templateSize, this.snapEnabled, this.gridSize);
      root.position.x = snapped.x;
      root.position.z = snapped.z;
      root.rotation[this.rotationAxis] = this.snapAngle(root.rotation[this.rotationAxis]);
    }

    const id = `object-${++this.objectSequence}`;
    const nextName = this.createDuplicateSceneObjectName(source, asset);
    root.metadata = {
      objectId: id,
      libraryId: source.libraryId,
      assetId: asset.id,
      templateSize: templateSize.asArray(),
    };
    this.tagHierarchy(root, id);
    this.objects.set(id, {
      id,
      libraryId: source.libraryId,
      assetId: asset.id,
      placementKind,
      root,
      name: nextName,
      hidden: false,
      locked: source.locked,
      type: "object",
      parentId: source.parentId,
    });
    root.name = nextName;
    if (source.parentId) {
      const group = this.groups.get(source.parentId);
      if (group) {
        const sourceIndex = group.childIds.indexOf(source.id);
        group.childIds.splice(sourceIndex >= 0 ? sourceIndex + 1 : group.childIds.length, 0, id);
      }
    } else {
      const sourceIndex = this.sceneRootOrder.indexOf(source.id);
      this.sceneRootOrder.splice(sourceIndex >= 0 ? sourceIndex + 1 : this.sceneRootOrder.length, 0, id);
    }
    this.selectObjectByRoot(root);
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Duplicated ${asset.name}.`);
  }

  private frameSelectedObject() {
    if (this.selectedGroupId) {
      const selectedGroup = this.groups.get(this.selectedGroupId);
      if (!selectedGroup) {
        return;
      }

      this.sceneCore.frameSelection(this.camera, selectedGroup.root);
      this.setStatusNotice(`Framed ${selectedGroup.name}.`);
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const selected = this.objects.get(this.selectedObjectId);
    if (!selected) {
      return;
    }

    this.sceneCore.frameSelection(this.camera, selected.root);
    this.setStatusNotice(
      `Framed ${findAssetByRef({ libraryId: selected.libraryId, assetId: selected.assetId })?.name ?? "selection"}.`,
    );
  }

  private deleteSelectedObject() {
    if (this.selectedSceneItemIds.size > 1) {
      const selectedIds = Array.from(this.selectedSceneItemIds);
      this.clearSelection();
      selectedIds.forEach((itemId) => {
        this.deleteSceneItem(itemId);
      });
      return;
    }

    if (this.selectedObjectId) {
      const deleted = deleteSceneObject(this.objects, this.selectedObjectId, this.gizmoManager);
      if (!deleted) {
        return;
      }

      this.selectedSceneItemIds.delete(this.selectedObjectId);
      this.selectedObjectId = null;
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (this.selectedGroupId) {
      this.deleteSceneItem(this.selectedGroupId);
    }
  }

  private clearScene() {
    const cleared = clearSceneObjects(this.objects, this.gizmoManager);
    const hadGroups = this.groups.size > 0;
    if (!cleared && !hadGroups) {
      return;
    }

    this.disposePreview();
    this.selectedSceneItemIds.clear();
    this.selectedObjectId = null;
    this.selectedGroupId = null;
    this.disposeAllGroups();
    this.sceneRootOrder = [];
    this.mode = "select";
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private clearSelection() {
    this.applySceneItemSelection([], null);
  }

  private selectObjectByRoot(root: TransformNode) {
    const objectId = selectSceneObject(root, this.gizmoManager);
    if (!objectId) {
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || this.isObjectHidden(object)) {
      return;
    }

    this.applySceneItemSelection([objectId], objectId, false);
    this.mode = "select";
    this.disposePreview();
    this.emitViewState();
  }

  private disposePreview() {
    this.placementPreview = this.sceneCore.disposePreview(this.placementPreview);
    this.previewAssetLibraryId = null;
    this.previewAssetId = null;
    this.lastPreviewTransformKey = null;
  }

  private applySnapSettings() {
    this.sceneCore.applySnapSettings(this.snapEnabled, this.gridSize, this.toRadians(this.rotationStepDegrees));
  }

  private applyRotationAxis() {
    this.sceneCore.applyRotationAxis(this.rotationAxis);
  }

  private applyEnvironmentSetting() {
    if (this.settings.freezeModelMaterials) {
      // Frozen materials ignore scene.environmentTexture / environmentIntensity uniform
      // changes. Temporarily unfreeze so the new values are picked up on the next render,
      // then re-freeze afterwards.
      this.setAllModelMaterialsFrozen(false);
    }

    this.sceneCore.applyEnvironmentSetting(
      this.defaultEnvironmentTexture ?? null,
      this.settings.environmentEnabled,
      this.settings.environmentIntensity,
      this.defaultEnvironment?.skybox ?? null,
    );

    if (this.settings.freezeModelMaterials) {
      this.scene.onAfterRenderObservable.addOnce(() => {
        this.setAllModelMaterialsFrozen(true);
      });
    }
  }

  private applyLightIntensity() {
    this.mainLight.intensity = this.settings.lightIntensity;
  }

  private applyGroundColor() {
    this.applyGroundAppearance();
  }

  private saveUserSettings() {
    saveUserSettings(this.settings);
  }

  private recreateGround() {
    const previousGround = this.ground;
    this.ground = MeshBuilder.CreateGround(
      "ground",
      { width: this.gridPlaneSize, height: this.gridPlaneSize },
      this.scene,
    );
    this.ground.material = this.groundMaterial;
    this.ground.isPickable = true;
    previousGround?.dispose(false, false);
  }

  private applyGroundAppearance() {
    const nextMaterial =
      this.settings.gridVisible && this.settings.gridRenderMode === "material"
        ? this.createGridGroundMaterial()
        : this.createPlainGroundMaterial();

    const previousMaterial = this.ground.material;
    this.ground.material = nextMaterial;
    this.groundMaterial = nextMaterial;
    if (previousMaterial && previousMaterial !== nextMaterial) {
      previousMaterial.dispose(false, false);
    }
  }

  private createPlainGroundMaterial() {
    const material = new StandardMaterial("ground-material", this.scene);
    material.diffuseColor = Color3.FromHexString(this.settings.groundColor);
    material.specularColor = Color3.Black();
    material.freeze();
    return material;
  }

  private createGridGroundMaterial() {
    const material = new GridMaterial("ground-grid-material", this.scene);
    const majorUnitFrequency = this.gridSize < 1 ? Math.max(1, Math.round(1 / this.gridSize)) : 1;
    const minorUnitVisibility = this.gridSize <= 0.125 ? 0.56 : this.gridSize < 1 ? 0.48 : 0.35;
    const gridLineBaseColor = Color3.FromHexString(this.settings.gridColor);
    const brightenedLineColor = Color3.Lerp(
      gridLineBaseColor,
      Color3.Gray(),
      this.gridSize <= 0.125 ? 0.42 : this.gridSize < 1 ? 0.24 : 0.12,
    );
    material.mainColor = Color3.FromHexString(this.settings.groundColor);
    material.lineColor = brightenedLineColor;
    material.gridRatio = this.gridSize;
    material.majorUnitFrequency = majorUnitFrequency;
    material.minorUnitVisibility = minorUnitVisibility;
    material.opacity = 1;
    material.backFaceCulling = false;
    material.freeze();
    return material;
  }

  async activateAsset(libraryId: string, assetId: string) {
    if (this.activeAssetLibraryId === libraryId && this.activeAssetId === assetId && this.mode === "place") {
      await this.ensurePreviewForAsset(libraryId, assetId);
      this.emitViewState();
      return;
    }

    const asset = findAssetByRef({ libraryId, assetId });
    if (!asset) {
      return;
    }

    this.activeAssetLibraryId = libraryId;
    this.activeAssetId = asset.id;
    this.mode = "place";
    this.previewRotation.setAll(0);
    await this.ensurePreviewForAsset(libraryId, asset.id);
    this.emitViewState();
  }

  toggleSnap() {
    this.snapEnabled = !this.snapEnabled;
    this.applySnapSettings();
    this.updatePreviewTransform();
    this.emitViewState();
  }

  toggleYSnap() {
    this.ySnapEnabled = !this.ySnapEnabled;
    this.emitViewState();
  }

  setSelectionPosition(axis: "x" | "y" | "z", value: number) {
    if (!Number.isFinite(value)) {
      return;
    }

    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group || group.root.position[axis] === value) {
        return;
      }

      group.root.position[axis] = value;
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || object.root.position[axis] === value) {
      return;
    }

    object.root.position[axis] = value;
    if (object.parentId) {
      this.recenterGroupRoot(object.parentId);
    }
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  setSelectionRotationDegrees(axis: "x" | "y" | "z", value: number) {
    if (!Number.isFinite(value)) {
      return;
    }

    const nextRadians = this.normalizeRadians(this.toRadians(value));
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group || group.root.rotation[axis] === nextRadians) {
        return;
      }

      group.root.rotation[axis] = nextRadians;
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || object.root.rotation[axis] === nextRadians) {
      return;
    }

    object.root.rotation[axis] = nextRadians;
    this.refreshSelectionAttachment();
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private normalizeRadians(valueRadians: number) {
    const fullTurn = Math.PI * 2;
    let normalized = valueRadians % fullTurn;
    if (normalized < 0) {
      normalized += fullTurn;
    }
    if (Math.abs(normalized - fullTurn) < 0.000001 || Math.abs(normalized) < 0.000001) {
      return 0;
    }
    return normalized;
  }

  private normalizeDisplayDegrees(valueDegrees: number) {
    const normalized = ((valueDegrees % 360) + 360) % 360;
    return normalized === 360 ? 0 : normalized;
  }

  dropSelectionToGround() {
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group || group.root.position.y === 0) {
        return;
      }

      group.root.position.y = 0;
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || object.root.position.y === 0) {
      return;
    }

    object.root.position.y = 0;
    if (object.parentId) {
      this.recenterGroupRoot(object.parentId);
    }
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  enterSelectionMode() {
    if (this.mode === "select" && !this.placementPreview) {
      return;
    }

    this.clearHeldMovement();
    this.mode = "select";
    this.disposePreview();
    this.emitViewState();
  }

  async enterPlacementMode() {
    if (!this.activeAssetId || !this.activeAssetLibraryId) {
      return;
    }

    this.mode = "place";
    await this.ensurePreviewForAsset(this.activeAssetLibraryId, this.activeAssetId);
    this.emitViewState();
  }

  async undo() {
    await this.sessionController.undo();
  }

  async redo() {
    await this.sessionController.redo();
  }

  private collectVisibleExportNodes() {
    const exportNodes = new Set<Node>();

    const addNodeHierarchy = (node: TransformNode) => {
      exportNodes.add(node);
      node.getDescendants(false).forEach((descendant) => {
        exportNodes.add(descendant);
      });
    };

    this.objects.forEach((object) => {
      if (this.isObjectHidden(object)) {
        return;
      }

      addNodeHierarchy(object.root);

      let parentId = object.parentId;
      while (parentId) {
        const group = this.groups.get(parentId);
        if (!group) {
          break;
        }
        exportNodes.add(group.root);
        parentId = group.parentId;
      }
    });

    return exportNodes;
  }

  async exportToGlb() {
    const exportNodes = this.collectVisibleExportNodes();
    if (exportNodes.size === 0) {
      this.setStatusNotice("No visible scene objects to export.");
      return;
    }

    const restoreNames = this.applyCleanExportNodeNames(exportNodes);
    try {
      const glb = await GLTF2Export.GLBAsync(this.scene, "asset-scene", {
        shouldExportNode: (node) => exportNodes.has(node),
      });
      glb.downloadFiles();
      this.setStatusNotice("Scene exported as asset-scene.glb");
    } finally {
      restoreNames();
    }
  }

  async exportToGltf() {
    const exportNodes = this.collectVisibleExportNodes();
    if (exportNodes.size === 0) {
      this.setStatusNotice("No visible scene objects to export.");
      return;
    }

    const restoreNames = this.applyCleanExportNodeNames(exportNodes);
    try {
      const gltf = await GLTF2Export.GLTFAsync(this.scene, "asset-scene", {
        shouldExportNode: (node) => exportNodes.has(node),
      });

      const zip = new JSZip();
      const addedFileNames = new Set<string>();
      Object.entries(gltf.files).forEach(([fileName, fileData]) => {
        if (addedFileNames.has(fileName)) {
          return;
        }
        addedFileNames.add(fileName);
        zip.file(fileName, fileData);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "asset-scene.gltf.zip";
      anchor.click();
      URL.revokeObjectURL(url);
      this.setStatusNotice("Scene exported as asset-scene.gltf.zip");
    } finally {
      restoreNames();
    }
  }

  exportToFile() {
    this.sessionController.exportToFile();
  }

  saveSceneToLocalStorage() {
    const scene = this.getSerializedScene();
    this.lastManualSaveAt = saveManualSavedScene(scene);
    this.setStatusNotice(`Scene saved to local storage (${scene.objects.length} objects).`);
    this.emitViewState();
  }

  async importFromFile(file: File) {
    await this.sessionController.importFromFile(file);
  }

  async loadLastSavedScene() {
    const saved = loadManualSavedScene();
    if (!saved) {
      this.setStatusNotice("No saved scene found in local storage.");
      return;
    }

    await this.restoreSerializedScene(saved.scene);
    this.lastManualSaveAt = saved.savedAt;
    this.statusNotice = `Loaded last saved scene (${saved.scene.objects.length} objects).`;
    this.sessionController.resetHistory();
    this.emitViewState();
  }

  async loadAutosavedScene() {
    const autosaved = loadLatestAutosaveVersion();
    if (!autosaved) {
      this.setStatusNotice("No autosaved scene found.");
      return;
    }

    await this.restoreSerializedScene(autosaved.scene);
    this.lastAutosaveAt = autosaved.savedAt;
    this.lastRecoveredAutosaveAt = autosaved.savedAt;
    this.statusNotice = `Loaded autosaved scene (${autosaved.scene.objects.length} objects).`;
    this.sessionController.resetHistory();
    this.emitViewState();
  }

  deleteSelected() {
    this.deleteSelectedObject();
  }

  toggleSelectedHidden() {
    if (this.selectedSceneItemIds.size <= 1) {
      return;
    }

    const selectedIds = Array.from(this.selectedSceneItemIds);
    const shouldHide = selectedIds.some((itemId) => {
      const group = this.groups.get(itemId);
      if (group) {
        return !group.hidden;
      }
      const object = this.objects.get(itemId);
      return object ? !object.hidden : false;
    });

    selectedIds.forEach((itemId) => {
      const group = this.groups.get(itemId);
      if (group) {
        group.hidden = shouldHide;
        this.applyGroupVisibility(group.id);
        return;
      }

      const object = this.objects.get(itemId);
      if (object) {
        object.hidden = shouldHide;
        this.applyObjectVisibility(object.id);
      }
    });

    if (shouldHide) {
      this.clearSelection();
    } else {
      this.refreshSelectionAttachment();
      this.emitViewState();
    }
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`${shouldHide ? "Hidden" : "Shown"} ${selectedIds.length} selected items.`);
  }

  toggleSelectedLocked() {
    if (this.selectedSceneItemIds.size <= 1) {
      return;
    }

    const selectedIds = Array.from(this.selectedSceneItemIds);
    const shouldLock = selectedIds.some((itemId) => {
      const group = this.groups.get(itemId);
      if (group) {
        return !group.locked;
      }
      const object = this.objects.get(itemId);
      return object ? !object.locked : false;
    });

    selectedIds.forEach((itemId) => {
      const group = this.groups.get(itemId);
      if (group) {
        group.locked = shouldLock;
        return;
      }

      const object = this.objects.get(itemId);
      if (object) {
        object.locked = shouldLock;
      }
    });

    this.refreshSelectionAttachment();
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`${shouldLock ? "Locked" : "Unlocked"} ${selectedIds.length} selected items.`);
  }

  renameSceneItem(objectId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    const group = this.groups.get(objectId);
    if (group) {
      if (group.name === trimmed) {
        return;
      }
      group.name = trimmed;
      group.root.name = trimmed;
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Renamed to ${trimmed}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || object.name === trimmed) {
      return;
    }

    object.name = trimmed;
    object.root.name = trimmed;
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Renamed to ${trimmed}.`);
  }

  setSceneItemSelection(selectionIds: string[], primaryId: string | null = null) {
    if (selectionIds.length === 0) {
      this.clearSelection();
      return;
    }

    if (selectionIds.length === 1) {
      this.selectSceneItem(selectionIds[0]);
      return;
    }

    this.applySceneItemSelection(selectionIds, primaryId, false);
    this.mode = "select";
    this.disposePreview();
    this.emitViewState();
  }

  selectSceneItem(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      if (this.isGroupHidden(group.id)) {
        return;
      }
      this.applySceneItemSelection([group.id], group.id, false);
      this.mode = "select";
      this.disposePreview();
      this.emitViewState();
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || this.isObjectHidden(object)) {
      return;
    }

    this.applySceneItemSelection([object.id], object.id, false);
    this.mode = "select";
    this.disposePreview();
    this.emitViewState();
  }

  deleteSceneItem(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      if (this.selectedSceneItemIds.has(group.id)) {
        this.applySceneItemSelection(
          Array.from(this.selectedSceneItemIds).filter((id) => id !== group.id),
          null,
          false,
        );
      }
      const parentContainerId = this.getNextParentContainerId(group.id);
      const insertIndex = group.parentId
        ? this.getContainerInsertIndex(parentContainerId, group.id)
        : this.getContainerInsertIndex(null, group.id);
      const childIds = [...group.childIds];
      this.removeGroupFromParentContainer(group);
      childIds.forEach((childId, index) => {
        const childGroup = this.groups.get(childId);
        if (childGroup) {
          childGroup.root.setParent(null);
          childGroup.parentId = null;
          if (parentContainerId) {
            this.insertGroupIntoGroup(
              childGroup,
              parentContainerId,
              insertIndex === undefined ? undefined : insertIndex + index,
            );
          } else {
            this.insertGroupIntoRoot(childGroup, insertIndex === undefined ? undefined : insertIndex + index);
          }
          return;
        }

        const childObject = this.objects.get(childId);
        if (!childObject) {
          return;
        }
        childObject.root.setParent(null);
        childObject.parentId = null;
        if (parentContainerId) {
          this.insertObjectIntoGroup(
            childObject,
            parentContainerId,
            insertIndex === undefined ? undefined : insertIndex + index,
          );
        } else {
          this.insertObjectIntoRoot(childObject, insertIndex === undefined ? undefined : insertIndex + index);
        }
      });
      group.root.dispose();
      this.groups.delete(group.id);
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Deleted group ${group.name}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object) {
      return;
    }

    if (this.selectedSceneItemIds.has(objectId)) {
      this.applySceneItemSelection(
        Array.from(this.selectedSceneItemIds).filter((id) => id !== objectId),
        null,
        false,
      );
    } else {
      this.selectedGroupId = null;
      if (this.selectedObjectId !== objectId) {
        this.selectedObjectId = objectId;
      }
    }
    if (object.parentId) {
      const parentGroup = this.groups.get(object.parentId);
      if (parentGroup) {
        object.root.setParent(null);
        object.parentId = null;
        parentGroup.childIds = parentGroup.childIds.filter((id) => id !== object.id);
        this.cleanupGroupAfterChildRemoval(parentGroup.id);
      }
    } else {
      this.sceneRootOrder = this.sceneRootOrder.filter((id) => id !== object.id);
    }
    this.deleteSelectedObject();
  }

  duplicateSceneItem(objectId: string) {
    this.applySceneItemSelection([objectId], objectId, false);
    void this.duplicateSelectedObject();
  }

  private removeObjectFromParentContainer(object: EditorObject) {
    if (object.parentId) {
      const parentGroupId = object.parentId;
      const parentGroup = this.groups.get(parentGroupId);
      if (parentGroup) {
        parentGroup.childIds = parentGroup.childIds.filter((id) => id !== object.id);
      }
      object.root.setParent(null);
      object.parentId = null;
      this.cleanupGroupAfterChildRemoval(parentGroupId);
      return;
    }

    this.sceneRootOrder = this.sceneRootOrder.filter((id) => id !== object.id);
  }

  private insertObjectIntoRoot(object: EditorObject, insertIndex?: number) {
    object.parentId = null;
    this.insertRootId(object.id, insertIndex);
  }

  private insertObjectIntoGroup(object: EditorObject, groupId: string, insertIndex?: number) {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    object.root.setParent(group.root);
    object.parentId = groupId;
    const nextChildIds = group.childIds.filter((id) => id !== object.id);
    const safeIndex =
      insertIndex === undefined ? nextChildIds.length : Math.min(nextChildIds.length, Math.max(0, insertIndex));
    nextChildIds.splice(safeIndex, 0, object.id);
    group.childIds = nextChildIds;
    this.recenterGroupRoot(groupId);
    return true;
  }

  createEmptyGroup() {
    const groupId = `group-${++this.groupSequence}`;
    const groupName = `Group ${String(this.groupSequence).padStart(2, "0")}`;
    const groupRoot = this.createGroupRoot(groupId);
    groupRoot.name = groupName;
    groupRoot.position.set(0, 0, 0);
    this.groups.set(groupId, {
      id: groupId,
      name: groupName,
      type: "group",
      childIds: [],
      hidden: false,
      locked: false,
      parentId: null,
      root: groupRoot,
    });
    this.sceneRootOrder.push(groupId);
    this.applySceneItemSelection([groupId], groupId, false);
    this.refreshSelectionAttachment();
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Created empty ${groupName}.`);
  }

  createGroupFromSelected() {
    const selectedIds = this.getOrderedSelectedTopLevelSceneItemIds();
    if (selectedIds.length === 0) {
      return;
    }

    const parentIds = selectedIds.map((itemId) => this.getSceneItemParentId(itemId));
    const commonParentId = parentIds.every((parentId) => parentId === parentIds[0]) ? (parentIds[0] ?? null) : null;
    const commonInsertIndex =
      parentIds.every((parentId) => parentId === parentIds[0]) && selectedIds.length > 0
        ? Math.min(
            ...selectedIds
              .map((itemId) => this.getSceneItemInsertIndex(itemId, commonParentId))
              .filter((index) => index >= 0),
          )
        : undefined;

    const roots = selectedIds
      .map((itemId) => this.getSceneItemRoot(itemId))
      .filter((root): root is TransformNode => !!root);
    if (roots.length === 0) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;
    roots.forEach((root) => {
      const bounds = root.getHierarchyBoundingVectors();
      min = min ? Vector3.Minimize(min, bounds.min) : bounds.min.clone();
      max = max ? Vector3.Maximize(max, bounds.max) : bounds.max.clone();
    });
    const center = min && max ? min.add(max).scale(0.5) : Vector3.Zero();

    const groupId = `group-${++this.groupSequence}`;
    const groupName = `Group ${String(this.groupSequence).padStart(2, "0")}`;
    const groupRoot = this.createGroupRoot(groupId);
    groupRoot.name = groupName;
    groupRoot.position.copyFrom(center);
    this.groups.set(groupId, {
      id: groupId,
      name: groupName,
      type: "group",
      childIds: [],
      hidden: false,
      locked: false,
      parentId: null,
      root: groupRoot,
    });
    const newGroup = this.groups.get(groupId)!;

    selectedIds.forEach((itemId) => {
      const object = this.objects.get(itemId);
      if (object) {
        this.removeObjectFromParentContainer(object);
        object.root.setParent(groupRoot);
        object.parentId = groupId;
        newGroup.childIds.push(object.id);
        return;
      }

      const group = this.groups.get(itemId);
      if (group) {
        this.removeGroupFromParentContainer(group);
        group.root.setParent(groupRoot);
        group.parentId = groupId;
        newGroup.childIds.push(group.id);
      }
    });

    if (commonParentId) {
      this.insertGroupIntoGroup(newGroup, commonParentId, commonInsertIndex);
    } else {
      this.insertGroupIntoRoot(newGroup, commonInsertIndex);
    }

    this.applySceneItemSelection([groupId], groupId, false);
    this.refreshSelectionAttachment();
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Created ${groupName}.`);
  }

  moveSceneItem(draggedId: string, targetId: string) {
    if (draggedId === targetId) {
      return;
    }

    const draggedGroup = this.groups.get(draggedId);
    const targetGroup = this.groups.get(targetId);
    const draggedObject = this.objects.get(draggedId);
    const targetObject = this.objects.get(targetId);

    const draggedLabel = draggedGroup?.name ?? draggedObject?.name;
    const destinationGroupId = targetGroup?.id ?? targetObject?.parentId ?? null;

    if (
      draggedGroup &&
      destinationGroupId &&
      (destinationGroupId === draggedGroup.id || this.isGroupWithinGroup(destinationGroupId, draggedGroup.id))
    ) {
      return;
    }

    if (targetGroup) {
      if (this.selectedSceneItemIds.has(draggedId) && this.selectedSceneItemIds.size > 1) {
        const selectedIds = this.getOrderedSelectedTopLevelSceneItemIds().filter((itemId) => itemId !== targetGroup.id);
        const movableIds = selectedIds.filter((itemId) => !this.isSceneItemWithinGroup(targetGroup.id, itemId));
        if (movableIds.length === 0) {
          return;
        }

        movableIds.forEach((itemId) => {
          const selectedObject = this.objects.get(itemId);
          if (selectedObject) {
            this.removeObjectFromParentContainer(selectedObject);
            this.insertObjectIntoGroup(selectedObject, targetGroup.id);
            return;
          }

          const selectedGroup = this.groups.get(itemId);
          if (selectedGroup) {
            this.removeGroupFromParentContainer(selectedGroup);
            this.insertGroupIntoGroup(selectedGroup, targetGroup.id);
          }
        });

        this.pushHistoryCheckpoint();
        this.setStatusNotice(
          movableIds.length === 1
            ? `Moved 1 item into ${targetGroup.name}.`
            : `Moved ${movableIds.length} items into ${targetGroup.name}.`,
        );
        return;
      }

      if (draggedObject) {
        this.removeObjectFromParentContainer(draggedObject);
        if (!this.insertObjectIntoGroup(draggedObject, targetGroup.id)) {
          return;
        }
      } else if (draggedGroup) {
        this.removeGroupFromParentContainer(draggedGroup);
        if (!this.insertGroupIntoGroup(draggedGroup, targetGroup.id)) {
          return;
        }
      } else {
        return;
      }

      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Moved ${draggedLabel ?? "item"} into ${targetGroup.name}.`);
      return;
    }

    if (!targetObject) {
      return;
    }

    if (targetObject.parentId) {
      const targetParentGroup = this.groups.get(targetObject.parentId);
      if (!targetParentGroup) {
        return;
      }
      const targetIndex = this.getContainerInsertIndex(targetParentGroup.id, targetObject.id);
      if (targetIndex === -1) {
        return;
      }

      if (draggedObject) {
        this.removeObjectFromParentContainer(draggedObject);
        if (!this.insertObjectIntoGroup(draggedObject, targetParentGroup.id, targetIndex)) {
          return;
        }
      } else if (draggedGroup) {
        this.removeGroupFromParentContainer(draggedGroup);
        if (!this.insertGroupIntoGroup(draggedGroup, targetParentGroup.id, targetIndex)) {
          return;
        }
      } else {
        return;
      }

      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Moved ${draggedLabel ?? "item"} into ${targetParentGroup.name}.`);
      return;
    }

    const targetIndex = this.getContainerInsertIndex(null, targetObject.id);
    if (targetIndex === -1) {
      return;
    }

    if (draggedObject) {
      this.removeObjectFromParentContainer(draggedObject);
      this.insertObjectIntoRoot(draggedObject, targetIndex);
    } else if (draggedGroup) {
      this.removeGroupFromParentContainer(draggedGroup);
      this.insertGroupIntoRoot(draggedGroup, targetIndex);
    } else {
      return;
    }

    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Moved ${draggedLabel ?? "item"} to root.`);
  }

  ungroupSceneItem(objectId: string) {
    const object = this.objects.get(objectId);
    if (!object?.parentId) {
      return;
    }

    const parentGroup = this.groups.get(object.parentId);
    if (!parentGroup) {
      object.root.setParent(null);
      object.parentId = null;
      this.insertObjectIntoRoot(object);
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Ungrouped ${object.name}.`);
      return;
    }

    const parentContainerId = this.getNextParentContainerId(object.parentId);
    const insertIndex = this.getSiblingInsertIndexAfterParent(object.parentId);
    object.root.setParent(null);
    object.parentId = null;
    parentGroup.childIds = parentGroup.childIds.filter((id) => id !== object.id);
    this.cleanupGroupAfterChildRemoval(parentGroup.id);
    if (parentContainerId) {
      this.insertObjectIntoGroup(object, parentContainerId, insertIndex);
    } else {
      this.insertObjectIntoRoot(object, insertIndex);
    }
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Ungrouped ${object.name}.`);
  }

  unchildGroup(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group?.parentId) {
      return;
    }

    const parentGroupId = group.parentId;
    const parentGroup = this.groups.get(parentGroupId);
    const nextParentContainerId = this.getNextParentContainerId(parentGroupId);
    const insertIndex = this.getSiblingInsertIndexAfterParent(parentGroupId);

    if (!parentGroup) {
      group.root.setParent(null);
      group.parentId = null;
      this.insertGroupIntoRoot(group, insertIndex);
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Removed ${group.name} from its parent group.`);
      return;
    }

    group.root.setParent(null);
    parentGroup.childIds = parentGroup.childIds.filter((id) => id !== group.id);
    group.parentId = null;
    this.cleanupGroupAfterChildRemoval(parentGroupId);
    if (nextParentContainerId) {
      this.insertGroupIntoGroup(group, nextParentContainerId, insertIndex);
    } else {
      this.insertGroupIntoRoot(group, insertIndex);
    }
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Removed ${group.name} from its parent group.`);
  }

  promoteSceneItem(itemId: string) {
    const group = this.groups.get(itemId);
    if (group) {
      this.unchildGroup(group.id);
      return;
    }

    const object = this.objects.get(itemId);
    if (object) {
      this.ungroupSceneItem(object.id);
    }
  }

  demoteSceneItem(itemId: string) {
    const targetGroupId = this.getPreviousSiblingGroupId(itemId);
    if (!targetGroupId) {
      return;
    }

    const targetGroup = this.groups.get(targetGroupId);
    if (!targetGroup) {
      return;
    }

    const group = this.groups.get(itemId);
    if (group) {
      if (this.isGroupWithinGroup(targetGroup.id, group.id)) {
        return;
      }
      this.removeGroupFromParentContainer(group);
      if (!this.insertGroupIntoGroup(group, targetGroup.id)) {
        return;
      }
      this.refreshSelectionAttachment();
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Moved ${group.name} into ${targetGroup.name}.`);
      return;
    }

    const object = this.objects.get(itemId);
    if (!object) {
      return;
    }

    this.removeObjectFromParentContainer(object);
    if (!this.insertObjectIntoGroup(object, targetGroup.id)) {
      return;
    }
    this.refreshSelectionAttachment();
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Moved ${object.name} into ${targetGroup.name}.`);
  }

  toggleSceneItemHidden(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      group.hidden = !group.hidden;
      this.applyGroupVisibility(group.id);
      this.clearSelectionIfInsideGroup(group.id);
      this.refreshSelectionAttachment();
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`${group.hidden ? "Hidden" : "Shown"} ${group.name}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object) {
      return;
    }

    object.hidden = !object.hidden;
    this.applyObjectVisibility(objectId);
    if (this.isObjectHidden(object) && this.selectedObjectId === objectId) {
      this.clearSelection();
    } else if (!this.isObjectHidden(object) && this.selectedObjectId === objectId) {
      this.refreshSelectionAttachment();
    }
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`${object.hidden ? "Hidden" : "Shown"} ${object.name}.`);
  }

  toggleSceneItemLocked(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      group.locked = !group.locked;
      this.clearSelectionIfInsideGroup(group.id);
      this.refreshSelectionAttachment();
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`${group.locked ? "Locked" : "Unlocked"} ${group.name}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object) {
      return;
    }

    object.locked = !object.locked;
    if (this.selectedObjectId === objectId) {
      this.refreshSelectionAttachment();
    }
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`${object.locked ? "Locked" : "Unlocked"} ${object.name}.`);
  }

  frameSceneItem(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      if (this.isGroupHidden(group.id)) {
        return;
      }
      this.sceneCore.frameSelection(this.camera, group.root);
      this.setStatusNotice(`Framed ${group.name}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || this.isObjectHidden(object)) {
      return;
    }

    this.sceneCore.frameSelection(this.camera, object.root);
    this.setStatusNotice(
      `Framed ${findAssetByRef({ libraryId: object.libraryId, assetId: object.assetId })?.name ?? "selection"}.`,
    );
  }

  clearSceneContents() {
    this.clearScene();
  }

  setGridSize(value: number) {
    if (!GRID_SIZE_OPTIONS.includes(value as (typeof GRID_SIZE_OPTIONS)[number]) || this.getEffectiveGridSize() === value) {
      return;
    }

    this.gridSize = value;
    this.settings.gridSize = value;
    this.applySnapSettings();
    this.renderGrid();
    this.updatePreviewTransform();
    this.saveUserSettings();
    this.emitViewState();
  }

  setGridPlaneSize(value: number) {
    if (
      !GRID_PLANE_SIZE_OPTIONS.includes(value as (typeof GRID_PLANE_SIZE_OPTIONS)[number]) ||
      this.gridPlaneSize === value
    ) {
      return;
    }

    this.gridPlaneSize = value;
    this.settings.gridPlaneSize = value;
    this.recreateGround();
    this.renderGrid();
    this.saveUserSettings();
    this.emitViewState();
  }

  retuneCamera() {
    this.retuneCameraForGridPlaneSize();
  }

  setRotationStepDegrees(value: number) {
    if (this.rotationStepDegrees === value) {
      return;
    }

    this.rotationStepDegrees = value;
    this.applySnapSettings();
    this.updatePreviewTransform();
    this.emitViewState();
  }

  setRotationAxis(value: RotationAxis) {
    if (this.rotationAxis === value) {
      return;
    }

    this.rotationAxis = value;
    this.applyRotationAxis();
    this.emitViewState();
  }

  setGridVisible(visible: boolean) {
    if (this.settings.gridVisible === visible) {
      return;
    }

    this.settings.gridVisible = visible;
    this.renderGrid();
    this.saveUserSettings();
    this.emitViewState();
  }

  setCameraCloseLimit(value: number) {
    if (
      !CAMERA_CLOSE_LIMIT_OPTIONS.includes(value as (typeof CAMERA_CLOSE_LIMIT_OPTIONS)[number]) ||
      this.settings.cameraCloseLimit === value
    ) {
      return;
    }

    this.settings.cameraCloseLimit = value;
    this.retuneCameraForGridPlaneSize(false);
    this.saveUserSettings();
    this.emitViewState();
  }

  setViewportGizmoEnabled(value: boolean) {
    if (this.settings.viewportGizmoEnabled === value) {
      return;
    }

    this.settings.viewportGizmoEnabled = value;
    this.viewportGizmo.setEnabled(value);
    this.saveUserSettings();
    this.emitViewState();
  }

  setGridRenderMode(value: "material" | "lines") {
    if (this.settings.gridRenderMode === value) {
      return;
    }

    this.settings.gridRenderMode = value;
    this.renderGrid();
    this.saveUserSettings();
    this.emitViewState();
  }

  setGridColor(colorHex: string) {
    if (!/^#[0-9a-f]{6}$/iu.test(colorHex) || this.settings.gridColor === colorHex) {
      return;
    }

    this.settings.gridColor = colorHex;
    this.renderGrid();
    this.saveUserSettings();
    this.emitViewState();
  }

  setGroundColor(colorHex: string) {
    if (!/^#[0-9a-f]{6}$/iu.test(colorHex) || this.settings.groundColor === colorHex) {
      return;
    }

    this.settings.groundColor = colorHex;
    this.applyGroundColor();
    this.saveUserSettings();
    this.emitViewState();
  }

  restoreDefaultUserSettings() {
    this.settings.saveOnEveryUiUpdate = DEFAULT_USER_SETTINGS.saveOnEveryUiUpdate;
    this.settings.autosaveEnabled = DEFAULT_USER_SETTINGS.autosaveEnabled;
    this.settings.autosaveIntervalSeconds = DEFAULT_USER_SETTINGS.autosaveIntervalSeconds;
    this.settings.gridSize = DEFAULT_USER_SETTINGS.gridSize;
    this.settings.environmentEnabled = DEFAULT_USER_SETTINGS.environmentEnabled;
    this.settings.environmentIntensity = DEFAULT_USER_SETTINGS.environmentIntensity;
    this.settings.lightIntensity = DEFAULT_USER_SETTINGS.lightIntensity;
    this.settings.cameraCloseLimit = DEFAULT_USER_SETTINGS.cameraCloseLimit;
    this.settings.viewportGizmoEnabled = DEFAULT_USER_SETTINGS.viewportGizmoEnabled;
    this.settings.gridVisible = DEFAULT_USER_SETTINGS.gridVisible;
    this.settings.gridPlaneSize = DEFAULT_USER_SETTINGS.gridPlaneSize;
    this.settings.gridRenderMode = DEFAULT_USER_SETTINGS.gridRenderMode;
    this.settings.gridColor = DEFAULT_USER_SETTINGS.gridColor;
    this.settings.groundColor = DEFAULT_USER_SETTINGS.groundColor;
    this.settings.freezeModelMaterials = DEFAULT_USER_SETTINGS.freezeModelMaterials;
    this.settings.newObjectPlacementKind = DEFAULT_USER_SETTINGS.newObjectPlacementKind;
    this.settings.heightLabelMode = DEFAULT_USER_SETTINGS.heightLabelMode;

    this.gridSize = this.settings.gridSize;
    this.gridPlaneSize = this.settings.gridPlaneSize;
    this.recreateGround();
    this.renderGrid();
    this.applyEnvironmentSetting();
    this.applyLightIntensity();
    this.applyGroundColor();
    this.viewportGizmo.setEnabled(this.settings.viewportGizmoEnabled);
    this.applyModelMaterialFreezeSetting();
    this.applySnapSettings();
    this.updatePreviewTransform();
    this.retuneCameraForGridPlaneSize(false);
    if (!this.settings.autosaveEnabled) {
      this.clearPendingTimedAutosave();
    } else {
      this.scheduleTimedAutosave();
    }
    this.persistLiveAutosave();
    this.saveUserSettings();
    this.setStatusNotice("User settings restored to defaults.");
  }

  private retuneCameraForGridPlaneSize(showNotice = true) {
    const normalizedGridPlaneSize = this.gridPlaneSize / ModularEditorApp.CAMERA_BASE_GRID_PLANE_SIZE;
    const safeScale = Math.max(0.25, normalizedGridPlaneSize);
    const lowerRadiusLimit = Math.max(
      this.settings.cameraCloseLimit,
      Number((ModularEditorApp.CAMERA_BASE_LOWER_RADIUS_LIMIT * safeScale).toFixed(3)),
    );
    const upperRadiusLimit = Math.max(
      lowerRadiusLimit + 6,
      Number((ModularEditorApp.CAMERA_BASE_UPPER_RADIUS_LIMIT * safeScale).toFixed(3)),
    );
    const wheelDeltaPercentage = Math.max(
      0.003,
      Number((ModularEditorApp.CAMERA_BASE_WHEEL_DELTA_PERCENTAGE * Math.sqrt(safeScale)).toFixed(4)),
    );
    const panningSensibility = Math.min(
      6000,
      Math.max(300, Math.round(ModularEditorApp.CAMERA_BASE_PANNING_SENSIBILITY * Math.sqrt(safeScale))),
    );

    this.camera.lowerRadiusLimit = lowerRadiusLimit;
    this.camera.upperRadiusLimit = upperRadiusLimit;
    this.camera.wheelDeltaPercentage = wheelDeltaPercentage;
    this.camera.panningSensibility = panningSensibility;
    this.camera.radius = Math.min(Math.max(this.camera.radius, lowerRadiusLimit), upperRadiusLimit);

    if (showNotice) {
      this.setStatusNotice(`Camera retuned for grid plane ${this.gridPlaneSize}.`);
    }
  }

  setEnvironmentEnabled(enabled: boolean) {
    if (this.settings.environmentEnabled === enabled) {
      return;
    }

    this.settings.environmentEnabled = enabled;
    this.applyEnvironmentSetting();
    this.saveUserSettings();
    this.emitViewState();
  }

  setEnvironmentIntensity(intensity: number) {
    const nextIntensity = Number.isFinite(intensity)
      ? Math.min(4, Math.max(0, intensity))
      : this.settings.environmentIntensity;
    if (this.settings.environmentIntensity === nextIntensity) {
      return;
    }

    this.settings.environmentIntensity = nextIntensity;
    this.applyEnvironmentSetting();
    this.saveUserSettings();
    this.emitViewState();
  }

  setLightIntensity(intensity: number) {
    const nextIntensity = Number.isFinite(intensity)
      ? Math.min(4, Math.max(0, intensity))
      : this.settings.lightIntensity;
    if (this.settings.lightIntensity === nextIntensity) {
      return;
    }

    this.settings.lightIntensity = nextIntensity;
    this.applyLightIntensity();
    this.saveUserSettings();
    this.emitViewState();
  }

  setFreezeModelMaterials(value: boolean) {
    if (this.settings.freezeModelMaterials === value) {
      return;
    }

    this.settings.freezeModelMaterials = value;
    this.applyModelMaterialFreezeSetting();
    this.saveUserSettings();
    this.emitViewState();
  }

  setNewObjectPlacementKind(value: "clone" | "instance") {
    if (this.settings.newObjectPlacementKind === value) {
      return;
    }

    this.settings.newObjectPlacementKind = value;
    this.saveUserSettings();
    this.emitViewState();
  }

  setSaveOnEveryUiUpdate(value: boolean) {
    if (this.settings.saveOnEveryUiUpdate === value) {
      return;
    }

    this.settings.saveOnEveryUiUpdate = value;
    if (value) {
      this.persistLiveAutosave();
    }
    this.saveUserSettings();
    this.emitViewState();
  }

  setAutosaveEnabled(value: boolean) {
    if (this.settings.autosaveEnabled === value) {
      return;
    }

    this.settings.autosaveEnabled = value;
    if (!value) {
      this.clearPendingTimedAutosave();
    } else {
      this.scheduleTimedAutosave();
    }
    this.saveUserSettings();
    this.emitViewState();
  }

  setAutosaveIntervalSeconds(value: number) {
    if (![15, 30, 60, 120, 300].includes(value) || this.settings.autosaveIntervalSeconds === value) {
      return;
    }

    this.settings.autosaveIntervalSeconds = value;
    if (this.settings.autosaveEnabled && this.pendingTimedAutosaveSnapshotText) {
      this.clearPendingAutosaveTimer();
      this.autosaveTimeoutId = window.setTimeout(() => {
        this.flushTimedAutosave();
      }, this.settings.autosaveIntervalSeconds * 1000);
    }
    this.saveUserSettings();
    this.emitViewState();
  }

  setHeightLabelMode(value: "transform" | "geometry") {
    if (this.settings.heightLabelMode === value) {
      return;
    }

    this.settings.heightLabelMode = value;
    this.saveUserSettings();
    this.emitViewState();
  }

  private createNextSceneObjectName(baseName: string) {
    return createSequentialSceneObjectName(
      baseName,
      Array.from(this.objects.values(), (object) => object.name),
    );
  }

  private createDuplicateSceneObjectName(source: EditorObject, asset: AssetDefinition) {
    return createSequentialSceneObjectName(
      deriveSceneObjectNameBase(source.name, asset.name),
      Array.from(this.objects.values(), (object) => object.name),
    );
  }

  private setAllModelMaterialsFrozen(frozen: boolean) {
    this.objects.forEach((object) => {
      setRootMaterialsFrozen(object.root, frozen);
    });

    if (this.placementPreview) {
      setRootMaterialsFrozen(this.placementPreview, frozen);
    }
  }

  private applyModelMaterialFreezeSetting() {
    this.setAllModelMaterialsFrozen(this.settings.freezeModelMaterials);
  }

  private applyCleanExportNodeNames(exportNodes: Set<Node>) {
    const previousNames = new Map<Node, string>();
    const usedNames = new Set<string>();

    const assignName = (node: Node, nextName: string) => {
      previousNames.set(node, node.name);
      node.name = nextName;
      usedNames.add(nextName.toLowerCase());
    };

    this.groups.forEach((group) => {
      if (!exportNodes.has(group.root)) {
        return;
      }
      assignName(group.root, group.name);
    });

    this.objects.forEach((object) => {
      if (!exportNodes.has(object.root)) {
        return;
      }
      const asset = findAssetByRef({ libraryId: object.libraryId, assetId: object.assetId });
      const normalizedName = normalizeSceneObjectName(object.name, asset?.name ?? object.assetId);
      const uniqueName = usedNames.has(normalizedName.toLowerCase())
        ? createSequentialSceneObjectName(
            deriveSceneObjectNameBase(normalizedName, asset?.name ?? object.assetId),
            Array.from(usedNames.values()),
          )
        : normalizedName;
      assignName(object.root, uniqueName);
    });

    return () => {
      previousNames.forEach((name, node) => {
        node.name = name;
      });
    };
  }

  private findObjectId(mesh: Nullable<AbstractMesh>) {
    return this.sceneCore.findObjectId(mesh);
  }

  private tagHierarchy(root: TransformNode, objectId: string) {
    this.sceneCore.tagHierarchy(root, objectId);
  }

  private toRadians(valueDegrees: number) {
    return (valueDegrees * Math.PI) / 180;
  }

  private toDegrees(valueRadians: number) {
    return (valueRadians * 180) / Math.PI;
  }

  destroy() {
    this.clearHeldMovement();
    this.flushTimedAutosave();
    this.clearPendingAutosaveTimer();
    this.resizeObserver.disconnect();
    if (this.beforeAnimationsObserver) {
      this.scene.onBeforeAnimationsObservable.remove(this.beforeAnimationsObserver);
      this.beforeAnimationsObserver = null;
    }
    if (this.afterRenderObserver) {
      this.scene.onAfterRenderObservable.remove(this.afterRenderObserver);
      this.afterRenderObserver = null;
    }
    window.removeEventListener("resize", this.handleWindowResize);
    window.removeEventListener("pointerdown", this.handleWindowPointerDown);
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    window.removeEventListener("keyup", this.handleWindowKeyUp);
    this.originMarker?.dispose();
    this.selectionVerticalHelper?.dispose();
    this.selectionHeightLabel?.dispose(false, false);
    this.selectionVerticalHelperMarker?.dispose(false, false);
    this.disposePreview();
    this.viewportGizmo.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
