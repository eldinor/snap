import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { AssetDefinition } from "../assets";
import { clonePreviewMaterial } from "./placement";

export interface AssetTemplate {
  root: TransformNode;
  size: Vector3;
}

export async function instantiateAsset(
  asset: AssetDefinition,
  preview: boolean,
  template: AssetTemplate,
  scene: Scene,
) {
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
      mesh.material = clonePreviewMaterial(mesh.material, asset.placeholder.color, scene);
      mesh.visibility = 0.72;
    }
  });

  return root;
}

export async function loadAssetTemplate(asset: AssetDefinition, scene: Scene): Promise<AssetTemplate> {
  try {
    const importResult = await SceneLoader.ImportMeshAsync("", "/assets/glTF/", asset.fileName, scene);
    const root = new TransformNode(`template-${asset.id}`, scene);

    [...importResult.transformNodes, ...importResult.meshes].forEach((node) => {
      if (!node.parent && node !== root) {
        node.parent = root;
      }
    });

    const size = normalizeTemplateRoot(root);
    root.setEnabled(false);
    return { root, size };
  } catch {
    const root = createPlaceholderTemplate(asset, scene);
    const size = normalizeTemplateRoot(root);
    root.setEnabled(false);
    return { root, size };
  }
}

function createPlaceholderTemplate(asset: AssetDefinition, scene: Scene) {
  const root = new TransformNode(`template-${asset.id}`, scene);
  const material = new StandardMaterial(`${asset.id}-material`, scene);
  material.diffuseColor = Color3.FromHexString(asset.placeholder.color);
  material.specularColor = new Color3(0.1, 0.1, 0.1);

  const [width, height, depth] = asset.placeholder.size;
  const mesh =
    asset.placeholder.shape === "column"
      ? MeshBuilder.CreateCylinder(`${asset.id}-mesh`, { diameter: width, height }, scene)
      : MeshBuilder.CreateBox(`${asset.id}-mesh`, { width, height, depth }, scene);

  mesh.material = material;
  mesh.parent = root;

  if (asset.id === "door-frame") {
    const lintel = MeshBuilder.CreateBox(`${asset.id}-lintel`, { width, height: 0.3, depth }, scene);
    lintel.position.y = height / 2 - 0.15;
    lintel.material = material;
    lintel.parent = root;
  }

  return root;
}

function normalizeTemplateRoot(root: TransformNode) {
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
