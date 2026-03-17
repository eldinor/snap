import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Cameras/arcRotateCameraInputsManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
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

const GRID_EXTENT = 32;
const ASSET_PREVIEW_BASE_PATH = "/generated/asset-previews";
const USER_SETTINGS_STORAGE_KEY = "snap:user-settings";

interface UserSettings {
  environmentEnabled: boolean;
}

interface AssetTemplate {
  root: TransformNode;
  size: Vector3;
}

interface EditorObject {
  id: string;
  assetId: string;
  root: TransformNode;
}

interface SerializedAssetObject {
  assetId: string;
  position: [number, number, number];
  rotationYDegrees: number;
}

interface SerializedAssetScene {
  version: 1;
  objects: SerializedAssetObject[];
}

function isSerializedAssetScene(value: unknown): value is SerializedAssetScene {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SerializedAssetScene>;
  if (candidate.version !== 1 || !Array.isArray(candidate.objects)) {
    return false;
  }

  return candidate.objects.every((object) => {
    if (!object || typeof object !== "object") {
      return false;
    }

    const entry = object as Partial<SerializedAssetObject>;
    return (
      typeof entry.assetId === "string" &&
      typeof entry.rotationYDegrees === "number" &&
      Array.isArray(entry.position) &&
      entry.position.length === 3 &&
      entry.position.every((component) => typeof component === "number")
    );
  });
}

export function serializeAssetScene(objects: Iterable<EditorObject>): SerializedAssetScene {
  return {
    version: 1,
    objects: Array.from(objects, (object) => ({
      assetId: object.assetId,
      position: [object.root.position.x, object.root.position.y, object.root.position.z],
      rotationYDegrees: (object.root.rotation.y * 180) / Math.PI,
    })),
  };
}

export interface EditorUi {
  canvas: HTMLCanvasElement;
  searchInput: HTMLInputElement;
  categoryButtons: HTMLButtonElement[];
  assetList: HTMLDivElement;
  snapToggle: HTMLButtonElement;
  selectionModeButton: HTMLButtonElement;
  placementModeButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  loadButton: HTMLButtonElement;
  loadInput: HTMLInputElement;
  deleteSelectedButton: HTMLButtonElement;
  clearSceneButton: HTMLButtonElement;
  gridSizeSelect: HTMLSelectElement;
  rotationSelect: HTMLSelectElement;
  settingsButton: HTMLButtonElement;
  settingsMenu: HTMLDivElement;
  environmentToggle: HTMLInputElement;
  statusMode: HTMLElement;
  statusAsset: HTMLElement;
  statusGrid: HTMLElement;
  statusHint: HTMLElement;
  propertiesPanel: HTMLDivElement;
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
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private dragHistorySnapshot: string | null = null;
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
    this.settings = this.loadUserSettings();

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

    this.renderGrid();
    this.applyEnvironmentSetting();

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

    this.bindUi();
    this.bindSceneInteractions();
    this.bindShortcuts();
    this.applySnapSettings();
    this.renderAssetList();
    this.renderProperties();
    this.updateToolbarState();
    this.updateStatus();
    this.resetHistory();

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private bindUi() {
    this.ui.searchInput.addEventListener("input", () => {
      this.renderAssetList();
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
      void this.undoSceneChange();
    });

    this.ui.redoButton.addEventListener("click", () => {
      void this.redoSceneChange();
    });

    this.ui.saveButton.addEventListener("click", () => {
      this.saveSceneToFile();
    });

    this.ui.loadButton.addEventListener("click", () => {
      this.ui.loadInput.click();
    });

    this.ui.loadInput.addEventListener("change", async () => {
      const file = this.ui.loadInput.files?.[0];
      if (!file) {
        return;
      }
      await this.loadSceneFromFile(file);
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
          await this.redoSceneChange();
        } else {
          await this.undoSceneChange();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        await this.redoSceneChange();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        this.saveSceneToFile();
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
    const query = this.ui.searchInput.value.trim().toLowerCase();
    this.ui.assetList.innerHTML = "";

    this.ui.categoryButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === this.activeCategory);
    });

