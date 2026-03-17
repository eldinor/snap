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
  type SerializedAssetScene,
} from "./editor/scene-serialization";
import {
  snapAngle as snapPlacementAngle,
  snapVectorForSize,
} from "./editor/placement";
import {
  clearSceneObjects,
  clearSelection as clearSceneSelection,
  deleteSelectedObject as deleteSceneObject,
  selectObject as selectSceneObject,
} from "./editor/scene-actions";
import { loadUserSettings, saveUserSettings, type UserSettings } from "./editor/user-settings";
import {
  createInitialEditorViewState,
  type EditorViewState,
  type SelectionViewState,
  type StatusViewState,
  type ToolbarViewState,
} from "./editor/view-state";

interface EditorObject {
  id: string;
  assetId: string;
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
  private readonly mainLight: HemisphericLight;
  private readonly onViewStateChange;
  private readonly defaultEnvironment: EnvironmentHelper | null;
  private readonly defaultEnvironmentTexture: Scene["environmentTexture"];
  private readonly assetTemplates = new Map<string, Promise<AssetTemplate>>();
  private readonly objects = new Map<string, EditorObject>();
  private readonly settings: UserSettings;
  private readonly history = new SnapshotHistory();
  private readonly sceneCore: SceneCoreController;
  private readonly sessionController: SceneSessionController;

  private gridMesh: Nullable<LinesMesh> = null;
  private activeAssetId: string | null = null;
  private selectedObjectId: string | null = null;
  private placementPreview: TransformNode | null = null;
  private previewAssetId: string | null = null;
  private previewTemplateSize = new Vector3(1, 1, 1);
  private mode: "select" | "place" = "select";
  private snapEnabled = true;
  private gridSize = 1;
  private rotationStepDegrees = 90;
  private previewRotationDegrees = 0;
  private objectSequence = 0;
  private lastPointerPoint = Vector3.Zero();
  private statusNotice: string | null = null;
  private viewState: EditorViewState = createInitialEditorViewState();
  private lastAutosavedSnapshotText: string | null = null;
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
    const groundMaterial = new StandardMaterial("ground-material", this.scene);
    groundMaterial.diffuseColor = new Color3(0.12, 0.13, 0.15);
    groundMaterial.specularColor = Color3.Black();
    this.ground.material = groundMaterial;
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
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private async initializePersistence() {
    const autosaved = loadAutosavedScene();
    if (autosaved) {
      await this.restoreSerializedScene(autosaved.scene);
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
    window.addEventListener("keydown", async (event) => {
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
        this.sessionController.exportToFile();
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
    });
  }

  private buildSelectionViewState(): SelectionViewState {
    const selected = this.selectedObjectId ? this.objects.get(this.selectedObjectId) : null;
    const selectedAsset = selected ? ASSETS.find((asset) => asset.id === selected.assetId) : null;
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    const previewAsset = this.previewAssetId ? ASSETS.find((asset) => asset.id === this.previewAssetId) : null;
    const position = selected?.root.position;
    const rotationDegrees = selected ? Math.round(this.toDegrees(selected.root.rotation.y)) : null;

    return {
      selectedObjectId: this.selectedObjectId,
      selectedAssetName: selectedAsset?.name ?? null,
      activeAssetName: activeAsset?.name ?? null,
      previewAssetName: previewAsset?.name ?? null,
      positionText: position ? `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}` : null,
      rotationText: rotationDegrees !== null ? `${rotationDegrees}deg` : null,
      snapText: this.snapEnabled ? `Grid ${this.gridSize}` : "Off",
    };
  }

  private buildToolbarViewState(): ToolbarViewState {
    return {
      snapEnabled: this.snapEnabled,
      mode: this.mode,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      hasSelection: !!this.selectedObjectId,
      hasObjects: this.objects.size > 0,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      environmentEnabled: this.settings.environmentEnabled,
      environmentIntensity: this.settings.environmentIntensity,
      lightIntensity: this.settings.lightIntensity,
    };
  }

  private buildStatusViewState(): StatusViewState {
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    return {
      mode: this.mode,
      activeAssetName: activeAsset?.name ?? null,
      snapEnabled: this.snapEnabled,
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
      noticeMessage: this.statusNotice,
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

  private getSerializedScene() {
    const serializableObjects: AssetSceneSerializableObject[] = Array.from(this.objects.values(), (object) => ({
      assetId: object.assetId,
      position: [object.root.position.x, object.root.position.y, object.root.position.z],
      rotationYDegrees: this.toDegrees(object.root.rotation.y),
    }));

    return serializeAssetScene(serializableObjects);
  }

  private getSerializedSceneText() {
    return JSON.stringify(this.getSerializedScene(), null, 2);
  }

  private async restoreSerializedScene(serialized: SerializedAssetScene) {
    this.disposePreview();
    this.clearSelection();
    clearSceneObjects(this.objects, this.gizmoManager);

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

      const id = `object-${++this.objectSequence}`;
      root.metadata = {
        objectId: id,
        assetId: asset.id,
        templateSize: template.size.asArray(),
      };
      this.tagHierarchy(root, id);
      this.objects.set(id, { id, assetId: asset.id, root });
    }

    this.mode = "select";
    this.emitViewState();
  }

  private beginHistoryGesture() {
    this.sessionController.beginHistoryGesture(!!this.selectedObjectId);
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
    root.metadata = {
      objectId: id,
      assetId: asset.id,
      templateSize: this.previewTemplateSize.asArray(),
    };
    this.tagHierarchy(root, id);
    this.objects.set(id, { id, assetId: asset.id, root });
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
    this.gridMesh = this.sceneCore.renderGrid(this.gridMesh, this.gridSize);
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
      object.root.rotation.y = this.snapAngle(object.root.rotation.y);
    }

    object.root.position.y = 0;
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

    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object) {
      return;
    }

    object.root.rotation.y = this.snapAngle(object.root.rotation.y + this.toRadians(this.rotationStepDegrees));
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private deleteSelectedObject() {
    const deleted = deleteSceneObject(this.objects, this.selectedObjectId, this.gizmoManager);
    if (!deleted) {
      return;
    }

    this.selectedObjectId = null;
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private clearScene() {
    const cleared = clearSceneObjects(this.objects, this.gizmoManager);
    if (!cleared) {
      return;
    }

    this.disposePreview();
    this.selectedObjectId = null;
    this.mode = "select";
    this.pushHistoryCheckpoint();
    this.emitViewState();
  }

  private clearSelection() {
    if (!this.selectedObjectId) {
      return;
    }

    this.selectedObjectId = clearSceneSelection(this.objects, this.selectedObjectId, this.gizmoManager);
    this.emitViewState();
  }

  private selectObjectByRoot(root: TransformNode) {
    this.clearSelection();

    const objectId = selectSceneObject(root, this.gizmoManager);
    if (!objectId) {
      return;
    }

    this.selectedObjectId = objectId;
    this.mode = "select";
    this.disposePreview();
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
    saveManualSavedScene(scene);
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
    this.statusNotice = `Loaded last saved scene (${saved.scene.objects.length} objects).`;
    this.sessionController.resetHistory();
    this.emitViewState();
  }

  deleteSelected() {
    this.deleteSelectedObject();
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
    this.disposePreview();
    this.scene.dispose();
    this.engine.dispose();
  }
}


