import { Material } from "@babylonjs/core/Materials/material";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { Node } from "@babylonjs/core/node";
import { splitAssetFileReference, type AssetDefinition } from "../assets";
import { collapseRedundantImportRoot } from "./import-root-collapse";
import { isTechnicalImportRootName } from "./import-root-collapse";
import { clonePreviewMaterial } from "./placement";

export interface AssetTemplate {
  root: TransformNode;
  size: Vector3;
}

export function setRootMaterialsFrozen(root: TransformNode, frozen: boolean) {
  const materials = new Set<Material>();
  root.getChildMeshes().forEach((mesh) => {
    if (mesh.material instanceof Material) {
      materials.add(mesh.material);
    }
  });

  materials.forEach((material) => {
    if (frozen) {
      material.freeze();
    } else {
      material.unfreeze();
    }
  });
}

interface ImportRootCollapseStats {
  technicalRootsSeen: number;
  collapsed: number;
  kept: number;
  byAsset: Record<
    string,
    {
      seen: number;
      collapsed: number;
      kept: number;
    }
  >;
}

const importRootCollapseStats: ImportRootCollapseStats = {
  technicalRootsSeen: 0,
  collapsed: 0,
  kept: 0,
  byAsset: {},
};

if (typeof globalThis === "object") {
  (
    globalThis as {
      __snapImportRootCollapseStats?: ImportRootCollapseStats;
      __snapDebugImportRootCollapse?: boolean;
    }
  ).__snapImportRootCollapseStats = importRootCollapseStats;
}

export async function instantiateAsset(
  asset: AssetDefinition,
  preview: boolean,
  template: AssetTemplate,
  scene: Scene,
  placementKind: "clone" | "instance" = "clone",
) {
  const root =
    preview || placementKind === "clone"
      ? template.root.clone(`${asset.id}-${preview ? "preview" : "clone"}`)
      : template.root.instantiateHierarchy(null, { doNotInstantiate: false });
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

export async function loadAssetTemplate(
  asset: AssetDefinition,
  scene: Scene,
  basePath: string,
  freezeModelMaterials = true,
): Promise<AssetTemplate> {
  try {
    const assetReference = splitAssetFileReference(asset.fileName);
    const importResult = await SceneLoader.ImportMeshAsync(
      "",
      `${basePath}${assetReference.directory}`,
      assetReference.fileName,
      scene,
    );
    const root = new TransformNode(`template-${asset.id}`, scene);

    const importedRootNodes = [...importResult.transformNodes, ...importResult.meshes].filter((node) => !node.parent);
    importedRootNodes.forEach((node) => {
      const technicalRoot = node instanceof TransformNode && isTechnicalImportRootName(node.name);
      const nextNode =
        node instanceof TransformNode
          ? (collapseRedundantImportRoot(node, root) ?? node)
          : node;
      if (technicalRoot && isImportRootCollapseDebugEnabled()) {
        recordImportRootCollapse(asset.id, node, nextNode !== node);
      }
      if (!nextNode.parent && nextNode !== root) {
        nextNode.parent = root;
      }
    });

    const size = normalizeTemplateRoot(root);
    setRootMaterialsFrozen(root, freezeModelMaterials);
    root.setEnabled(false);
    return { root, size };
  } catch {
    const root = createPlaceholderTemplate(asset, scene);
    const size = normalizeTemplateRoot(root);
    setRootMaterialsFrozen(root, freezeModelMaterials);
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

function recordImportRootCollapse(assetId: string, root: TransformNode, collapsed: boolean) {
  importRootCollapseStats.technicalRootsSeen += 1;
  if (collapsed) {
    importRootCollapseStats.collapsed += 1;
  } else {
    importRootCollapseStats.kept += 1;
  }

  const nextAssetStats = importRootCollapseStats.byAsset[assetId] ?? {
    seen: 0,
    collapsed: 0,
    kept: 0,
  };
  nextAssetStats.seen += 1;
  if (collapsed) {
    nextAssetStats.collapsed += 1;
  } else {
    nextAssetStats.kept += 1;
  }
  importRootCollapseStats.byAsset[assetId] = nextAssetStats;

  console.info(
    `[snap] import root ${collapsed ? "collapsed" : "kept"} for asset "${assetId}" (${root.name})`,
  );
}

function isImportRootCollapseDebugEnabled() {
  if (typeof globalThis !== "object") {
    return false;
  }

  const globalFlag = (
    globalThis as {
      __snapDebugImportRootCollapse?: boolean;
    }
  ).__snapDebugImportRootCollapse;
  if (globalFlag === true) {
    return true;
  }

  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    return localStorage.getItem("snap.debug.importRootCollapse") === "1";
  } catch {
    return false;
  }
}
