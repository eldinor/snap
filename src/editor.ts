import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Cameras/arcRotateCameraInputsManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
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
import { ASSETS, ASSET_CATEGORIES, type AssetCategory, type AssetDefinition } from "./assets";
import { instantiateAsset, loadAssetTemplate, type AssetTemplate } from "./editor/asset-runtime";
import { SceneCoreController } from "./editor/scene-core-controller";
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
import {
  renderAssetList,
  renderSelectionPanel,
  renderStatus,
  renderToolbar,
  type EditorUi,
} from "./editor/ui";
import { loadUserSettings, saveUserSettings, type UserSettings } from "./editor/user-settings";

const ASSET_PREVIEW_BASE_PATH = "/generated/asset-previews";

interface EditorObject {
  id: string;
  assetId: string;
  root: TransformNode;
}

export class ModularEditorApp {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly gizmoManager: GizmoManager;
  private readonly ground: Mesh;
  private readonly ui: EditorUi;
  private readonly defaultEnvironment;
  private readonly assetTemplates = new Map<string, Promise<AssetTemplate>>();
  private readonly objects = new Map<string, EditorObject>();
  private readonly settings: UserSettings;
  private readonly history = new SnapshotHistory();
  private readonly sceneCore: SceneCoreController;
  private readonly sessionController: SceneSessionController;

  private gridMesh: Nullable<LinesMesh> = null;
  private activeCategory: AssetCategory | "All" = "All";
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
  private settingsMenuOpen = false;
  private statusNotice: string | null = null;

