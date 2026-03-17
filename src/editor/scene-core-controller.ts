import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";
import { snapVectorForSize } from "./placement";

const GRID_EXTENT = 32;

export class SceneCoreController {
  constructor(
    private readonly scene: Scene,
    private readonly gizmoManager: GizmoManager,
  ) {}

  renderGrid(gridMesh: Nullable<LinesMesh>, gridSize: number) {
    gridMesh?.dispose();
    const lines: Vector3[][] = [];

    for (let offset = -GRID_EXTENT; offset <= GRID_EXTENT; offset += gridSize) {
      lines.push([new Vector3(offset, 0.01, -GRID_EXTENT), new Vector3(offset, 0.01, GRID_EXTENT)]);
      lines.push([new Vector3(-GRID_EXTENT, 0.01, offset), new Vector3(GRID_EXTENT, 0.01, offset)]);
    }

    const nextGrid = MeshBuilder.CreateLineSystem("editor-grid", { lines }, this.scene);
    nextGrid.color = new Color3(0.23, 0.25, 0.28);
    nextGrid.alpha = 0.45;
    nextGrid.isPickable = false;
    return nextGrid;
  }

  applySnapSettings(snapEnabled: boolean, gridSize: number, rotationStepRadians: number) {
    if (this.gizmoManager.gizmos.positionGizmo) {
      this.gizmoManager.gizmos.positionGizmo.snapDistance = snapEnabled ? gridSize : 0;
    }
    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.yGizmo.snapDistance = snapEnabled ? rotationStepRadians : 0;
    }
  }

  applyEnvironmentSetting(environmentTexture: Scene["environmentTexture"], enabled: boolean) {
    this.scene.environmentTexture = enabled ? environmentTexture ?? null : null;
    this.scene.environmentIntensity = enabled ? 0.75 : 0;
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

  findObjectRoot(mesh: Nullable<AbstractMesh>) {
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

  tagHierarchy(root: TransformNode, objectId: string) {
    root.getChildMeshes().forEach((mesh) => {
      mesh.metadata = { ...(mesh.metadata ?? {}), objectId };
    });
  }
}
