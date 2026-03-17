import { SnapshotHistory } from "./snapshot-history";
import { parseSerializedAssetScene, type SerializedAssetScene } from "./scene-serialization";

interface SceneSessionControllerOptions {
  history: SnapshotHistory;
  getSnapshotText: () => string;
  restoreSnapshot: (scene: SerializedAssetScene) => Promise<void>;
  onStateChanged?: () => void;
  onNotice?: (message: string) => void;
}

export class SceneSessionController {
  private readonly history: SnapshotHistory;
  private readonly getSnapshotText: () => string;
  private readonly restoreSnapshot: (scene: SerializedAssetScene) => Promise<void>;
  private readonly onStateChanged?: () => void;
  private readonly onNotice?: (message: string) => void;
  private dragSnapshot: string | null = null;

  constructor(options: SceneSessionControllerOptions) {
    this.history = options.history;
    this.getSnapshotText = options.getSnapshotText;
    this.restoreSnapshot = options.restoreSnapshot;
    this.onStateChanged = options.onStateChanged;
    this.onNotice = options.onNotice;
  }

  resetHistory() {
    this.history.reset(this.getSnapshotText());
    this.onStateChanged?.();
  }

  beginHistoryGesture(enabled: boolean) {
    if (!enabled || this.dragSnapshot) {
      return;
    }

    this.dragSnapshot = this.getSnapshotText();
  }

  completeHistoryGesture() {
    if (!this.dragSnapshot) {
      return;
    }

    this.pushHistoryCheckpoint(this.dragSnapshot);
    this.dragSnapshot = null;
  }

  pushHistoryCheckpoint(previousSnapshot?: string) {
    const currentSnapshot = this.getSnapshotText();
    this.history.push(currentSnapshot, previousSnapshot);
    this.onStateChanged?.();
  }

  async undo() {
    const previousSnapshot = this.history.undo();
    if (!previousSnapshot) {
      return;
    }

    await this.restoreSnapshot(JSON.parse(previousSnapshot) as SerializedAssetScene);
    this.onStateChanged?.();
  }

  async redo() {
    const nextSnapshot = this.history.redo();
    if (!nextSnapshot) {
      return;
    }

    await this.restoreSnapshot(JSON.parse(nextSnapshot) as SerializedAssetScene);
    this.onStateChanged?.();
  }

  exportToFile() {
    const blob = new Blob([this.getSnapshotText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "asset-scene.v1.json";
    anchor.click();
    URL.revokeObjectURL(url);
    this.onNotice?.("Scene saved as asset-scene.v1.json");
  }

  async importFromFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseSerializedAssetScene(JSON.parse(text) as unknown);
      if (!parsed) {
        this.onNotice?.("Load failed: invalid scene file format or unsupported version.");
        return;
      }

      await this.restoreSnapshot(parsed);
      this.resetHistory();
      this.onNotice?.(`Scene loaded: ${file.name}`);
    } catch {
      this.onNotice?.(`Load failed: could not read ${file.name}.`);
    }
  }
}
