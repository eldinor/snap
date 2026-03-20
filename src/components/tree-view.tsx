import type { ReactNode, RefObject } from "react";

interface TreeViewProps<T> {
  items: T[];
  emptyMessage: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  className?: string;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export function TreeView<T>(props: TreeViewProps<T>) {
  if (props.items.length === 0) {
    return <div className="properties-empty">{props.emptyMessage}</div>;
  }

  return (
    <div ref={props.containerRef} className={props.className ?? "tree-view"}>
      {props.items.map((item) => props.renderItem(item))}
    </div>
  );
}