  constructor(ui: EditorUi) {
    this.ui = ui;
    this.engine = new Engine(ui.canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.09, 0.1, 0.12, 1);
    this.defaultEnvironment = this.scene.createDefaultEnvironment({
      createGround: false,
      createSkybox: false,
    });
    this.settings = loadUserSettings();
    this.sessionController = new SceneSessionController({
      history: this.history,
      getSnapshotText: () => this.getSerializedSceneText(),
      restoreSnapshot: async (scene) => {
        await this.restoreSerializedScene(scene);
      },
      onStateChanged: () => {
        this.updateToolbarState();
      },
      onNotice: (message) => {
        this.setStatusNotice(message);
      },
    });

    this.camera = new ArcRotateCamera("camera", Math.PI / 3, Math.PI / 2.9, 22, new Vector3(0, 2, 0), this.scene);
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 48;
    this.camera.wheelDeltaPercentage = 0.02;
    this.camera.attachControl(ui.canvas, true);

    const light = new HemisphericLight("light", new Vector3(0.4, 1, 0.2), this.scene);
    light.intensity = 1.1;
    light.groundColor = new Color3(0.06, 0.07, 0.08);

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

    this.bindUi();
    this.bindSceneInteractions();
    this.bindShortcuts();
    this.applySnapSettings();
    this.syncAssetListUi();
    this.syncPropertiesUi();
    this.syncToolbarUi();
    this.syncStatusUi();
    this.sessionController.resetHistory();

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private bindUi() {
    this.ui.searchInput.addEventListener("input", () => {
      this.syncAssetListUi();
    });

    this.ui.categoryButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.activeCategory = button.dataset.category as AssetCategory | "All";
        this.renderAssetList();
      });
    });

    this.ui.snapToggle.addEventListener("click", () => {
      this.snapEnabled = !this.snapEnabled;
      this.applySnapSettings();
      this.updatePreviewTransform();
      this.updateToolbarState();
      this.updateStatus();
      this.renderProperties();
    });

    this.ui.selectionModeButton.addEventListener("click", () => {
      this.mode = "select";
      this.disposePreview();
      this.updateToolbarState();
      this.updateStatus();
    });

    this.ui.placementModeButton.addEventListener("click", async () => {
      if (!this.activeAssetId) {
        return;
      }
      this.mode = "place";
      await this.ensurePreviewForAsset(this.activeAssetId);
      this.updateToolbarState();
      this.updateStatus();
    });

    this.ui.deleteSelectedButton.addEventListener("click", () => {
      this.deleteSelectedObject();
    });

    this.ui.clearSceneButton.addEventListener("click", () => {
      this.clearScene();
    });

    this.ui.undoButton.addEventListener("click", () => {
      void this.sessionController.undo();
    });

    this.ui.redoButton.addEventListener("click", () => {
      void this.sessionController.redo();
    });

    this.ui.saveButton.addEventListener("click", () => {
      this.sessionController.exportToFile();
    });

    this.ui.loadButton.addEventListener("click", () => {
      this.ui.loadInput.click();
    });

    this.ui.loadInput.addEventListener("change", async () => {
      const file = this.ui.loadInput.files?.[0];
      if (!file) {
        return;
      }
      await this.sessionController.importFromFile(file);
      this.ui.loadInput.value = "";
    });

    this.ui.gridSizeSelect.addEventListener("change", () => {
      this.gridSize = Number(this.ui.gridSizeSelect.value);
      this.applySnapSettings();
      this.renderGrid();
      this.updatePreviewTransform();
      this.updateStatus();
      this.renderProperties();
    });

    this.ui.rotationSelect.addEventListener("change", () => {
      this.rotationStepDegrees = Number(this.ui.rotationSelect.value);
      this.applySnapSettings();
      this.updatePreviewTransform();
      this.updateStatus();
      this.renderProperties();
    });

    this.ui.settingsButton.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    this.ui.settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.settingsMenuOpen = !this.settingsMenuOpen;
      this.updateToolbarState();
    });

    this.ui.settingsMenu.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    this.ui.settingsMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    this.ui.environmentToggle.addEventListener("change", () => {
      this.settings.environmentEnabled = this.ui.environmentToggle.checked;
      this.applyEnvironmentSetting();
      this.saveUserSettings();
    });

    window.addEventListener("pointerdown", () => {
      if (!this.settingsMenuOpen) {
        return;
      }
      this.settingsMenuOpen = false;
      this.updateToolbarState();
    });
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
        this.updateToolbarState();
        this.updateStatus();
      }

      if (event.key === "Enter" && this.mode === "place" && this.previewAssetId && this.placementPreview) {
        event.preventDefault();
        await this.placeActiveAsset();
      }
    });
  }

  private renderAssetList() {
    this.syncAssetListUi();
  }

  private getAssetThumbnailUrl(asset: AssetDefinition) {
    return `${ASSET_PREVIEW_BASE_PATH}/${asset.fileName.replace(/\.[^.]+$/u, ".png")}`;
  }

  private syncAssetListUi() {
    renderAssetList(
      this.ui,
      ASSETS,
      {
        activeAssetId: this.activeAssetId,
        activeCategory: this.activeCategory,
        query: this.ui.searchInput.value,
      },
      (asset) => this.getAssetThumbnailUrl(asset),
      async (asset) => {
        this.activeAssetId = asset.id;
        this.mode = "place";
        this.previewRotationDegrees = 0;
        await this.ensurePreviewForAsset(asset.id);
        this.syncAssetListUi();
        this.syncToolbarUi();
        this.syncStatusUi();
        this.syncPropertiesUi();
      },
    );
  }

  private syncPropertiesUi() {
    const selected = this.selectedObjectId ? this.objects.get(this.selectedObjectId) : null;
    const selectedAsset = selected ? ASSETS.find((asset) => asset.id === selected.assetId) : null;
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    const position = selected?.root.position;
    const rotationDegrees = selected ? Math.round(this.toDegrees(selected.root.rotation.y)) : null;

    renderSelectionPanel(this.ui, {
      selectedAssetName: selectedAsset?.name ?? null,
      activeAssetName: activeAsset?.name ?? null,
      positionText: position ? `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}` : null,
      rotationText: rotationDegrees !== null ? `${rotationDegrees}deg` : null,
      snapText: this.snapEnabled ? `Grid ${this.gridSize}` : "Off",
    });
  }

  private syncToolbarUi() {
    renderToolbar(this.ui, {
      snapEnabled: this.snapEnabled,
      mode: this.mode,
      settingsMenuOpen: this.settingsMenuOpen,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      hasSelection: !!this.selectedObjectId,
      hasObjects: this.objects.size > 0,
      gridSize: this.gridSize,
      rotationStepDegrees: this.rotationStepDegrees,
      environmentEnabled: this.settings.environmentEnabled,
    });
  }

  private syncStatusUi() {
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    renderStatus(this.ui, {
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
    });
  }

  private renderProperties() {
    this.syncPropertiesUi();
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
    this.updateToolbarState();
    this.updateStatus();
    this.renderProperties();
  }

  private beginHistoryGesture() {
    this.sessionController.beginHistoryGesture(!!this.selectedObjectId);
  }

  private completeHistoryGesture() {
    this.sessionController.completeHistoryGesture();
  }

  private resetHistory() {
    this.sessionController.resetHistory();
  }

  private pushHistoryCheckpoint(previousSnapshot?: string) {
    this.sessionController.pushHistoryCheckpoint(previousSnapshot);
  }

  private async undoSceneChange() {
    await this.sessionController.undo();
  }

  private async redoSceneChange() {
    await this.sessionController.redo();
  }

  private saveSceneToFile() {
    this.sessionController.exportToFile();
  }

  private async loadSceneFromFile(file: File) {
    await this.sessionController.importFromFile(file);
  }

  private updateToolbarState() {
    this.syncToolbarUi();
  }

  private updateStatus() {
    this.syncStatusUi();
  }

  private setStatusNotice(message: string | null) {
    this.statusNotice = message;
    if (message) {
      this.ui.statusHint.textContent = message;
      return;
    }
    this.updateStatus();
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
      this.updateToolbarState();
      this.updateStatus();
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
    this.renderProperties();
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
    this.renderProperties();
    this.pushHistoryCheckpoint();
  }

  private deleteSelectedObject() {
    const deleted = deleteSceneObject(this.objects, this.selectedObjectId, this.gizmoManager);
    if (!deleted) {
      return;
    }

    this.selectedObjectId = null;
    this.renderProperties();
    this.updateToolbarState();
    this.updateStatus();
    this.pushHistoryCheckpoint();
  }

  private clearScene() {
    const cleared = clearSceneObjects(this.objects, this.gizmoManager);
    if (!cleared) {
      return;
    }

    this.disposePreview();
    this.selectedObjectId = null;
    this.mode = "select";
    this.renderProperties();
    this.updateToolbarState();
    this.updateStatus();
    this.pushHistoryCheckpoint();
  }

  private clearSelection() {
    if (!this.selectedObjectId) {
      return;
    }

    this.selectedObjectId = clearSceneSelection(this.objects, this.selectedObjectId, this.gizmoManager);
    this.renderProperties();
    this.updateToolbarState();
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
    this.updateToolbarState();
    this.updateStatus();
    this.renderProperties();
  }

  private disposePreview() {
    this.placementPreview = this.sceneCore.disposePreview(this.placementPreview);
    this.previewAssetId = null;
  }

  private applySnapSettings() {
    this.sceneCore.applySnapSettings(this.snapEnabled, this.gridSize, this.toRadians(this.rotationStepDegrees));
  }

  private applyEnvironmentSetting() {
    this.sceneCore.applyEnvironmentSetting(this.defaultEnvironment?.environmentTexture ?? null, this.settings.environmentEnabled);
  }

  private saveUserSettings() {
    saveUserSettings(this.settings);
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
}

