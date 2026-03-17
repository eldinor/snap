import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export interface SceneEditorObject {
  id: string;
  assetId: string;
  root: TransformNode;
}

export function clearSelection(
  objects: Map<string, SceneEditorObject>,
  selectedObjectId: string | null,
  gizmoManager: GizmoManager,
) {
  if (!selectedObjectId) {
    return null;
  }

  const object = objects.get(selectedObjectId);
  if (object) {
    object.root.getChildMeshes().forEach((mesh) => {
      mesh.showBoundingBox = false;
      mesh.renderOutline = false;
    });
  }

  gizmoManager.attachToNode(null);
  return null;
}

export function selectObject(
  root: TransformNode,
  gizmoManager: GizmoManager,
) {
  const objectId = root.metadata?.objectId as string | undefined;
  if (!objectId) {
    return null;
  }

  root.getChildMeshes().forEach((mesh) => {
    mesh.showBoundingBox = true;
    mesh.outlineColor = new Color3(0.55, 0.82, 1);
    mesh.outlineWidth = 0.03;
    mesh.renderOutline = true;
  });
  gizmoManager.attachToNode(root);
  return objectId;
}

export function deleteSelectedObject(
  objects: Map<string, SceneEditorObject>,
  selectedObjectId: string | null,
  gizmoManager: GizmoManager,
) {
  if (!selectedObjectId) {
    return false;
  }

  const object = objects.get(selectedObjectId);
  if (!object) {
    return false;
  }

  object.root.dispose(false, false);
  objects.delete(object.id);
  gizmoManager.attachToNode(null);
  return true;
}

export function clearSceneObjects(
  objects: Map<string, SceneEditorObject>,
  gizmoManager: GizmoManager,
) {
  if (objects.size === 0) {
    return false;
  }

  objects.forEach((object) => {
    object.root.dispose(false, false);
  });
  objects.clear();
  gizmoManager.attachToNode(null);
  return true;
}
