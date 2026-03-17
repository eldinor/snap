export type EditorMode = "select" | "place";

export interface ToolbarViewState {
  snapEnabled: boolean;
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
}

export interface StatusViewState {
  mode: EditorMode;
  activeAssetName: string | null;
  snapEnabled: boolean;
  gridSize: number;
  rotationStepDegrees: number;
  hint: string;
}

export interface SelectionViewState {
  selectedObjectId: string | null;
  selectedAssetName: string | null;
  activeAssetName: string | null;
  previewAssetName: string | null;
  positionText: string | null;
  rotationText: string | null;
  snapText: string | null;
}

export interface EditorViewState {
  activeAssetId: string | null;
  previewAssetId: string | null;
  objectCount: number;
  noticeMessage: string | null;
  toolbar: ToolbarViewState;
  status: StatusViewState;
  selection: SelectionViewState;
}

export function createInitialEditorViewState(): EditorViewState {
  return {
    activeAssetId: null,
    previewAssetId: null,
    objectCount: 0,
    noticeMessage: null,
    toolbar: {
      snapEnabled: true,
      mode: "select",
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      hasObjects: false,
      gridSize: 1,
      rotationStepDegrees: 90,
      environmentEnabled: false,
      environmentIntensity: 1.75,
      lightIntensity: 1.1,
    },
    status: {
      mode: "select",
      activeAssetName: null,
      snapEnabled: true,
      gridSize: 1,
      rotationStepDegrees: 90,
      hint: "Click object select | Delete remove | R rotate",
    },
    selection: {
      selectedObjectId: null,
      selectedAssetName: null,
      activeAssetName: null,
      previewAssetName: null,
      positionText: null,
      rotationText: null,
      snapText: "Grid 1",
    },
  };
}