export function createEditorUi(canvas: HTMLCanvasElement): EditorUi {
  const searchInput = document.querySelector<HTMLInputElement>("[data-role='search-input']");
  const assetList = document.querySelector<HTMLDivElement>("[data-role='asset-list']");
  const snapToggle = document.querySelector<HTMLButtonElement>("[data-role='snap-toggle']");
  const selectionModeButton = document.querySelector<HTMLButtonElement>("[data-role='selection-mode']");
  const placementModeButton = document.querySelector<HTMLButtonElement>("[data-role='placement-mode']");
  const undoButton = document.querySelector<HTMLButtonElement>("[data-role='undo']");
  const redoButton = document.querySelector<HTMLButtonElement>("[data-role='redo']");
  const saveButton = document.querySelector<HTMLButtonElement>("[data-role='save']");
  const loadButton = document.querySelector<HTMLButtonElement>("[data-role='load']");
  const loadInput = document.querySelector<HTMLInputElement>("[data-role='load-input']");
  const deleteSelectedButton = document.querySelector<HTMLButtonElement>("[data-role='delete-selected']");
  const clearSceneButton = document.querySelector<HTMLButtonElement>("[data-role='clear-scene']");
  const gridSizeSelect = document.querySelector<HTMLSelectElement>("[data-role='grid-size']");
  const rotationSelect = document.querySelector<HTMLSelectElement>("[data-role='rotation-step']");
  const settingsButton = document.querySelector<HTMLButtonElement>("[data-role='settings-button']");
  const settingsMenu = document.querySelector<HTMLDivElement>("[data-role='settings-menu']");
  const environmentToggle = document.querySelector<HTMLInputElement>("[data-role='environment-toggle']");
  const statusMode = document.querySelector<HTMLElement>("[data-role='status-mode']");
  const statusAsset = document.querySelector<HTMLElement>("[data-role='status-asset']");
  const statusGrid = document.querySelector<HTMLElement>("[data-role='status-grid']");
  const statusHint = document.querySelector<HTMLElement>("[data-role='status-hint']");
  const propertiesPanel = document.querySelector<HTMLDivElement>("[data-role='properties-panel']");
  const categoryButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-role='category-filter']"));

  if (
    !searchInput ||
    !assetList ||
    !snapToggle ||
    !selectionModeButton ||
    !placementModeButton ||
    !undoButton ||
    !redoButton ||
    !saveButton ||
    !loadButton ||
    !loadInput ||
    !deleteSelectedButton ||
    !clearSceneButton ||
    !gridSizeSelect ||
    !rotationSelect ||
    !settingsButton ||
    !settingsMenu ||
    !environmentToggle ||
    !statusMode ||
    !statusAsset ||
    !statusGrid ||
    !statusHint ||
    !propertiesPanel
  ) {
    throw new Error("Editor UI is incomplete.");
  }

  return {
    canvas,
    searchInput,
    categoryButtons,
    assetList,
    snapToggle,
    selectionModeButton,
    placementModeButton,
    undoButton,
    redoButton,
    saveButton,
    loadButton,
    loadInput,
    deleteSelectedButton,
    clearSceneButton,
    gridSizeSelect,
    rotationSelect,
    settingsButton,
    settingsMenu,
    environmentToggle,
    statusMode,
    statusAsset,
    statusGrid,
    statusHint,
    propertiesPanel,
  };
}

