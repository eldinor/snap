export class SnapshotHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  reset(snapshot: string) {
    this.undoStack = [snapshot];
    this.redoStack = [];
  }

  push(snapshot: string, baseline?: string) {
    const compareTo = baseline ?? this.undoStack[this.undoStack.length - 1];
    if (compareTo === snapshot) {
      return false;
    }

    this.undoStack.push(snapshot);
    this.redoStack = [];
    return true;
  }

  undo() {
    if (this.undoStack.length <= 1) {
      return null;
    }

    const current = this.undoStack.pop();
    if (!current) {
      return null;
    }

    this.redoStack.push(current);
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) {
      return null;
    }

    this.undoStack.push(next);
    return next;
  }

  get canUndo() {
    return this.undoStack.length > 1;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }
}
