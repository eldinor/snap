import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { snapVectorForSize } from "./placement";

const GRID_EXTENT = 32;
const HEIGHT_LABEL_TEXTURE_SIZE = 256;
const HEIGHT_HELPER_FREE_HEX = "#8ac7ff";
const HEIGHT_HELPER_SNAP_HEX = "#7ef0b8";
const HEIGHT_LABEL_TEXT_HEX = "#eef7ff";
const HEIGHT_LABEL_BG_FREE = "rgba(10, 18, 26, 0.86)";
const HEIGHT_LABEL_BG_SNAP = "rgba(10, 26, 18, 0.88)";
const HEIGHT_HELPER_MARKER_DIAMETER = 0.42;
const HEIGHT_HELPER_MARKER_THICKNESS = 0.04;
const GRID_ORIGIN_MARKER_SIZE = 0.0675;

export class SceneCoreController {
  constructor(
    private readonly scene: Scene,
    private readonly gizmoManager: GizmoManager,
  ) {}

  renderGrid(gridMesh: Nullable<LinesMesh>, gridSize: number, visible: boolean, colorHex: string) {
    gridMesh?.dispose();
    if (!visible) {
      return null;
    }

    const lines: Vector3[][] = [];

    for (let offset = -GRID_EXTENT; offset <= GRID_EXTENT; offset += gridSize) {
      lines.push([new Vector3(offset, 0.01, -GRID_EXTENT), new Vector3(offset, 0.01, GRID_EXTENT)]);
      lines.push([new Vector3(-GRID_EXTENT, 0.01, offset), new Vector3(GRID_EXTENT, 0.01, offset)]);
    }

    const nextGrid = MeshBuilder.CreateLineSystem("editor-grid", { lines }, this.scene);
    nextGrid.color = Color3.FromHexString(colorHex);
    nextGrid.alpha = 0.45;
    nextGrid.isPickable = false;
    return nextGrid;
  }

  renderOriginMarker(originMarker: Nullable<Mesh>, visible: boolean, colorHex: string) {
    originMarker?.dispose(false, false);
    if (!visible) {
      return null;
    }

    const nextMarker = MeshBuilder.CreateDisc(
      "editor-grid-origin-marker",
      { radius: GRID_ORIGIN_MARKER_SIZE, tessellation: 24 },
      this.scene,
    );
    const gridColor = Color3.FromHexString(colorHex);
    const markerColor = Color3.Lerp(gridColor, Color3.White(), 0.88);
    nextMarker.position.set(0, 0.025, 0);
    nextMarker.rotation.x = Math.PI / 2;
    nextMarker.isPickable = false;
    nextMarker.alwaysSelectAsActiveMesh = true;
    nextMarker.renderingGroupId = 1;
    nextMarker.renderOverlay = false;

    const markerMaterial = new StandardMaterial("editor-grid-origin-marker-material", this.scene);
    markerMaterial.disableLighting = true;
    markerMaterial.backFaceCulling = false;
    markerMaterial.emissiveColor = markerColor.scale(1.2);
    markerMaterial.diffuseColor = markerColor.scale(0.2);
    markerMaterial.alpha = 0.92;
    markerMaterial.specularColor = Color3.Black();
    nextMarker.material = markerMaterial;
    return nextMarker;
  }

  private hasHelperGeometry(root: TransformNode | null) {
    return !!root && root.getChildMeshes().length > 0;
  }

  renderVerticalHelper(verticalHelper: Nullable<LinesMesh>, root: TransformNode | null, ySnapEnabled: boolean) {
    if (!this.hasHelperGeometry(root)) {
      verticalHelper?.dispose();
      return null;
    }

    const bounds = root.getHierarchyBoundingVectors();
    const helperTop = bounds.min.y;
    if (helperTop <= 0.05) {
      verticalHelper?.dispose();
      return null;
    }

    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    const points = [
      new Vector3(centerX, 0.02, centerZ),
      new Vector3(centerX, helperTop, centerZ),
    ];

    const nextHelper = verticalHelper
      ? MeshBuilder.CreateLines("selection-vertical-helper", { points, instance: verticalHelper })
      : MeshBuilder.CreateLines("selection-vertical-helper", { points, updatable: true }, this.scene);
    const helperColor = Color3.FromHexString(ySnapEnabled ? HEIGHT_HELPER_SNAP_HEX : HEIGHT_HELPER_FREE_HEX);
    nextHelper.color = helperColor;
    nextHelper.alpha = 0.72;
    nextHelper.isPickable = false;
    nextHelper.alwaysSelectAsActiveMesh = true;
    nextHelper.renderingGroupId = 2;
    nextHelper.renderOverlay = true;
    nextHelper.overlayColor = helperColor;
    nextHelper.overlayAlpha = 0.9;
    return nextHelper;
  }

