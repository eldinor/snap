export interface AssetSceneSerializableObject {
  id?: string;
  libraryId: string;
  assetId: string;
  placementKind?: "clone" | "instance";
  position: [number, number, number];
  rotationDegrees?: [number, number, number];
  rotationYDegrees: number;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  parentId?: string | null;
}

export interface SerializedAssetSceneMetadata {
  savedAt?: string;
  snapEnabled?: boolean;
  ySnapEnabled?: boolean;
  gridSize?: number;
  rotationStepDegrees?: number;
  environmentEnabled?: boolean;
  environmentIntensity?: number;
  lightIntensity?: number;
  gridVisible?: boolean;
  gridColor?: string;
  groundColor?: string;
  sceneGroups?: SerializedSceneGroup[];
  sceneRootOrder?: string[];
}

export interface SerializedSceneGroup {
  id: string;
  name: string;
  childIds: string[];
  hidden?: boolean;
  locked?: boolean;
  parentId?: string | null;
}

export interface SerializedAssetScene {
  version: 1;
  metadata?: SerializedAssetSceneMetadata;
  objects: AssetSceneSerializableObject[];
}

export function serializeAssetScene(
  objects: Iterable<AssetSceneSerializableObject>,
  metadata?: SerializedAssetSceneMetadata,
): SerializedAssetScene {
  return {
    version: 1,
    metadata: metadata
      ? {
          ...metadata,
        }
      : undefined,
    objects: Array.from(objects, (object) => ({
      id: object.id,
      libraryId: object.libraryId,
      assetId: object.assetId,
      placementKind: object.placementKind,
      position: [...object.position] as [number, number, number],
      rotationDegrees: object.rotationDegrees ? [...object.rotationDegrees] as [number, number, number] : undefined,
      rotationYDegrees: object.rotationYDegrees,
      name: object.name,
      hidden: object.hidden,
      locked: object.locked,
      parentId: object.parentId,
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

  if (candidate.metadata !== undefined) {
    const metadata = candidate.metadata as Partial<SerializedAssetSceneMetadata>;
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    const isValidColor = (entry: unknown) => typeof entry === "string" && /^#[0-9a-f]{6}$/iu.test(entry);
    const hasInvalidMetadata =
      (metadata.savedAt !== undefined && typeof metadata.savedAt !== "string") ||
      (metadata.snapEnabled !== undefined && typeof metadata.snapEnabled !== "boolean") ||
      (metadata.ySnapEnabled !== undefined && typeof metadata.ySnapEnabled !== "boolean") ||
      (metadata.gridSize !== undefined && typeof metadata.gridSize !== "number") ||
      (metadata.rotationStepDegrees !== undefined && typeof metadata.rotationStepDegrees !== "number") ||
      (metadata.environmentEnabled !== undefined && typeof metadata.environmentEnabled !== "boolean") ||
      (metadata.environmentIntensity !== undefined && typeof metadata.environmentIntensity !== "number") ||
      (metadata.lightIntensity !== undefined && typeof metadata.lightIntensity !== "number") ||
      (metadata.gridVisible !== undefined && typeof metadata.gridVisible !== "boolean") ||
      (metadata.gridColor !== undefined && !isValidColor(metadata.gridColor)) ||
      (metadata.groundColor !== undefined && !isValidColor(metadata.groundColor)) ||
      (metadata.sceneRootOrder !== undefined &&
        (!Array.isArray(metadata.sceneRootOrder) || metadata.sceneRootOrder.some((id) => typeof id !== "string"))) ||
      (metadata.sceneGroups !== undefined &&
        (!Array.isArray(metadata.sceneGroups) ||
          metadata.sceneGroups.some(
            (group) =>
              !group ||
              typeof group !== "object" ||
              typeof (group as Partial<SerializedSceneGroup>).id !== "string" ||
              typeof (group as Partial<SerializedSceneGroup>).name !== "string" ||
              ((group as Partial<SerializedSceneGroup>).hidden !== undefined &&
                typeof (group as Partial<SerializedSceneGroup>).hidden !== "boolean") ||
              ((group as Partial<SerializedSceneGroup>).locked !== undefined &&
                typeof (group as Partial<SerializedSceneGroup>).locked !== "boolean") ||
              ((group as Partial<SerializedSceneGroup>).parentId !== undefined &&
                (group as Partial<SerializedSceneGroup>).parentId !== null &&
                typeof (group as Partial<SerializedSceneGroup>).parentId !== "string") ||
              !Array.isArray((group as Partial<SerializedSceneGroup>).childIds) ||
              (group as Partial<SerializedSceneGroup>).childIds!.some((id) => typeof id !== "string"),
          )));

    if (hasInvalidMetadata) {
      return null;
    }
  }

  const objects = candidate.objects.filter((object): object is AssetSceneSerializableObject => {
    if (!object || typeof object !== "object") {
      return false;
    }

    const entry = object as Partial<AssetSceneSerializableObject>;
    return (
      (entry.id === undefined || typeof entry.id === "string") &&
      typeof entry.libraryId === "string" &&
      (entry.placementKind === undefined || entry.placementKind === "clone" || entry.placementKind === "instance") &&
      typeof entry.assetId === "string" &&
      (entry.rotationYDegrees === undefined || typeof entry.rotationYDegrees === "number") &&
      (entry.rotationDegrees === undefined ||
        (Array.isArray(entry.rotationDegrees) &&
          entry.rotationDegrees.length === 3 &&
          entry.rotationDegrees.every((component) => typeof component === "number"))) &&
      (entry.name === undefined || typeof entry.name === "string") &&
      (entry.hidden === undefined || typeof entry.hidden === "boolean") &&
      (entry.locked === undefined || typeof entry.locked === "boolean") &&
      (entry.parentId === undefined || entry.parentId === null || typeof entry.parentId === "string") &&
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
    metadata: candidate.metadata
      ? {
          ...candidate.metadata,
        }
      : undefined,
    objects,
  };
}
