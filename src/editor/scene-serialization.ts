export interface AssetSceneSerializableObject {
  assetId: string;
  position: [number, number, number];
  rotationYDegrees: number;
}

export interface SerializedAssetScene {
  version: 1;
  objects: AssetSceneSerializableObject[];
}

export function serializeAssetScene(objects: Iterable<AssetSceneSerializableObject>): SerializedAssetScene {
  return {
    version: 1,
    objects: Array.from(objects, (object) => ({
      assetId: object.assetId,
      position: [...object.position] as [number, number, number],
      rotationYDegrees: object.rotationYDegrees,
    })),
  };
}

export function parseSerializedAssetScene(value: unknown): SerializedAssetScene | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SerializedAssetScene>;
  if (candidate.version !== 1 || !Array.isArray(candidate.objects)) {
    return null;
  }

  const objects = candidate.objects.filter((object): object is AssetSceneSerializableObject => {
    if (!object || typeof object !== "object") {
      return false;
    }

    const entry = object as Partial<AssetSceneSerializableObject>;
    return (
      typeof entry.assetId === "string" &&
      typeof entry.rotationYDegrees === "number" &&
      Array.isArray(entry.position) &&
      entry.position.length === 3 &&
      entry.position.every((component) => typeof component === "number")
    );
  });

  if (objects.length !== candidate.objects.length) {
    return null;
  }

  return {
    version: 1,
    objects,
  };
}
