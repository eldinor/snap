import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Cameras/arcRotateCameraInputsManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import type { EnvironmentHelper } from "@babylonjs/core/Helpers/environmentHelper";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { HemisphericLight as BabylonHemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";
import { ASSETS, type AssetDefinition } from "./assets";
import { instantiateAsset, loadAssetTemplate, type AssetTemplate } from "./editor/asset-runtime";
import { SceneCoreController } from "./editor/scene-core-controller";
import {
  loadAutosavedScene,
  loadManualSavedScene,
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
import {
  snapAngle as snapPlacementAngle,
  snapScalar,
  snapVectorForSize,
} from "./editor/placement";
import {
  clearSceneObjects,
  clearSelection as clearSceneSelection,
  deleteSelectedObject as deleteSceneObject,
  selectObject as selectSceneObject,
} from "./editor/scene-actions";
import { DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings, type UserSettings } from "./editor/user-settings";
import {
  createInitialEditorViewState,
  type EditorViewState,
  type SceneItemViewState,
  type SelectionViewState,
  type StatusViewState,
  type ToolbarViewState,
} from "./editor/view-state";

interface EditorObject {
  id: string;
  assetId: string;
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
  root: TransformNode;
}

interface ModularEditorAppOptions {
  canvas: HTMLCanvasElement;
  onViewStateChange?: (state: EditorViewState) => void;
}

export class ModularEditorApp {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly gizmoManager: GizmoManager;
  private readonly ground: Mesh;
  private readonly groundMaterial: StandardMaterial;
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
  private readonly sessionController: SceneSessionController;
  private readonly resizeObserver: ResizeObserver;
  private readonly handleWindowResize = () => {
    this.engine.resize();
  };
  private readonly handleWindowKeyDown = async (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        await this.sessionController.redo();
      } else {
        await this.sessionController.undo();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      await this.sessionController.redo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      this.saveSceneToLocalStorage();
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      await this.duplicateSelectedObject();
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      this.frameSelectedObject();
      return;
    }

    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      this.rotateActiveTarget();
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
  private selectionVerticalHelper: Nullable<LinesMesh> = null;
  private selectionHeightLabel: Nullable<Mesh> = null;
  private selectionVerticalHelperMarker: Nullable<Mesh> = null;
  private selectionHelperVisualsEnabled = true;
  private activeAssetId: string | null = null;
  private selectedObjectId: string | null = null;
  private placementPreview: TransformNode | null = null;
  private previewAssetId: string | null = null;
  private previewTemplateSize = new Vector3(1, 1, 1);
  private mode: "select" | "place" = "select";
  private snapEnabled = true;
  private ySnapEnabled = false;
  private gridSize = 1;
  private rotationStepDegrees = 90;
  private previewRotationDegrees = 0;
  private objectSequence = 0;
  private groupSequence = 0;
  private sceneRootOrder: string[] = [];
  private selectedGroupId: string | null = null;
  private lastPointerPoint = Vector3.Zero();
  private statusNotice: string | null = null;
  private viewState: EditorViewState = createInitialEditorViewState();
  private lastAutosavedSnapshotText: string | null = null;
  private lastManualSaveAt: string | null = null;
  private lastRecoveredAutosaveAt: string | null = null;
  private persistenceReady = false;

  constructor(options: ModularEditorAppOptions) {
    this.onViewStateChange = options.onViewStateChange;
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
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 48;
    this.camera.wheelDeltaPercentage = 0.02;
    this.camera.attachControl(options.canvas, true);

    this.mainLight = new BabylonHemisphericLight("light", new Vector3(0.4, 1, 0.2), this.scene);
    this.mainLight.intensity = this.settings.lightIntensity;
    this.mainLight.groundColor = new Color3(0.06, 0.07, 0.08);

    this.ground = MeshBuilder.CreateGround("ground", { width: 80, height: 80 }, this.scene);
    this.groundMaterial = new StandardMaterial("ground-material", this.scene);
    this.groundMaterial.diffuseColor = Color3.FromHexString(this.settings.groundColor);
    this.groundMaterial.specularColor = Color3.Black();
    this.ground.material = this.groundMaterial;
    this.ground.isPickable = true;

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
      this.gizmoManager.gizmos.rotationGizmo.xGizmo.isEnabled = false;
      this.gizmoManager.gizmos.rotationGizmo.zGizmo.isEnabled = false;
      this.gizmoManager.gizmos.rotationGizmo.yGizmo.dragBehavior.onDragStartObservable.add(() => {
        this.beginHistoryGesture();
      });
      this.gizmoManager.gizmos.rotationGizmo.yGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
        this.completeHistoryGesture();
      });
    }

    this.sceneCore = new SceneCoreController(this.scene, this.gizmoManager);
    this.renderGrid();
    this.applyEnvironmentSetting();

    this.bindSceneInteractions();
    this.bindShortcuts();
    this.applySnapSettings();
    this.emitViewState();
    void this.initializePersistence();

    this.engine.runRenderLoop(() => {
      if (this.selectionHelperVisualsEnabled) {
        try {
          this.renderSelectionVerticalHelper();
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

    const autosaved = loadAutosavedScene();
    if (autosaved) {
      await this.restoreSerializedScene(autosaved.scene);
      this.lastRecoveredAutosaveAt = autosaved.savedAt;
      this.statusNotice = `Recovered autosaved scene (${autosaved.scene.objects.length} objects).`;
    }

    this.persistenceReady = true;
    this.sessionController.resetHistory();
    this.persistAutosavedScene();
    this.emitViewState();
  }

  private bindSceneInteractions() {
    this.scene.onPointerObservable.add(async (pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.ground);
        if (pick?.pickedPoint) {
          this.lastPointerPoint.copyFrom(pick.pickedPoint);
          this.updatePreviewTransform();
        }
      }

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (this.mode === "place" && this.previewAssetId && this.placementPreview) {
          await this.placeActiveAsset();
          return;
        }

        const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh !== this.ground);
        const objectRoot = this.findObjectRoot(pick?.pickedMesh ?? null);
        if (objectRoot) {
          this.selectObjectByRoot(objectRoot);
        } else {
          this.clearSelection();
        }
      }
    });
  }

  private bindShortcuts() {
    window.addEventListener("keydown", this.handleWindowKeyDown);
  }

  private buildSelectionViewState(): SelectionViewState {
    const selected = this.selectedObjectId ? this.objects.get(this.selectedObjectId) : null;
    const selectedGroup = this.selectedGroupId ? this.groups.get(this.selectedGroupId) : null;
    const selectedAsset = selected ? ASSETS.find((asset) => asset.id === selected.assetId) : null;
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    const previewAsset = this.previewAssetId ? ASSETS.find((asset) => asset.id === this.previewAssetId) : null;
    const position = selected ? selected.root.position : selectedGroup?.root.position ?? null;
    const rotationDegrees = selected
      ? Math.round(this.toDegrees(selected.root.rotation.y))
      : selectedGroup
        ? Math.round(this.toDegrees(selectedGroup.root.rotation.y))
        : null;

    return {
      selectedObjectId: this.selectedObjectId ?? this.selectedGroupId,
      selectedAssetName: selectedAsset?.name ?? selectedGroup?.name ?? null,
      activeAssetName: activeAsset?.name ?? null,
      previewAssetName: previewAsset?.name ?? null,
      position: position ? [position.x, position.y, position.z] : null,
      rotationYDegrees: rotationDegrees,
      positionText: position ? `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}` : null,
      rotationText: rotationDegrees !== null ? `${rotationDegrees}deg` : null,
      snapText: this.snapEnabled ? `Grid ${this.gridSize}${this.ySnapEnabled ? " + Y" : ""}` : "Off",
    };
  }

  private buildSceneItemsViewState(): SceneItemViewState[] {
    this.normalizeSceneRootOrder();
    const items: SceneItemViewState[] = [];
    const seenRootIds = new Set<string>();

    const pushObject = (object: EditorObject, depth: number) => {
      const asset = ASSETS.find((entry) => entry.id === object.assetId);
      items.push({
        id: object.id,
        assetId: object.assetId,
        assetName: asset?.name ?? object.assetId,
        label: object.name || `${asset?.name ?? object.assetId}`,
        selected: this.selectedObjectId === object.id,
        hidden: object.hidden,
        locked: object.locked,
        type: object.type,
        parentId: object.parentId,
        depth,
      });
    };

    this.sceneRootOrder.forEach((rootId) => {
      const group = this.groups.get(rootId);
      if (group) {
        seenRootIds.add(rootId);
        items.push({
          id: group.id,
          assetId: "",
          assetName: "Group",
          label: group.name,
          selected: this.selectedGroupId === group.id,
          hidden: false,
          locked: false,
          type: "group",
          parentId: null,
          depth: 0,
        });
        group.childIds.forEach((childId) => {
          const child = this.objects.get(childId);
          if (child) {
            pushObject(child, 1);
          }
        });
        return;
      }

      const object = this.objects.get(rootId);
      if (object && !object.parentId) {
        seenRootIds.add(rootId);
        pushObject(object, 0);
      }
    });

    this.groups.forEach((group) => {
      if (seenRootIds.has(group.id)) {
        return;
      }
      items.push({
        id: group.id,
        assetId: "",
        assetName: "Group",
        label: group.name,
        selected: this.selectedGroupId === group.id,
        hidden: false,
        locked: false,
        type: "group",
        parentId: null,
        depth: 0,
      });
      group.childIds.forEach((childId) => {
        const child = this.objects.get(childId);
        if (child) {
          pushObject(child, 1);
        }
      });
    });

    this.objects.forEach((object) => {
      if (!object.parentId && !seenRootIds.has(object.id)) {
        pushObject(object, 0);
      }
    });

    return items;
  }

  private normalizeSceneRootOrder() {
    const seen = new Set<string>();
    const validRootIds = new Set<string>([
      ...this.groups.keys(),
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
      if (!seen.has(group.id)) {
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
      mode: this.mode,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      hasSelection: !!this.selectedObjectId || !!this.selectedGroupId,
      hasObjects: this.objects.size > 0,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      environmentEnabled: this.settings.environmentEnabled,
      environmentIntensity: this.settings.environmentIntensity,
      lightIntensity: this.settings.lightIntensity,
      gridVisible: this.settings.gridVisible,
      gridColor: this.settings.gridColor,
      groundColor: this.settings.groundColor,
    };
  }

  private buildStatusViewState(): StatusViewState {
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    return {
      mode: this.mode,
      activeAssetName: activeAsset?.name ?? null,
      snapEnabled: this.snapEnabled,
      ySnapEnabled: this.ySnapEnabled,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      hint:
        this.statusNotice ??
        (this.mode === "place"
          ? "R rotate · Click or Enter place · Esc cancel"
          : "Click object select · Delete remove · R rotate"),
    };
  }

  private buildViewState(): EditorViewState {
    return {
      activeAssetId: this.activeAssetId,
      previewAssetId: this.previewAssetId,
      objectCount: this.objects.size,
      selectionCount: this.selectedObjectId || this.selectedGroupId ? 1 : 0,
      noticeMessage: this.statusNotice,
      lastManualSaveAt: this.lastManualSaveAt,
      lastRecoveredAutosaveAt: this.lastRecoveredAutosaveAt,
      sceneItems: this.buildSceneItemsViewState(),
      toolbar: this.buildToolbarViewState(),
      status: this.buildStatusViewState(),
      selection: this.buildSelectionViewState(),
    };
  }

  private emitViewState() {
    this.viewState = this.buildViewState();
    this.persistAutosavedScene();
    this.onViewStateChange?.(this.viewState);
  }

  private persistAutosavedScene() {
    if (!this.persistenceReady) {
      return;
    }

    const snapshotText = this.getSerializedSceneText();
    if (snapshotText === this.lastAutosavedSnapshotText) {
      return;
    }

    this.lastAutosavedSnapshotText = snapshotText;
    saveAutosavedScene(JSON.parse(snapshotText) as SerializedAssetScene);
  }

  private buildSceneMetadata(): SerializedAssetSceneMetadata {
    return {
      snapEnabled: this.snapEnabled,
      ySnapEnabled: this.ySnapEnabled,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      environmentEnabled: this.settings.environmentEnabled,
      environmentIntensity: this.settings.environmentIntensity,
      lightIntensity: this.settings.lightIntensity,
      gridVisible: this.settings.gridVisible,
      gridColor: this.settings.gridColor,
      groundColor: this.settings.groundColor,
      sceneGroups: Array.from(this.groups.values(), (group): SerializedSceneGroup => ({
        id: group.id,
        name: group.name,
        childIds: [...group.childIds],
      })),
      sceneRootOrder: [...this.sceneRootOrder],
    };
  }

  private getSerializedScene() {
    const serializableObjects: AssetSceneSerializableObject[] = Array.from(this.objects.values(), (object) => ({
      id: object.id,
      assetId: object.assetId,
      position: [object.root.position.x, object.root.position.y, object.root.position.z],
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
      const asset = ASSETS.find((candidate) => candidate.id === entry.assetId);
      if (!asset) {
        continue;
      }

      const template = await this.getAssetTemplate(asset);
      const root = await instantiateAsset(asset, false, template, this.scene);
      if (!root) {
        continue;
      }

      root.position.set(entry.position[0], entry.position[1], entry.position[2]);
      root.rotation.y = this.toRadians(entry.rotationYDegrees);

      const id = typeof entry.id === "string" && entry.id ? entry.id : `object-${++this.objectSequence}`;
      const numericObjectId = Number(id.replace("object-", ""));
      if (Number.isFinite(numericObjectId)) {
        this.objectSequence = Math.max(this.objectSequence, numericObjectId);
      }
      const defaultName = `${asset.name} ${String(this.objectSequence).padStart(2, "0")}`;
      root.metadata = {
        objectId: id,
        assetId: asset.id,
        templateSize: template.size.asArray(),
      };
      this.tagHierarchy(root, id);
      this.objects.set(id, {
        id,
        assetId: asset.id,
        root,
        name: entry.name?.trim() || defaultName,
        hidden: !!entry.hidden,
        locked: !!entry.locked,
        type: "object",
        parentId: entry.parentId ?? null,
      });
      this.applyObjectVisibility(id);
      if (!entry.parentId && !this.sceneRootOrder.includes(id)) {
        this.sceneRootOrder.push(id);
      }
    }

    this.groups.forEach((group) => {
      group.childIds.forEach((childId) => {
        const child = this.objects.get(childId);
        if (!child) {
          return;
        }
        child.root.setParent(group.root);
        child.parentId = group.id;
      });
      this.recenterGroupRoot(group.id);
    });

    this.groups.forEach((group) => {
      if (!this.sceneRootOrder.includes(group.id)) {
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
    if (typeof metadata.gridSize === "number") {
      this.gridSize = metadata.gridSize;
    }
    if (typeof metadata.rotationStepDegrees === "number") {
      this.rotationStepDegrees = metadata.rotationStepDegrees;
    }
    if (typeof metadata.environmentEnabled === "boolean") {
      this.settings.environmentEnabled = metadata.environmentEnabled;
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
    group.childIds.forEach((childId) => {
      const child = this.objects.get(childId);
      if (!child) {
        return;
      }
      child.root.getChildMeshes().forEach((mesh) => {
        mesh.showBoundingBox = highlighted;
        mesh.outlineColor = new Color3(0.55, 0.82, 1);
        mesh.outlineWidth = 0.03;
        mesh.renderOutline = highlighted;
      });
    });
  }

  private recenterGroupRoot(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    const children = group.childIds
      .map((childId) => this.objects.get(childId))
      .filter((child): child is EditorObject => !!child);

    if (children.length === 0) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;

    children.forEach((child) => {
      const bounds = child.root.getHierarchyBoundingVectors();
      min = min ? Vector3.Minimize(min, bounds.min) : bounds.min.clone();
      max = max ? Vector3.Maximize(max, bounds.max) : bounds.max.clone();
    });

    if (!min || !max) {
      return;
    }

    const center = min.add(max).scale(0.5);
    children.forEach((child) => {
      child.root.setParent(null);
    });
    group.root.position.copyFrom(center);
    children.forEach((child) => {
      child.root.setParent(group.root);
    });
  }

  private cleanupGroupAfterChildRemoval(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    if (group.childIds.length === 0) {
      if (this.selectedGroupId === groupId) {
        this.selectedGroupId = null;
      }
      this.sceneRootOrder = this.sceneRootOrder.filter((id) => id !== groupId);
      group.root.dispose();
      this.groups.delete(groupId);
      return;
    }

    this.recenterGroupRoot(groupId);
  }

  private applyObjectVisibility(objectId: string) {
    const object = this.objects.get(objectId);
    if (!object) {
      return;
    }

    object.root.setEnabled(!object.hidden);
    object.root.getChildMeshes().forEach((mesh) => {
      mesh.isPickable = !object.hidden;
    });
  }

  private refreshSelectionAttachment() {
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group) {
        this.gizmoManager.attachToNode(null);
        return;
      }
      this.gizmoManager.attachToNode(group.root);
      return;
    }

    if (!this.selectedObjectId) {
      this.gizmoManager.attachToNode(null);
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || object.hidden || object.locked) {
      this.gizmoManager.attachToNode(null);
      return;
    }

    this.gizmoManager.attachToNode(object.root);
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
    );
    this.selectionVerticalHelperMarker = this.sceneCore.renderVerticalHelperMarker(
      this.selectionVerticalHelperMarker,
      this.getSelectedRoot(),
      this.ySnapEnabled,
    );
  }

  private async ensurePreviewForAsset(assetId: string) {
    this.disposePreview();
    const asset = ASSETS.find((entry) => entry.id === assetId);
    if (!asset) {
      return;
    }

    const template = await this.getAssetTemplate(asset);
    const preview = await instantiateAsset(asset, true, template, this.scene);
    if (!preview) {
      return;
    }

    this.previewTemplateSize = template.size.clone();
    this.placementPreview = preview;
    this.previewAssetId = assetId;
    this.updatePreviewTransform();
  }

  private async placeActiveAsset() {
    if (!this.previewAssetId) {
      return;
    }

    const asset = ASSETS.find((entry) => entry.id === this.previewAssetId);
    if (!asset) {
      return;
    }

    const template = await this.getAssetTemplate(asset);
    const root = await instantiateAsset(asset, false, template, this.scene);
    if (!root) {
      return;
    }

    root.position.copyFrom(this.placementPreview?.position ?? Vector3.Zero());
    root.rotation.y = this.placementPreview?.rotation.y ?? 0;

    const id = `object-${++this.objectSequence}`;
    const defaultName = `${asset.name} ${String(this.objectSequence).padStart(2, "0")}`;
    root.metadata = {
      objectId: id,
      assetId: asset.id,
      templateSize: this.previewTemplateSize.asArray(),
    };
    this.tagHierarchy(root, id);
    this.objects.set(id, {
      id,
      assetId: asset.id,
      root,
      name: defaultName,
      hidden: false,
      locked: false,
      type: "object",
      parentId: null,
    });
    this.sceneRootOrder.push(id);
    this.selectObjectByRoot(root);
    this.pushHistoryCheckpoint();

    if (this.activeAssetId === asset.id) {
      this.mode = "place";
      await this.ensurePreviewForAsset(asset.id);
      this.emitViewState();
    }
  }

  private async getAssetTemplate(asset: AssetDefinition): Promise<AssetTemplate> {
    if (!this.assetTemplates.has(asset.id)) {
      this.assetTemplates.set(asset.id, this.loadAssetTemplate(asset));
    }
    return this.assetTemplates.get(asset.id)!;
  }

  private async loadAssetTemplate(asset: AssetDefinition): Promise<AssetTemplate> {
    return loadAssetTemplate(asset, this.scene);
  }

  private renderGrid() {
    this.gridMesh = this.sceneCore.renderGrid(
      this.gridMesh,
      this.gridSize,
      this.settings.gridVisible,
      this.settings.gridColor,
    );
  }

  private updatePreviewTransform() {
    this.sceneCore.updatePreviewTransform(
      this.placementPreview,
      this.lastPointerPoint,
      this.previewTemplateSize,
      this.snapEnabled,
      this.gridSize,
      this.toRadians(this.previewRotationDegrees),
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
        group.root.rotation.y = this.snapAngle(group.root.rotation.y);
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
      object.root.rotation.y = this.snapAngle(object.root.rotation.y);
    }

    this.emitViewState();
  }

  private snapAngle(valueRadians: number) {
    return snapPlacementAngle(valueRadians, this.snapEnabled, this.toRadians(this.rotationStepDegrees));
  }

  private rotateActiveTarget() {
    if (this.mode === "place" && this.placementPreview) {
      this.previewRotationDegrees = (this.previewRotationDegrees + this.rotationStepDegrees) % 360;
      this.updatePreviewTransform();
      return;
    }

    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group) {
        return;
      }

      group.root.rotation.y = this.snapAngle(group.root.rotation.y + this.toRadians(this.rotationStepDegrees));
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || object.locked || object.hidden) {
      return;
    }

    object.root.rotation.y = this.snapAngle(object.root.rotation.y + this.toRadians(this.rotationStepDegrees));
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

    const asset = ASSETS.find((entry) => entry.id === source.assetId);
    if (!asset) {
      return;
    }

    const template = await this.getAssetTemplate(asset);
    const root = await instantiateAsset(asset, false, template, this.scene);
    if (!root) {
      return;
    }

    const templateSize = Array.isArray(source.root.metadata?.templateSize)
      ? Vector3.FromArray(source.root.metadata.templateSize as number[])
      : template.size.clone();
    root.position.copyFrom(source.root.position);
    root.position.x += Math.max(this.gridSize, templateSize.x || this.gridSize);
    root.rotation.y = source.root.rotation.y;

    if (this.snapEnabled) {
      const snapped = snapVectorForSize(root.position, templateSize, this.snapEnabled, this.gridSize);
      root.position.x = snapped.x;
      root.position.z = snapped.z;
      root.rotation.y = this.snapAngle(root.rotation.y);
    }

    const id = `object-${++this.objectSequence}`;
    root.metadata = {
      objectId: id,
      assetId: asset.id,
      templateSize: templateSize.asArray(),
    };
    this.tagHierarchy(root, id);
    this.objects.set(id, {
      id,
      assetId: asset.id,
      root,
      name: `${source.name} Copy`,
      hidden: false,
      locked: source.locked,
      type: "object",
      parentId: source.parentId,
    });
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
    this.setStatusNotice(`Framed ${ASSETS.find((asset) => asset.id === selected.assetId)?.name ?? "selection"}.`);
  }

  private deleteSelectedObject() {
    if (this.selectedObjectId) {
      const deleted = deleteSceneObject(this.objects, this.selectedObjectId, this.gizmoManager);
      if (!deleted) {
        return;
      }

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
    this.selectedObjectId = null;
    this.selectedGroupId = null;
    this.disposeAllGroups();
    this.sceneRootOrder = [];
    this.mode = "select";
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private clearSelection() {
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (group) {
        this.setGroupHighlight(group, false);
      }
    }

    if (this.selectedObjectId) {
      this.selectedObjectId = clearSceneSelection(this.objects, this.selectedObjectId, this.gizmoManager);
    } else {
      this.gizmoManager.attachToNode(null);
    }
    this.selectedGroupId = null;
    this.emitViewState();
  }

  private selectObjectByRoot(root: TransformNode) {
    this.clearSelection();

    const objectId = selectSceneObject(root, this.gizmoManager);
    if (!objectId) {
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || object.hidden) {
      return;
    }

    this.selectedObjectId = objectId;
    this.selectedGroupId = null;
    this.mode = "select";
    this.disposePreview();
    this.refreshSelectionAttachment();
    this.emitViewState();
  }

  private disposePreview() {
    this.placementPreview = this.sceneCore.disposePreview(this.placementPreview);
    this.previewAssetId = null;
  }

  private applySnapSettings() {
    this.sceneCore.applySnapSettings(this.snapEnabled, this.gridSize, this.toRadians(this.rotationStepDegrees));
  }

  private applyEnvironmentSetting() {
    this.sceneCore.applyEnvironmentSetting(
      this.defaultEnvironmentTexture ?? null,
      this.settings.environmentEnabled,
      this.settings.environmentIntensity,
      this.defaultEnvironment?.skybox ?? null,
    );
  }

  private applyLightIntensity() {
    this.mainLight.intensity = this.settings.lightIntensity;
  }

  private applyGroundColor() {
    this.groundMaterial.diffuseColor = Color3.FromHexString(this.settings.groundColor);
  }

  private saveUserSettings() {
    saveUserSettings(this.settings);
  }

  async activateAsset(assetId: string) {
    if (this.activeAssetId === assetId && this.mode === "place") {
      await this.ensurePreviewForAsset(assetId);
      this.emitViewState();
      return;
    }

    const asset = ASSETS.find((entry) => entry.id === assetId);
    if (!asset) {
      return;
    }

    this.activeAssetId = asset.id;
    this.mode = "place";
    this.previewRotationDegrees = 0;
    await this.ensurePreviewForAsset(asset.id);
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

  setSelectionRotationDegrees(value: number) {
    if (!Number.isFinite(value)) {
      return;
    }

    const nextRadians = this.toRadians(value);
    if (this.selectedGroupId) {
      const group = this.groups.get(this.selectedGroupId);
      if (!group || group.root.rotation.y === nextRadians) {
        return;
      }

      group.root.rotation.y = nextRadians;
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object || object.root.rotation.y === nextRadians) {
      return;
    }

    object.root.rotation.y = nextRadians;
    this.refreshSelectionAttachment();
    this.pushHistoryCheckpoint();
    this.emitViewState();
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

    this.mode = "select";
    this.disposePreview();
    this.emitViewState();
  }

  async enterPlacementMode() {
    if (!this.activeAssetId) {
      return;
    }

    this.mode = "place";
    await this.ensurePreviewForAsset(this.activeAssetId);
    this.emitViewState();
  }

  async undo() {
    await this.sessionController.undo();
  }

  async redo() {
    await this.sessionController.redo();
  }

  exportToFile() {
    this.sessionController.exportToFile();
  }

  saveSceneToLocalStorage() {
    const scene = this.getSerializedScene();
    this.lastManualSaveAt = saveManualSavedScene(scene);
    this.setStatusNotice(`Scene saved to local storage (${scene.objects.length} objects).`);
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

  deleteSelected() {
    this.deleteSelectedObject();
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
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Renamed to ${trimmed}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || object.name === trimmed) {
      return;
    }

    object.name = trimmed;
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Renamed to ${trimmed}.`);
  }

  selectSceneItem(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      this.clearSelection();
      this.selectedGroupId = group.id;
      this.mode = "select";
      this.disposePreview();
      this.setGroupHighlight(group, true);
      this.refreshSelectionAttachment();
      this.emitViewState();
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || object.hidden) {
      return;
    }

    this.selectObjectByRoot(object.root);
  }

  deleteSceneItem(objectId: string) {
    const group = this.groups.get(objectId);
    if (group) {
      if (this.selectedGroupId === group.id) {
        this.clearSelection();
      }
      const rootIndex = this.sceneRootOrder.indexOf(group.id);
      this.sceneRootOrder = this.sceneRootOrder.filter((id) => id !== group.id);
      group.childIds.forEach((childId, index) => {
        const child = this.objects.get(childId);
        if (child) {
          child.root.setParent(null);
          child.parentId = null;
          this.sceneRootOrder.splice(rootIndex >= 0 ? rootIndex + index : this.sceneRootOrder.length, 0, child.id);
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

    this.selectedGroupId = null;
    if (this.selectedObjectId !== objectId) {
      this.selectedObjectId = objectId;
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
    this.selectedObjectId = objectId;
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
    const nextRootOrder = this.sceneRootOrder.filter((id) => id !== object.id);
    const safeIndex =
      insertIndex === undefined
        ? nextRootOrder.length
        : Math.min(nextRootOrder.length, Math.max(0, insertIndex));
    nextRootOrder.splice(safeIndex, 0, object.id);
    this.sceneRootOrder = nextRootOrder;
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
      insertIndex === undefined
        ? nextChildIds.length
        : Math.min(nextChildIds.length, Math.max(0, insertIndex));
    nextChildIds.splice(safeIndex, 0, object.id);
    group.childIds = nextChildIds;
    this.recenterGroupRoot(groupId);
    return true;
  }

  createGroupFromSelected() {
    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object) {
      return;
    }

    const previousParentId = object.parentId;
    if (previousParentId) {
      const previousGroup = this.groups.get(previousParentId);
      if (previousGroup) {
        object.root.setParent(null);
        object.parentId = null;
        previousGroup.childIds = previousGroup.childIds.filter((id) => id !== object.id);
        this.cleanupGroupAfterChildRemoval(previousParentId);
      }
    } else {
      this.sceneRootOrder = this.sceneRootOrder.filter((id) => id !== object.id);
    }

    const groupId = `group-${++this.groupSequence}`;
    const groupName = `Group ${String(this.groupSequence).padStart(2, "0")}`;
    const groupRoot = this.createGroupRoot(groupId);
    groupRoot.position.copyFrom(object.root.getAbsolutePosition());
    this.groups.set(groupId, {
      id: groupId,
      name: groupName,
      type: "group",
      childIds: [object.id],
      root: groupRoot,
    });
    object.root.setParent(groupRoot);
    object.parentId = groupId;
    this.sceneRootOrder.push(groupId);
    this.selectedObjectId = null;
    this.selectedGroupId = groupId;
    this.setGroupHighlight(this.groups.get(groupId)!, true);
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

    if (draggedObject && targetGroup) {
      this.removeObjectFromParentContainer(draggedObject);
      if (!this.insertObjectIntoGroup(draggedObject, targetGroup.id)) {
        return;
      }
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Moved ${draggedObject.name} into ${targetGroup.name}.`);
      return;
    }

    if ((draggedGroup || (draggedObject && !draggedObject.parentId)) && (targetGroup || (targetObject && !targetObject.parentId))) {
      const nextRootOrder = this.sceneRootOrder.filter((id) => id !== draggedId);
      const targetIndex = nextRootOrder.indexOf(targetId);
      if (targetIndex === -1) {
        return;
      }
      nextRootOrder.splice(targetIndex, 0, draggedId);
      this.sceneRootOrder = nextRootOrder;
      this.pushHistoryCheckpoint();
      this.emitViewState();
      return;
    }

    if (draggedObject && targetObject) {
      this.removeObjectFromParentContainer(draggedObject);

      if (targetObject.parentId) {
        const targetGroupForObject = this.groups.get(targetObject.parentId);
        if (!targetGroupForObject) {
          return;
        }
        const targetIndex = targetGroupForObject.childIds.indexOf(targetObject.id);
        if (!this.insertObjectIntoGroup(draggedObject, targetGroupForObject.id, targetIndex)) {
          return;
        }
        this.pushHistoryCheckpoint();
        this.setStatusNotice(`Moved ${draggedObject.name} into ${targetGroupForObject.name}.`);
        return;
      }

      const targetIndex = this.sceneRootOrder.filter((id) => id !== draggedObject.id).indexOf(targetObject.id);
      if (targetIndex === -1) {
        return;
      }
      this.insertObjectIntoRoot(draggedObject, targetIndex);
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Moved ${draggedObject.name} to root.`);
      return;
    }

    if (draggedObject && targetObject && draggedObject.parentId && draggedObject.parentId === targetObject.parentId) {
      const parentGroup = this.groups.get(draggedObject.parentId);
      if (!parentGroup) {
        return;
      }
      const nextChildIds = parentGroup.childIds.filter((id) => id !== draggedId);
      const targetIndex = nextChildIds.indexOf(targetId);
      if (targetIndex === -1) {
        return;
      }
      nextChildIds.splice(targetIndex, 0, draggedId);
      parentGroup.childIds = nextChildIds;
      this.pushHistoryCheckpoint();
      this.emitViewState();
    }
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
      this.pushHistoryCheckpoint();
      this.setStatusNotice(`Ungrouped ${object.name}.`);
      return;
    }

    object.root.setParent(null);
    object.parentId = null;
    parentGroup.childIds = parentGroup.childIds.filter((id) => id !== object.id);
    this.cleanupGroupAfterChildRemoval(parentGroup.id);
    const groupRootIndex = this.sceneRootOrder.indexOf(parentGroup.id);
    this.insertObjectIntoRoot(object, groupRootIndex >= 0 ? groupRootIndex + 1 : this.sceneRootOrder.length);
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`Ungrouped ${object.name}.`);
  }

  toggleSceneItemHidden(objectId: string) {
    const object = this.objects.get(objectId);
    if (!object) {
      return;
    }

    object.hidden = !object.hidden;
    this.applyObjectVisibility(objectId);
    if (object.hidden && this.selectedObjectId === objectId) {
      this.clearSelection();
    } else if (!object.hidden && this.selectedObjectId === objectId) {
      this.refreshSelectionAttachment();
    }
    this.pushHistoryCheckpoint();
    this.setStatusNotice(`${object.hidden ? "Hidden" : "Shown"} ${object.name}.`);
  }

  toggleSceneItemLocked(objectId: string) {
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
      this.sceneCore.frameSelection(this.camera, group.root);
      this.setStatusNotice(`Framed ${group.name}.`);
      return;
    }

    const object = this.objects.get(objectId);
    if (!object || object.hidden) {
      return;
    }

    this.sceneCore.frameSelection(this.camera, object.root);
    this.setStatusNotice(`Framed ${ASSETS.find((asset) => asset.id === object.assetId)?.name ?? "selection"}.`);
  }

  clearSceneContents() {
    this.clearScene();
  }

  setGridSize(value: number) {
    if (this.gridSize === value) {
      return;
    }

    this.gridSize = value;
    this.applySnapSettings();
    this.renderGrid();
    this.updatePreviewTransform();
    this.emitViewState();
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

  setGridVisible(visible: boolean) {
    if (this.settings.gridVisible === visible) {
      return;
    }

    this.settings.gridVisible = visible;
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
    this.settings.environmentEnabled = DEFAULT_USER_SETTINGS.environmentEnabled;
    this.settings.environmentIntensity = DEFAULT_USER_SETTINGS.environmentIntensity;
    this.settings.lightIntensity = DEFAULT_USER_SETTINGS.lightIntensity;
    this.settings.gridVisible = DEFAULT_USER_SETTINGS.gridVisible;
    this.settings.gridColor = DEFAULT_USER_SETTINGS.gridColor;
    this.settings.groundColor = DEFAULT_USER_SETTINGS.groundColor;

    this.renderGrid();
    this.applyEnvironmentSetting();
    this.applyLightIntensity();
    this.applyGroundColor();
    this.saveUserSettings();
    this.setStatusNotice("User settings restored to defaults.");
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
    const nextIntensity = Number.isFinite(intensity) ? Math.min(4, Math.max(0, intensity)) : this.settings.environmentIntensity;
    if (this.settings.environmentIntensity === nextIntensity) {
      return;
    }

    this.settings.environmentIntensity = nextIntensity;
    this.applyEnvironmentSetting();
    this.saveUserSettings();
    this.emitViewState();
  }

  setLightIntensity(intensity: number) {
    const nextIntensity = Number.isFinite(intensity) ? Math.min(4, Math.max(0, intensity)) : this.settings.lightIntensity;
    if (this.settings.lightIntensity === nextIntensity) {
      return;
    }

    this.settings.lightIntensity = nextIntensity;
    this.applyLightIntensity();
    this.saveUserSettings();
    this.emitViewState();
  }

  private findObjectRoot(mesh: Nullable<AbstractMesh>) {
    return this.sceneCore.findObjectRoot(mesh);
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
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.handleWindowResize);
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    this.selectionVerticalHelper?.dispose();
    this.selectionHeightLabel?.dispose(false, false);
    this.selectionVerticalHelperMarker?.dispose(false, false);
    this.disposePreview();
    this.scene.dispose();
    this.engine.dispose();
  }
}


