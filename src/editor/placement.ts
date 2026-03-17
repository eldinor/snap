import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

export function computeSnapOffset(size: number, snapEnabled: boolean, gridSize: number) {
  if (!snapEnabled || gridSize <= 0) {
    return 0;
  }

  const cells = Math.max(1, Math.round(size / gridSize));
  return cells % 2 === 0 ? 0 : gridSize / 2;
}

export function snapScalar(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function snapVectorForSize(point: Vector3, size: Vector3, snapEnabled: boolean, gridSize: number) {
  const xOffset = computeSnapOffset(size.x, snapEnabled, gridSize);
  const zOffset = computeSnapOffset(size.z, snapEnabled, gridSize);

  return new Vector3(
    snapScalar(point.x - xOffset, gridSize) + xOffset,
    0,
    snapScalar(point.z - zOffset, gridSize) + zOffset,
  );
}

export function snapAngle(valueRadians: number, snapEnabled: boolean, stepRadians: number) {
  if (!snapEnabled) {
    return valueRadians;
  }

  return Math.round(valueRadians / stepRadians) * stepRadians;
}

export function clonePreviewMaterial(material: unknown, fallbackHex: string, scene: Scene) {
  if (material instanceof StandardMaterial) {
    const clone = material.clone(`${material.name}-preview`);
    clone.alpha = 0.72;
    clone.diffuseColor = Color3.Lerp(material.diffuseColor, Color3.White(), 0.55);
    clone.emissiveColor = clone.diffuseColor.scale(0.45);
    clone.specularColor = clone.diffuseColor.scale(0.15);
    return clone;
  }

  const previewMaterial = new StandardMaterial("preview-material", scene);
  previewMaterial.diffuseColor = Color3.Lerp(Color3.FromHexString(fallbackHex), Color3.White(), 0.55);
  previewMaterial.alpha = 0.72;
  previewMaterial.emissiveColor = previewMaterial.diffuseColor.scale(0.45);
  previewMaterial.specularColor = previewMaterial.diffuseColor.scale(0.15);
  return previewMaterial;
}