  renderHeightLabel(
    heightLabel: Nullable<Mesh>,
    root: TransformNode | null,
    ySnapEnabled: boolean,
    heightLabelMode: "transform" | "geometry",
  ) {
    if (!this.hasHelperGeometry(root)) {
      heightLabel?.dispose(false, false);
      return null;
    }

    const bounds = root.getHierarchyBoundingVectors();
    const helperTop = bounds.min.y;
    const transformHeight = root.getAbsolutePosition().y;
    const displayedHeight = heightLabelMode === "transform" ? transformHeight : helperTop;
    if (displayedHeight <= 0.05) {
      heightLabel?.dispose(false, false);
      return null;
    }

    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    const labelText = `${displayedHeight.toFixed(2)}u`;

    const nextLabel =
      heightLabel ??
      MeshBuilder.CreatePlane(
        "selection-height-label",
        { width: 1.35, height: 0.38 },
        this.scene,
      );

    nextLabel.billboardMode = Mesh.BILLBOARDMODE_ALL;
    nextLabel.isPickable = false;
    nextLabel.alwaysSelectAsActiveMesh = true;
    nextLabel.position.set(centerX + 0.45, Math.max(0.3, helperTop * 0.5), centerZ);
    nextLabel.renderingGroupId = 2;
    nextLabel.renderOverlay = false;
    nextLabel.overlayAlpha = 0;

    let labelMaterial = nextLabel.material as StandardMaterial | null;
    let labelTexture = labelMaterial?.diffuseTexture as DynamicTexture | null;

    if (!labelMaterial || !labelTexture) {
      labelTexture = new DynamicTexture(
        "selection-height-label-texture",
        { width: HEIGHT_LABEL_TEXTURE_SIZE, height: HEIGHT_LABEL_TEXTURE_SIZE / 2 },
        this.scene,
        true,
      );
      labelMaterial = new StandardMaterial("selection-height-label-material", this.scene);
      labelMaterial.diffuseTexture = labelTexture;
      labelMaterial.opacityTexture = labelTexture;
      labelMaterial.emissiveColor = Color3.White();
      labelMaterial.disableLighting = true;
      labelMaterial.backFaceCulling = false;
      labelMaterial.depthFunction = 519;
      labelMaterial.forceDepthWrite = false;
      labelMaterial.zOffset = -2;
      nextLabel.material = labelMaterial;
    }

    const context = labelTexture.getContext();
    const textureWidth = labelTexture.getSize().width;
    const textureHeight = labelTexture.getSize().height;
    context.clearRect(0, 0, textureWidth, textureHeight);
    context.fillStyle = ySnapEnabled ? HEIGHT_LABEL_BG_SNAP : HEIGHT_LABEL_BG_FREE;
    context.fillRect(8, 8, textureWidth - 16, textureHeight - 16);
    context.strokeStyle = ySnapEnabled ? "rgba(126, 240, 184, 0.95)" : "rgba(138, 199, 255, 0.95)";
    context.lineWidth = 6;
    context.strokeRect(8, 8, textureWidth - 16, textureHeight - 16);
    context.fillStyle = HEIGHT_LABEL_TEXT_HEX;
    context.font = "bold 54px Segoe UI";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(labelText, textureWidth / 2, textureHeight / 2);
    labelTexture.update();

    return nextLabel;
  }