    const filtered = ASSETS.filter((asset) => {
      const matchesCategory = this.activeCategory === "All" || asset.category === this.activeCategory;
      const haystack = `${asset.name} ${asset.category} ${asset.tags.join(" ")}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "asset-empty";
      empty.textContent = "No assets match the current filter.";
      this.ui.assetList.appendChild(empty);
      return;
    }

    filtered.forEach((asset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asset-row";
      button.innerHTML = `
        <span class="asset-swatch" style="background:${asset.placeholder.color}"></span>
        <span class="asset-copy">
          <span class="asset-name">${asset.name}</span>
          <span class="asset-meta">${asset.category} · ${asset.fileName}</span>
        </span>
        <img class="asset-thumb" alt="" loading="lazy" src="${this.getAssetThumbnailUrl(asset)}" />
      `;
      const thumbnail = button.querySelector<HTMLImageElement>(".asset-thumb");
      thumbnail?.addEventListener("error", () => {
        thumbnail.hidden = true;
      });
      button.classList.toggle("is-active", asset.id === this.activeAssetId);
      button.addEventListener("click", async () => {
        this.activeAssetId = asset.id;
        this.mode = "place";
        this.previewRotationDegrees = 0;
        await this.ensurePreviewForAsset(asset.id);
        this.renderAssetList();
        this.updateToolbarState();
        this.updateStatus();
        this.renderProperties();
      });
      this.ui.assetList.appendChild(button);
    });
  }

  private getAssetThumbnailUrl(asset: AssetDefinition) {
    return `${ASSET_PREVIEW_BASE_PATH}/${asset.fileName.replace(/\.[^.]+$/u, ".png")}`;
  }

  private renderProperties() {
    const selected = this.selectedObjectId ? this.objects.get(this.selectedObjectId) : null;
    const selectedAsset = selected ? ASSETS.find((asset) => asset.id === selected.assetId) : null;
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;

    if (!selected || !selectedAsset) {
      this.ui.propertiesPanel.innerHTML = `
        <div class="properties-empty">
          <strong>No object selected.</strong>
          <span>Active asset: ${activeAsset ? activeAsset.name : "None"}</span>
          <span>Use Delete Selected for one item or Clear Scene for all.</span>
        </div>
      `;
      return;
    }

    const position = selected.root.position;
    const rotationDegrees = Math.round(this.toDegrees(selected.root.rotation.y));
    this.ui.propertiesPanel.innerHTML = `
      <div class="properties-grid">
        <span class="properties-label">Asset</span>
        <span>${selectedAsset.name}</span>
        <span class="properties-label">Position</span>
        <span>${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}</span>
        <span class="properties-label">Rotation</span>
        <span>${rotationDegrees}deg</span>
        <span class="properties-label">Snap</span>
        <span>${this.snapEnabled ? `Grid ${this.gridSize}` : "Off"}</span>
      </div>
    `;
  }

  private getSerializedScene() {
    return serializeAssetScene(this.objects.values());
  }

  private getSerializedSceneText() {
    return JSON.stringify(this.getSerializedScene(), null, 2);
  }

  private async restoreSerializedScene(serialized: SerializedAssetScene) {
    this.disposePreview();
    this.clearSelection();

    this.objects.forEach((object) => {
      object.root.dispose(false, false);
    });
    this.objects.clear();

    for (const entry of serialized.objects) {
      const asset = ASSETS.find((candidate) => candidate.id === entry.assetId);
      if (!asset) {
        continue;
      }

      const root = await this.instantiateAsset(asset, false);
      if (!root) {
        continue;
      }

      root.position.set(entry.position[0], entry.position[1], entry.position[2]);
      root.rotation.y = this.toRadians(entry.rotationYDegrees);

      const id = `object-${++this.objectSequence}`;
      const template = await this.getAssetTemplate(asset);
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
    if (!this.selectedObjectId || this.dragHistorySnapshot) {
      return;
    }
    this.dragHistorySnapshot = this.getSerializedSceneText();
  }

  private completeHistoryGesture() {
    if (!this.dragHistorySnapshot) {
      return;
    }
    this.pushHistoryCheckpoint(this.dragHistorySnapshot);
    this.dragHistorySnapshot = null;
  }

  private resetHistory() {
    this.undoStack = [this.getSerializedSceneText()];
    this.redoStack = [];
    this.updateToolbarState();
  }

  private pushHistoryCheckpoint(previousSnapshot?: string) {
    const currentSnapshot = this.getSerializedSceneText();
    const baseline = previousSnapshot ?? this.undoStack[this.undoStack.length - 1];
    if (baseline === currentSnapshot) {
      this.updateToolbarState();
      return;
    }

    this.undoStack.push(currentSnapshot);
    this.redoStack = [];
    this.updateToolbarState();
  }

  private async undoSceneChange() {
    if (this.undoStack.length <= 1) {
      return;
    }

    const currentSnapshot = this.undoStack.pop();
    if (!currentSnapshot) {
      return;
    }
    this.redoStack.push(currentSnapshot);

    const previousSnapshot = this.undoStack[this.undoStack.length - 1];
    await this.restoreSerializedScene(JSON.parse(previousSnapshot) as SerializedAssetScene);
    this.updateToolbarState();
  }

  private async redoSceneChange() {
    const nextSnapshot = this.redoStack.pop();
    if (!nextSnapshot) {
      return;
    }

    this.undoStack.push(nextSnapshot);
    await this.restoreSerializedScene(JSON.parse(nextSnapshot) as SerializedAssetScene);
    this.updateToolbarState();
  }

  private saveSceneToFile() {
    const blob = new Blob([this.getSerializedSceneText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "asset-scene.v1.json";
    anchor.click();
    URL.revokeObjectURL(url);
    this.setStatusNotice("Scene saved as asset-scene.v1.json");
  }

  private async loadSceneFromFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isSerializedAssetScene(parsed)) {
        this.setStatusNotice("Load failed: invalid scene file format or unsupported version.");
        return;
      }

      await this.restoreSerializedScene(parsed);
      this.resetHistory();
      this.setStatusNotice(`Scene loaded: ${file.name}`);
    } catch {
      this.setStatusNotice(`Load failed: could not read ${file.name}.`);
    }
  }

  private updateToolbarState() {
    this.ui.snapToggle.classList.toggle("is-active", this.snapEnabled);
    this.ui.selectionModeButton.classList.toggle("is-active", this.mode === "select");
    this.ui.placementModeButton.classList.toggle("is-active", this.mode === "place");
    this.ui.settingsButton.classList.toggle("is-active", this.settingsMenuOpen);
    this.ui.undoButton.disabled = this.undoStack.length <= 1;
    this.ui.redoButton.disabled = this.redoStack.length === 0;
    this.ui.deleteSelectedButton.disabled = !this.selectedObjectId;
    this.ui.clearSceneButton.disabled = this.objects.size === 0;
    this.ui.gridSizeSelect.value = String(this.gridSize);
    this.ui.rotationSelect.value = String(this.rotationStepDegrees);
    this.ui.environmentToggle.checked = this.settings.environmentEnabled;
    this.ui.settingsMenu.hidden = !this.settingsMenuOpen;
  }

  private updateStatus() {
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;
    this.ui.statusMode.textContent = this.mode === "place" ? "Placement" : "Selection";
    this.ui.statusAsset.textContent = activeAsset ? activeAsset.name : "None";
    this.ui.statusGrid.textContent = this.snapEnabled
      ? `${this.gridSize}u · ${this.rotationStepDegrees}deg`
      : `Free · ${this.rotationStepDegrees}deg`;
    this.ui.statusHint.textContent =
      this.mode === "place"
        ? "R rotate · Click or Enter place · Esc cancel"
        : "Click object select · Delete remove · R rotate";
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
    const preview = await this.instantiateAsset(asset, true);
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

    const root = await this.instantiateAsset(asset, false);
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

  private async instantiateAsset(asset: AssetDefinition, preview: boolean) {
    const template = await this.getAssetTemplate(asset);
    const root = template.root.clone(`${asset.id}-${preview ? "preview" : "instance"}`);
    if (!root) {
      return null;
    }

    root.setEnabled(true);
    root.position.set(0, 0, 0);
    root.rotationQuaternion = null;
    root.rotation.set(0, 0, 0);
    root.scaling.setAll(1);
    root.metadata = { assetId: asset.id, templateSize: template.size.asArray() };

    root.getChildTransformNodes().forEach((node) => {
      node.setEnabled(true);
    });

    root.getChildMeshes().forEach((mesh) => {
      mesh.setEnabled(true);
      mesh.isPickable = !preview;
      mesh.showBoundingBox = false;
      mesh.visibility = 1;
      if (preview) {
        mesh.material = this.clonePreviewMaterial(mesh.material, asset.placeholder.color);
        mesh.visibility = 0.72;
      }
    });

    return root;
  }

  private async getAssetTemplate(asset: AssetDefinition): Promise<AssetTemplate> {
    if (!this.assetTemplates.has(asset.id)) {
      this.assetTemplates.set(asset.id, this.loadAssetTemplate(asset));
    }
    return this.assetTemplates.get(asset.id)!;
  }

  private async loadAssetTemplate(asset: AssetDefinition): Promise<AssetTemplate> {
    try {
      const importResult = await SceneLoader.ImportMeshAsync("", "/assets/glTF/", asset.fileName, this.scene);
      const root = new TransformNode(`template-${asset.id}`, this.scene);

      [...importResult.transformNodes, ...importResult.meshes].forEach((node) => {
        if (!node.parent && node !== root) {
          node.parent = root;
        }
      });

      const size = this.normalizeTemplateRoot(root);
      root.setEnabled(false);
      return { root, size };
    } catch {
      const root = this.createPlaceholderTemplate(asset);
      const size = this.normalizeTemplateRoot(root);
      root.setEnabled(false);
      return { root, size };
    }
  }

  private createPlaceholderTemplate(asset: AssetDefinition) {
    const root = new TransformNode(`template-${asset.id}`, this.scene);
    const material = new StandardMaterial(`${asset.id}-material`, this.scene);
    material.diffuseColor = Color3.FromHexString(asset.placeholder.color);
    material.specularColor = new Color3(0.1, 0.1, 0.1);

    const [width, height, depth] = asset.placeholder.size;
    const mesh =
      asset.placeholder.shape === "column"
        ? MeshBuilder.CreateCylinder(`${asset.id}-mesh`, { diameter: width, height }, this.scene)
        : MeshBuilder.CreateBox(`${asset.id}-mesh`, { width, height, depth }, this.scene);

    mesh.material = material;
    mesh.parent = root;

    if (asset.id === "door-frame") {
      const lintel = MeshBuilder.CreateBox(`${asset.id}-lintel`, { width, height: 0.3, depth }, this.scene);
      lintel.position.y = height / 2 - 0.15;
      lintel.material = material;
      lintel.parent = root;
    }

    return root;
  }

  private normalizeTemplateRoot(root: TransformNode) {
    const bounds = root.getHierarchyBoundingVectors();
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const minY = bounds.min.y;

    root
      .getChildren((node) => node.parent === root)
      .forEach((child) => {
        if (child instanceof TransformNode) {
          child.position.x -= centerX;
          child.position.y -= minY;
          child.position.z -= centerZ;
        }
      });

    const normalizedBounds = root.getHierarchyBoundingVectors();
    return normalizedBounds.max.subtract(normalizedBounds.min);
  }

  private clonePreviewMaterial(material: unknown, fallbackHex: string) {
    if (material instanceof StandardMaterial) {
      const clone = material.clone(`${material.name}-preview`);
      clone.alpha = 0.72;
      clone.diffuseColor = Color3.Lerp(material.diffuseColor, Color3.White(), 0.55);
      clone.emissiveColor = clone.diffuseColor.scale(0.45);
      clone.specularColor = clone.diffuseColor.scale(0.15);
      return clone;
    }

    const previewMaterial = new StandardMaterial("preview-material", this.scene);
    previewMaterial.diffuseColor = Color3.Lerp(Color3.FromHexString(fallbackHex), Color3.White(), 0.55);
    previewMaterial.alpha = 0.72;
    previewMaterial.emissiveColor = previewMaterial.diffuseColor.scale(0.45);
    previewMaterial.specularColor = previewMaterial.diffuseColor.scale(0.15);
    return previewMaterial;
  }

  private renderGrid() {
    this.gridMesh?.dispose();
    const lines: Vector3[][] = [];

    for (let offset = -GRID_EXTENT; offset <= GRID_EXTENT; offset += this.gridSize) {
      lines.push([new Vector3(offset, 0.01, -GRID_EXTENT), new Vector3(offset, 0.01, GRID_EXTENT)]);
      lines.push([new Vector3(-GRID_EXTENT, 0.01, offset), new Vector3(GRID_EXTENT, 0.01, offset)]);
    }

    this.gridMesh = MeshBuilder.CreateLineSystem("editor-grid", { lines }, this.scene);
    this.gridMesh.color = new Color3(0.23, 0.25, 0.28);
    this.gridMesh.alpha = 0.45;
    this.gridMesh.isPickable = false;
  }

  private updatePreviewTransform() {
    if (!this.placementPreview) {
      return;
    }

    const point = this.snapEnabled
      ? this.snapVectorForSize(this.lastPointerPoint, this.previewTemplateSize)
      : this.lastPointerPoint.clone();
    this.placementPreview.position.set(point.x, 0, point.z);
    this.placementPreview.rotationQuaternion = null;
    this.placementPreview.rotation.set(0, this.toRadians(this.previewRotationDegrees), 0);
  }

  private snapVectorForSize(point: Vector3, size: Vector3) {
    const xOffset = this.computeSnapOffset(size.x);
    const zOffset = this.computeSnapOffset(size.z);

    return new Vector3(
      this.snapScalar(point.x - xOffset, this.gridSize) + xOffset,
      0,
      this.snapScalar(point.z - zOffset, this.gridSize) + zOffset,
    );
  }

  private computeSnapOffset(size: number) {
    if (!this.snapEnabled || this.gridSize <= 0) {
      return 0;
    }

    const cells = Math.max(1, Math.round(size / this.gridSize));
    return cells % 2 === 0 ? 0 : this.gridSize / 2;
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
      const snapped = this.snapVectorForSize(object.root.position, templateSize);
      object.root.position.x = snapped.x;
      object.root.position.z = snapped.z;
      object.root.rotation.y = this.snapAngle(object.root.rotation.y);
    }

    object.root.position.y = 0;
    this.renderProperties();
  }

  private snapScalar(value: number, step: number) {
    return Math.round(value / step) * step;
  }

  private snapAngle(valueRadians: number) {
    if (!this.snapEnabled) {
      return valueRadians;
    }

    const stepRadians = this.toRadians(this.rotationStepDegrees);
    return Math.round(valueRadians / stepRadians) * stepRadians;
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
    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object) {
      return;
    }

    object.root.dispose(false, false);
    this.objects.delete(object.id);
    this.selectedObjectId = null;
    this.gizmoManager.attachToNode(null);
    this.renderProperties();
    this.updateToolbarState();
    this.updateStatus();
    this.pushHistoryCheckpoint();
  }

  private clearScene() {
    if (this.objects.size === 0) {
      return;
    }

    this.disposePreview();
    this.objects.forEach((object) => {
      object.root.dispose(false, false);
    });
    this.objects.clear();
    this.selectedObjectId = null;
    this.gizmoManager.attachToNode(null);
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

    const object = this.objects.get(this.selectedObjectId);
    if (object) {
      object.root.getChildMeshes().forEach((mesh) => {
        mesh.showBoundingBox = false;
      });
    }

    this.selectedObjectId = null;
    this.gizmoManager.attachToNode(null);
    this.renderProperties();
    this.updateToolbarState();
  }

  private selectObjectByRoot(root: TransformNode) {
    this.clearSelection();

    const objectId = root.metadata?.objectId as string | undefined;
    if (!objectId) {
      return;
    }

    this.selectedObjectId = objectId;
    root.getChildMeshes().forEach((mesh) => {
      mesh.showBoundingBox = true;
    });
    this.gizmoManager.attachToNode(root);
    this.mode = "select";
    this.disposePreview();
    this.updateToolbarState();
    this.updateStatus();
    this.renderProperties();
  }

  private disposePreview() {
    this.placementPreview?.dispose(false, false);
    this.placementPreview = null;
    this.previewAssetId = null;
  }

  private applySnapSettings() {
    if (this.gizmoManager.gizmos.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.snapDistance = this.snapEnabled ? this.gridSize : 0;
    }
    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.yGizmo.snapDistance = this.snapEnabled
        ? this.toRadians(this.rotationStepDegrees)
        : 0;
    }
  }

  private applyEnvironmentSetting() {
    this.scene.environmentTexture = this.settings.environmentEnabled ? this.defaultEnvironment?.environmentTexture ?? null : null;
    this.scene.environmentIntensity = this.settings.environmentEnabled ? 0.75 : 0;
  }

  private loadUserSettings(): UserSettings {
    try {
      const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return { environmentEnabled: false };
      }

      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return {
        environmentEnabled: parsed.environmentEnabled ?? false,
      };
    } catch {
      return { environmentEnabled: false };
    }
  }

  private saveUserSettings() {
    window.localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
  }

  private findObjectRoot(mesh: Nullable<AbstractMesh>) {
    let current: Nullable<AbstractMesh | TransformNode> = mesh;
    while (current) {
      const objectId = current.metadata?.objectId as string | undefined;
      if (objectId) {
        return current as TransformNode;
      }
      current = current.parent as Nullable<AbstractMesh | TransformNode>;
    }
    return null;
  }

  private tagHierarchy(root: TransformNode, objectId: string) {
    root.getChildMeshes().forEach((mesh) => {
      mesh.metadata = { ...(mesh.metadata ?? {}), objectId };
    });
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
