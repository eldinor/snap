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

interface AssetTemplate {
  root: TransformNode;
}

interface EditorObject {
  id: string;
  assetId: string;
  root: TransformNode;
}

export interface EditorUi {
  canvas: HTMLCanvasElement;
  searchInput: HTMLInputElement;
  categoryButtons: HTMLButtonElement[];
  assetList: HTMLDivElement;
  snapToggle: HTMLButtonElement;
  selectionModeButton: HTMLButtonElement;
  placementModeButton: HTMLButtonElement;
  gridSizeSelect: HTMLSelectElement;
  rotationSelect: HTMLSelectElement;
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
  private readonly assetTemplates = new Map<string, Promise<AssetTemplate>>();
  private readonly objects = new Map<string, EditorObject>();

  private gridMesh: Nullable<LinesMesh> = null;
  private activeCategory: AssetCategory | "All" = "All";
  private activeAssetId: string | null = null;
  private selectedObjectId: string | null = null;
  private placementPreview: TransformNode | null = null;
  private previewAssetId: string | null = null;
  private mode: "select" | "place" = "select";
  private snapEnabled = true;
  private gridSize = 1;
  private rotationStepDegrees = 90;
  private previewRotationDegrees = 0;
  private objectSequence = 0;
  private lastPointerPoint = Vector3.Zero();

  constructor(ui: EditorUi) {
    this.ui = ui;
    this.engine = new Engine(ui.canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.09, 0.1, 0.12, 1);

    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 3,
      Math.PI / 2.9,
      22,
      new Vector3(0, 2, 0),
      this.scene,
    );
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

    this.gizmoManager = new GizmoManager(this.scene);
    this.gizmoManager.usePointerToAttachGizmos = false;
    this.gizmoManager.clearGizmoOnEmptyPointerEvent = false;
    this.gizmoManager.positionGizmoEnabled = true;
    this.gizmoManager.rotationGizmoEnabled = true;
    this.gizmoManager.scaleGizmoEnabled = false;

    if (this.gizmoManager.gizmos.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      this.gizmoManager.gizmos.positionGizmo.xGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
      });
      this.gizmoManager.gizmos.positionGizmo.yGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
      });
      this.gizmoManager.gizmos.positionGizmo.zGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
      });
    }

    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      this.gizmoManager.gizmos.rotationGizmo.xGizmo.isEnabled = false;
      this.gizmoManager.gizmos.rotationGizmo.zGizmo.isEnabled = false;
      this.gizmoManager.gizmos.rotationGizmo.yGizmo.dragBehavior.onDragEndObservable.add(() => {
        this.snapSelectedObject();
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
      `;
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

  private renderProperties() {
    const selected = this.selectedObjectId ? this.objects.get(this.selectedObjectId) : null;
    const selectedAsset = selected ? ASSETS.find((asset) => asset.id === selected.assetId) : null;
    const activeAsset = this.activeAssetId ? ASSETS.find((asset) => asset.id === this.activeAssetId) : null;

    if (!selected || !selectedAsset) {
      this.ui.propertiesPanel.innerHTML = `
        <div class="properties-empty">
          <strong>No object selected.</strong>
          <span>Active asset: ${activeAsset ? activeAsset.name : "None"}</span>
          <span>Copy GLTF files to <code>public/assets/gltf/</code>.</span>
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

  private updateToolbarState() {
    this.ui.snapToggle.classList.toggle("is-active", this.snapEnabled);
    this.ui.selectionModeButton.classList.toggle("is-active", this.mode === "select");
    this.ui.placementModeButton.classList.toggle("is-active", this.mode === "place");
    this.ui.gridSizeSelect.value = String(this.gridSize);
    this.ui.rotationSelect.value = String(this.rotationStepDegrees);
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

  private async ensurePreviewForAsset(assetId: string) {
    this.disposePreview();
    const asset = ASSETS.find((entry) => entry.id === assetId);
    if (!asset) {
      return;
    }

    const preview = await this.instantiateAsset(asset, true);
    if (!preview) {
      return;
    }

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
    root.metadata = { objectId: id, assetId: asset.id };
    this.tagHierarchy(root, id);
    this.objects.set(id, { id, assetId: asset.id, root });
    this.selectObjectByRoot(root);

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
    root.metadata = { assetId: asset.id };

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
        mesh.visibility = 0.45;
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

      this.normalizeTemplateRoot(root);
      root.setEnabled(false);
      return { root };
    } catch {
      const root = this.createPlaceholderTemplate(asset);
      this.normalizeTemplateRoot(root);
      root.setEnabled(false);
      return { root };
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

    root.getChildren((node) => node.parent === root).forEach((child) => {
      if (child instanceof TransformNode) {
        child.position.x -= centerX;
        child.position.y -= minY;
        child.position.z -= centerZ;
      }
    });
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

    const point = this.snapEnabled ? this.snapVector(this.lastPointerPoint) : this.lastPointerPoint.clone();
    this.placementPreview.position.set(point.x, 0, point.z);
    this.placementPreview.rotationQuaternion = null;
    this.placementPreview.rotation.set(0, this.toRadians(this.previewRotationDegrees), 0);
  }

  private snapVector(point: Vector3) {
    return new Vector3(
      this.snapScalar(point.x, this.gridSize),
      0,
      this.snapScalar(point.z, this.gridSize),
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
      object.root.position.x = this.snapScalar(object.root.position.x, this.gridSize);
      object.root.position.z = this.snapScalar(object.root.position.z, this.gridSize);
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
  }

  private deleteSelectedObject() {
    if (!this.selectedObjectId) {
      return;
    }

    const object = this.objects.get(this.selectedObjectId);
    if (!object) {
      return;
    }

    object.root.dispose(false, true);
    this.objects.delete(object.id);
    this.selectedObjectId = null;
    this.gizmoManager.attachToNode(null);
    this.renderProperties();
    this.updateStatus();
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
    this.placementPreview?.dispose(false, true);
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
  const gridSizeSelect = document.querySelector<HTMLSelectElement>("[data-role='grid-size']");
  const rotationSelect = document.querySelector<HTMLSelectElement>("[data-role='rotation-step']");
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
    !gridSizeSelect ||
    !rotationSelect ||
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
    gridSizeSelect,
    rotationSelect,
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