  renderVerticalHelperMarker(marker: Nullable<Mesh>, root: TransformNode | null, ySnapEnabled: boolean) {
    if (!this.hasHelperGeometry(root)) {
      marker?.dispose(false, false);
      return null;
    }

    const bounds = root.getHierarchyBoundingVectors();
    const helperTop = bounds.min.y;
    if (helperTop <= 0.05) {
      marker?.dispose(false, false);
      return null;
    }

    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    const nextMarker =
      marker ??
      MeshBuilder.CreateTorus(
        "selection-vertical-helper-marker",
        {
          diameter: HEIGHT_HELPER_MARKER_DIAMETER,
          thickness: HEIGHT_HELPER_MARKER_THICKNESS,
          tessellation: 32,
        },
        this.scene,
      );

    nextMarker.position.set(centerX, 0.025, centerZ);
    nextMarker.rotation.x = Math.PI / 2;
    nextMarker.isPickable = false;
    nextMarker.alwaysSelectAsActiveMesh = true;
    nextMarker.renderingGroupId = 2;
    nextMarker.renderOverlay = true;
    nextMarker.overlayColor = Color3.FromHexString(ySnapEnabled ? HEIGHT_HELPER_SNAP_HEX : HEIGHT_HELPER_FREE_HEX);
    nextMarker.overlayAlpha = 0.9;

    let markerMaterial = nextMarker.material as StandardMaterial | null;
    if (!markerMaterial) {
      markerMaterial = new StandardMaterial("selection-vertical-helper-marker-material", this.scene);
      markerMaterial.disableLighting = true;
      markerMaterial.backFaceCulling = false;
      markerMaterial.depthFunction = 519;
      markerMaterial.forceDepthWrite = false;
      markerMaterial.zOffset = -2;
      nextMarker.material = markerMaterial;
    }

    const markerColor = Color3.FromHexString(ySnapEnabled ? HEIGHT_HELPER_SNAP_HEX : HEIGHT_HELPER_FREE_HEX);
    markerMaterial.emissiveColor = markerColor;
    markerMaterial.diffuseColor = markerColor.scale(0.15);
    markerMaterial.specularColor = Color3.Black();

    return nextMarker;
  }

  applySnapSettings(snapEnabled: boolean, gridSize: number, rotationStepRadians: number) {
    if (this.gizmoManager.gizmos.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.snapDistance = snapEnabled ? gridSize : 0;
    }
    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.yGizmo.snapDistance = snapEnabled ? rotationStepRadians : 0;
    }
  }

  applyEnvironmentSetting(
    environmentTexture: Scene["environmentTexture"],
    enabled: boolean,
    intensity: number,
    skybox: Nullable<Mesh>,
  ) {
    this.scene.environmentTexture = enabled ? (environmentTexture ?? null) : null;
    this.scene.environmentIntensity = enabled ? intensity : 0;
    skybox?.setEnabled(enabled);
  }

  updatePreviewTransform(
    placementPreview: TransformNode | null,
    lastPointerPoint: Vector3,
    previewTemplateSize: Vector3,
    snapEnabled: boolean,
    gridSize: number,
    previewRotationRadians: number,
  ) {
    if (!placementPreview) {
      return;
    }

    const point = snapEnabled
      ? snapVectorForSize(lastPointerPoint, previewTemplateSize, snapEnabled, gridSize)
      : lastPointerPoint.clone();
    placementPreview.position.set(point.x, 0, point.z);
    placementPreview.rotationQuaternion = null;
    placementPreview.rotation.set(0, previewRotationRadians, 0);
  }

  disposePreview(placementPreview: TransformNode | null) {
    placementPreview?.dispose(false, false);
    return null;
  }

  findObjectId(mesh: Nullable<AbstractMesh>) {
    let current: Nullable<AbstractMesh | TransformNode> = mesh;
    let matchedObjectId: string | null = null;

    while (current) {
      const objectId = current.metadata?.objectId as string | undefined;
      if (objectId) {
        if (!matchedObjectId) {
          matchedObjectId = objectId;
        } else if (objectId !== matchedObjectId) {
          break;
        } else {
          matchedObjectId = objectId;
        }
      }
      current = current.parent as Nullable<AbstractMesh | TransformNode>;
    }

    return matchedObjectId;
  }

  tagHierarchy(root: TransformNode, objectId: string) {
    root.getChildMeshes().forEach((mesh) => {
      mesh.metadata = { ...(mesh.metadata ?? {}), objectId };
    });
  }

  frameSelection(camera: ArcRotateCamera, root: TransformNode) {
    const bounds = root.getHierarchyBoundingVectors();
    const center = bounds.min.add(bounds.max).scale(0.5);
    const extent = bounds.max.subtract(bounds.min);
    const radius = Math.max(extent.length() * 0.9, camera.lowerRadiusLimit ?? 6);

    camera.setTarget(center);
    camera.radius = Math.min(radius, camera.upperRadiusLimit ?? radius);
  }
}
