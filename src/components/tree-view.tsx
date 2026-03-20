import type { ReactNode } from "react";

interface TreeViewProps<T> {
  items: T[];
  emptyMessage: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  className?: string;
}

export function TreeView<T>(props: TreeViewProps<T>) {
  if (props.items.length === 0) {
    return <div className="properties-empty">{props.emptyMessage}</div>;
  }

  return <div className={props.className ?? "tree-view"}>{props.items.map((item) => props.renderItem(item))}</div>;
}
