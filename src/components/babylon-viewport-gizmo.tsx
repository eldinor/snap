import { useEffect, useRef } from "react";
import type { Scene } from "@babylonjs/core/scene";
import {
  ViewportGizmoController,
  type ViewportGizmoOptions,
} from "../editor/viewport-gizmo-controller";

export interface BabylonViewportGizmoProps {
  scene: Scene;
  options?: ViewportGizmoOptions;
}

export function BabylonViewportGizmo({ scene, options }: BabylonViewportGizmoProps) {
  const controllerRef = useRef<ViewportGizmoController | null>(null);

  useEffect(() => {
    const controller = new ViewportGizmoController(scene, options);
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    controllerRef.current?.updateOptions(options ?? {});
  }, [options]);

  return null;
}