export function buildEditorMarkup() {
  const categoryButtons = [
    `<button type="button" class="chip is-active" data-role="category-filter" data-category="All">All</button>`,
    ...ASSET_CATEGORIES.map(
      (category) =>
        `<button type="button" class="chip" data-role="category-filter" data-category="${category}">${category}</button>`,
    ),
  ].join("");

  return `
    <section class="shell">
      <header class="toolbar">
        <div class="toolbar-group">
          <button type="button" class="tool-button is-active" data-role="snap-toggle">Snap</button>
          <label class="tool-field">
            <span>Grid</span>
            <select data-role="grid-size">
              <option value="2">2</option>
              <option value="1" selected>1</option>
              <option value="0.5">0.5</option>
              <option value="0.25">0.25</option>
              <option value="0.125">0.125</option>
            </select>
          </label>
          <label class="tool-field">
            <span>Rotate</span>
            <select data-role="rotation-step">
              <option value="90" selected>90deg</option>
              <option value="45">45deg</option>
              <option value="15">15deg</option>
            </select>
          </label>
        </div>
        <div class="toolbar-group">
          <button type="button" class="tool-button is-active" data-role="selection-mode">Select</button>
          <button type="button" class="tool-button" data-role="placement-mode">Place</button>
          <button type="button" class="tool-button" data-role="undo" disabled>Undo</button>
          <button type="button" class="tool-button" data-role="redo" disabled>Redo</button>
          <button type="button" class="tool-button" data-role="save">Export JSON</button>
          <button type="button" class="tool-button" data-role="load">Import JSON</button>
          <input type="file" data-role="load-input" accept="application/json,.json" hidden />
          <button type="button" class="tool-button tool-button-danger" data-role="delete-selected" disabled>Delete Selected</button>
          <button type="button" class="tool-button tool-button-danger" data-role="clear-scene" disabled>Clear Scene</button>
          <div class="toolbar-settings">
            <button type="button" class="tool-button tool-button-icon" data-role="settings-button" aria-label="User settings">Settings</button>
            <div class="settings-menu" data-role="settings-menu" hidden>
              <div class="panel-label settings-menu-label">User Settings</div>
              <label class="setting-row">
                <span class="setting-copy">Environment Lighting</span>
                <span class="setting-switch">
                  <input type="checkbox" data-role="environment-toggle" />
                  <span class="setting-slider" aria-hidden="true"></span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </header>
      <div class="workspace">
        <aside class="sidebar">
          <div class="sidebar-section">
            <label class="panel-label" for="asset-search">Assets</label>
            <input id="asset-search" data-role="search-input" class="editor-input" type="text" placeholder="Search assets" />
          </div>
          <div class="sidebar-section">
            <div class="chip-row">${categoryButtons}</div>
          </div>
          <div class="asset-list" data-role="asset-list"></div>
          <div class="sidebar-section sidebar-properties">
            <div class="panel-label">Selection</div>
            <div class="properties-panel" data-role="properties-panel"></div>
          </div>
        </aside>
        <main class="viewport-panel">
          <canvas id="renderCanvas"></canvas>
        </main>
      </div>
      <footer class="statusbar">
        <span><strong>Mode</strong> <span data-role="status-mode">Selection</span></span>
        <span><strong>Asset</strong> <span data-role="status-asset">None</span></span>
        <span><strong>Snap</strong> <span data-role="status-grid">1u · 90deg</span></span>
        <span class="statusbar-hint" data-role="status-hint">Click object select · Delete remove · R rotate</span>
      </footer>
    </section>
  `;
}

