import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Node } from "@babylonjs/core/node";

const TECHNICAL_IMPORT_ROOT_NAMES = new Set(["__root__", "root", "rootnode"]);
const MATRIX_EPSILON = 0.0001;

export interface ImportRootCollapseCandidate {
  rootName: string;
  directChildCount: number;
  hasAnimations: boolean;
  hasGeometry: boolean;
}

export function shouldCollapseRedundantImportRoot(candidate: ImportRootCollapseCandidate) {
  return (
    !candidate.hasGeometry &&
    !candidate.hasAnimations &&
    candidate.directChildCount === 1 &&
    isTechnicalImportRootName(candidate.rootName)
  );
}

export function isTechnicalImportRootName(name: string) {
  return TECHNICAL_IMPORT_ROOT_NAMES.has(name.trim().toLowerCase());
}

export function collapseRedundantImportRoot(root: TransformNode, targetParent: TransformNode): Node | null {
  const directChildren = root.getChildren((node) => node.parent === root);
  const candidate: ImportRootCollapseCandidate = {
    rootName: root.name,
    directChildCount: directChildren.length,
    hasAnimations: root.animations.length > 0,
    hasGeometry: false,
  };

  if (!shouldCollapseRedundantImportRoot(candidate)) {
    return null;
  }

  const child = directChildren[0];
  if (!(child instanceof TransformNode)) {
    return null;
  }

  const childWorldMatrix = child.computeWorldMatrix(true).clone();
  const parentWorldMatrix = targetParent.computeWorldMatrix(true);
  const parentWorldInverse = parentWorldMatrix.clone();
  parentWorldInverse.invert();
  const localMatrix = childWorldMatrix.multiply(parentWorldInverse);
  const scaling = new Vector3();
  const rotation = new Quaternion();
  const position = new Vector3();

  if (!localMatrix.decompose(scaling, rotation, position)) {
    return null;
  }

  const recomposedLocalMatrix = Matrix.Compose(scaling, rotation, position);
  if (!matricesMatch(localMatrix, recomposedLocalMatrix)) {
    return null;
  }

  child.setParent(targetParent);
  child.position.copyFrom(position);
  child.scaling.copyFrom(scaling);
  child.rotationQuaternion = rotation;
  child.rotation.set(0, 0, 0);

  root.dispose(false, false);
  return child;
}

function matricesMatch(left: Matrix, right: Matrix) {
  const leftValues = left.toArray();
  const rightValues = right.toArray();
  if (leftValues.length !== rightValues.length) {
    return false;
  }

  for (let index = 0; index < leftValues.length; index += 1) {
    if (Math.abs(leftValues[index] - rightValues[index]) > MATRIX_EPSILON) {
      return false;
    }
  }

  return true;
}
