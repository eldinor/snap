export type EditorMode = "select" | "place";

export interface ToolbarViewState {
  snapEnabled: boolean;
  ySnapEnabled: boolean;
  mode: EditorMode;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasObjects: boolean;
  gridSize: number;
  rotationStepDegrees: number;
  environmentEnabled: boolean;
  environmentIntensity: number;
  lightIntensity: number;
  gridVisible: boolean;
  gridColor: string;
  groundColor: string;
}

export interface StatusViewState {
  mode: EditorMode;
  activeAssetName: string | null;
  snapEnabled: boolean;
  ySnapEnabled: boolean;
  gridSize: number;
  rotationStepDegrees: number;
  hint: string;
}

export interface SelectionViewState {
  selectedObjectId: string | null;
  selectedAssetName: string | null;
  activeAssetName: string | null;
  previewAssetName: string | null;
  position: [number, number, number] | null;
  rotationYDegrees: number | null;
  positionText: string | null;
  rotationText: string | null;
  snapText: string | null;
}

export interface SceneItemViewState {
  id: string;
  assetId: string;
  assetName: string;
  label: string;
  selected: boolean;
  hidden: boolean;
  locked: boolean;
  type: "object" | "group";
  parentId: string | null;
  depth: number;
}

export interface EditorViewState {
  activeAssetId: string | null;
  previewAssetId: string | null;
  objectCount: number;
  selectionCount: number;
  noticeMessage: string | null;
  lastManualSaveAt: string | null;
  lastRecoveredAutosaveAt: string | null;
  sceneItems: SceneItemViewState[];
  toolbar: ToolbarViewState;
  status: StatusViewState;
  selection: SelectionViewState;
}

export function createInitialEditorViewState(): EditorViewState {
  return {
    activeAssetId: null,
    previewAssetId: null,
    objectCount: 0,
    selectionCount: 0,
    noticeMessage: null,
    sceneItems: [],
    toolbar: {
      snapEnabled: true,
      ySnapEnabled: false,
      mode: "select",
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      hasObjects: false,
      gridSize: 1,
      rotationStepDegrees: 90,
      environmentEnabled: true,
      environmentIntensity: 0.1,
      lightIntensity: 1.1,
      gridVisible: true,
      gridColor: "#292f38",
      groundColor: "#1f2326",
    },
    lastManualSaveAt: null,
    lastRecoveredAutosaveAt: null,
    status: {
      mode: "select",
      activeAssetName: null,
      snapEnabled: true,
      ySnapEnabled: false,
      gridSize: 1,
      rotationStepDegrees: 90,
      hint: "Click object select | Delete remove | R rotate",
    },
    selection: {
      selectedObjectId: null,
      selectedAssetName: null,
      activeAssetName: null,
      previewAssetName: null,
      position: null,
      rotationYDegrees: null,
      positionText: null,
      rotationText: null,
      snapText: "Grid 1",
    },
  };
}
