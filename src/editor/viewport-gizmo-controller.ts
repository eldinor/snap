import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";

export type ViewportGizmoAnchor = "top-right" | "top-left" | "bottom-right" | "bottom-left";
export type ViewportGizmoSnapTarget = "x" | "-x" | "y" | "-y" | "z" | "-z" | "center";
type BubbleAxisTarget = Exclude<ViewportGizmoSnapTarget, "center">;
export type Color3Like = Color3 | { r: number; g: number; b: number } | string;
export type Color4Like = Color4 | { r: number; g: number; b: number; a: number } | string;

export interface ViewportGizmoAxisColors {
  x: Color3Like;
  y: Color3Like;
  z: Color3Like;
  negativeX: Color3Like;
  negativeY: Color3Like;
  negativeZ: Color3Like;
  center: Color3Like;
}

export interface ViewportGizmoOptions {
  enabled?: boolean;
  size?: number;
  margin?: number;
  anchor?: ViewportGizmoAnchor;
  showCenter?: boolean;
  showNegativeAxes?: boolean;
  showAxisLabels?: boolean;
  axisColors?: Partial<ViewportGizmoAxisColors>;
  backgroundEnabled?: boolean;
  backgroundColor?: Color4Like;
  lineLength?: number;
  axisThickness?: number;
  capSize?: number;
  defaultAlpha?: number;
  defaultBeta?: number;
  onSnapStart?: (target: ViewportGizmoSnapTarget) => void;
  onSnapEnd?: (target: ViewportGizmoSnapTarget) => void;
}

interface Bubble {
  axis: BubbleAxisTarget;
  direction: Vector3;
  color: [string, string];
  label?: string;
  primary: boolean;
  radius: number;
  lineWidth: number;
  projectedPosition: Vector3;
}

const DEFAULT_AXIS_COLORS: ViewportGizmoAxisColors = {
  x: "#d96a6a",
  y: "#6bcf7c",
  z: "#6ea8ff",
  negativeX: "#7a4343",
  negativeY: "#3f7a4b",
  negativeZ: "#425f96",
  center: "#f2f4f8",
};

interface DirectionalSnapCandidate {
  direction: Vector3;
  flashAxes: BubbleAxisTarget[];
  projectedDirection: Vector2;
}

const DEFAULT_OPTIONS: Required<Omit<ViewportGizmoOptions, "axisColors" | "onSnapStart" | "onSnapEnd">> & {
  axisColors: ViewportGizmoAxisColors;
} = {
  enabled: true,
  size: 96,
  margin: 12,
  anchor: "top-right",
  showCenter: true,
  showNegativeAxes: true,
  showAxisLabels: true,
  axisColors: DEFAULT_AXIS_COLORS,
  backgroundEnabled: true,
  backgroundColor: { r: 0.08, g: 0.09, b: 0.11, a: 0.72 },
  lineLength: 0.62,
  axisThickness: 2,
  capSize: 9,
  defaultAlpha: Math.PI / 3,
  defaultBeta: Math.PI / 2.9,
};

export class ViewportGizmoController {
  private static readonly BETA_EPSILON = 0.05;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly beforeRenderObserver: Observer<Scene>;
  private readonly resizeObserver: Observer<unknown>;
  private readonly bubbles: Bubble[];
  private readonly center = new Vector2();
  private options: Required<Omit<ViewportGizmoOptions, "axisColors" | "onSnapStart" | "onSnapEnd">> & {
    axisColors: ViewportGizmoAxisColors;
    onSnapStart?: (target: ViewportGizmoSnapTarget) => void;
    onSnapEnd?: (target: ViewportGizmoSnapTarget) => void;
  };
  private activeCamera: Camera | null;
  private enabled: boolean;
  private hoveredAxis: Bubble | null = null;
  private flashAxisSet = new Set<BubbleAxisTarget>();
  private flashAxisTimeoutId: number | null = null;
  private readonly handleMouseMove = (event: MouseEvent) => {
    if (!this.enabled) {
      return;
    }
    const pointer = this.getLocalPointerPosition(event);
    this.hoveredAxis = this.pickBubble(pointer);
    this.draw();
  };
  private readonly handleMouseLeave = () => {
    this.hoveredAxis = null;
    this.draw();
  };
  private readonly handleClick = (event: MouseEvent) => {
    if (!this.enabled) {
      return;
    }
    const pointer = this.getLocalPointerPosition(event);
    const exactBubble = this.pickBubble(pointer);
    if (exactBubble) {
      this.flashAxes([exactBubble.axis]);
      this.snapCameraToTarget(exactBubble.axis, exactBubble.direction.clone());
      return;
    }

    const diagonalTarget = this.pickDirectionalTarget(pointer);
    if (diagonalTarget) {
      this.flashAxes(diagonalTarget.flashAxes);
      this.snapCameraToDirection(diagonalTarget.direction);
    }
  };

  constructor(scene: Scene, options?: ViewportGizmoOptions) {
    this.scene = scene;
    this.options = this.mergeOptions(options);
    this.enabled = this.options.enabled;
    this.activeCamera = this.resolveCamera();

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.options.size;
    this.canvas.height = this.options.size;
    this.canvas.style.position = "absolute";
    this.canvas.style.zIndex = "5";
    this.canvas.style.pointerEvents = "auto";
    this.canvas.style.userSelect = "none";
    this.canvas.style.touchAction = "none";
    this.positionCanvas();

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("ViewportGizmoController could not create a 2D canvas context.");
    }
    this.context = context;

    this.bubbles = this.createBubbles();
    this.attachCanvas();
    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave);
    this.canvas.addEventListener("click", this.handleClick);

    this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.syncCamera();
      this.draw();
    });
    this.resizeObserver = this.scene.getEngine().onResizeObservable.add(() => {
      this.positionCanvas();
      this.draw();
    });

    this.applyEnabledState();
    this.draw();
  }

  dispose() {
    this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
    this.scene.getEngine().onResizeObservable.remove(this.resizeObserver);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
    this.canvas.removeEventListener("click", this.handleClick);
    if (this.flashAxisTimeoutId !== null) {
      window.clearTimeout(this.flashAxisTimeoutId);
      this.flashAxisTimeoutId = null;
    }
    this.canvas.remove();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.applyEnabledState();
  }

  updateOptions(options: Partial<ViewportGizmoOptions>) {
    this.options = this.mergeOptions({ ...this.options, ...options });
    this.enabled = this.options.enabled;
    this.canvas.width = this.options.size;
    this.canvas.height = this.options.size;
    this.positionCanvas();
    this.applyEnabledState();
    this.draw();
  }

  refreshCamera() {
    this.activeCamera = this.resolveCamera();
    this.draw();
  }

  private mergeOptions(options?: ViewportGizmoOptions) {
    return {
      ...DEFAULT_OPTIONS,
      ...options,
      axisColors: {
        ...DEFAULT_AXIS_COLORS,
        ...(options?.axisColors ?? {}),
      },
    };
  }

  private resolveCamera() {
    return this.scene.activeCamera ?? this.scene.activeCameras?.[0] ?? null;
  }

  private attachCanvas() {
    const renderingCanvas = this.scene.getEngine().getRenderingCanvas();
    const host = renderingCanvas?.parentElement;
    if (!renderingCanvas || !host) {
      return;
    }

    const computedStyle = window.getComputedStyle(host);
    if (computedStyle.position === "static") {
      host.style.position = "relative";
    }
    host.appendChild(this.canvas);
  }

  private positionCanvas() {
    const margin = `${this.options.margin}px`;
    this.canvas.style.width = `${this.options.size}px`;
    this.canvas.style.height = `${this.options.size}px`;
    this.canvas.style.top = "";
    this.canvas.style.right = "";
    this.canvas.style.bottom = "";
    this.canvas.style.left = "";

    if (this.options.anchor.startsWith("top")) {
      this.canvas.style.top = margin;
    } else {
      this.canvas.style.bottom = margin;
    }

    if (this.options.anchor.endsWith("right")) {
      this.canvas.style.right = margin;
    } else {
      this.canvas.style.left = margin;
    }
  }

  private applyEnabledState() {
    this.canvas.style.display = this.enabled ? "block" : "none";
  }

  private createBubbles(): Bubble[] {
    const primaryRadius = this.options.capSize;
    const secondaryRadius = Math.max(5, Math.round(this.options.capSize * 0.75));

    return [
      this.createBubble("x", new Vector3(1, 0, 0), this.options.axisColors.x, this.options.axisColors.negativeX, true, primaryRadius, "X"),
      this.createBubble("y", new Vector3(0, 1, 0), this.options.axisColors.y, this.options.axisColors.negativeY, true, primaryRadius, "Y"),
      this.createBubble("z", new Vector3(0, 0, 1), this.options.axisColors.z, this.options.axisColors.negativeZ, true, primaryRadius, "Z"),
      this.createBubble("-x", new Vector3(-1, 0, 0), this.options.axisColors.x, this.options.axisColors.negativeX, false, secondaryRadius),
      this.createBubble("-y", new Vector3(0, -1, 0), this.options.axisColors.y, this.options.axisColors.negativeY, false, secondaryRadius),
      this.createBubble("-z", new Vector3(0, 0, -1), this.options.axisColors.z, this.options.axisColors.negativeZ, false, secondaryRadius),
    ];
  }

  private createBubble(
    axis: Bubble["axis"],
    direction: Vector3,
    primaryColor: Color3Like,
    secondaryColor: Color3Like,
    primary: boolean,
    radius: number,
    label?: string,
  ): Bubble {
    return {
      axis,
      direction,
      color: [this.toColor3(primaryColor).toHexString(), this.toColor3(secondaryColor).toHexString()],
      label,
      primary,
      radius,
      lineWidth: primary ? this.options.axisThickness : 0,
      projectedPosition: Vector3.Zero(),
    };
  }

  private syncCamera() {
    this.activeCamera = this.resolveCamera();
  }

  private draw() {
    if (!this.enabled) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.center.set(this.canvas.width * 0.5, this.canvas.height * 0.5);

    if (this.options.backgroundEnabled) {
      this.drawBackground();
    }

    this.projectBubbles();
    const layers = this.getDrawOrder();
    layers.forEach((bubble) => {
      this.drawBubble(bubble);
    });
  }

  private drawBackground() {
    const color = this.toColor4(this.options.backgroundColor);
    this.context.beginPath();
    this.context.arc(this.center.x, this.center.y, this.canvas.width * 0.48, 0, Math.PI * 2);
    this.context.fillStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`;
    this.context.fill();
    this.context.closePath();
  }

  private projectBubbles() {
    const camera = this.activeCamera;
    if (!camera) {
      return;
    }

    const projectionMatrix = camera.getViewMatrix();
    const radius = this.center.x - this.options.capSize - this.options.margin * 0.4;

    this.bubbles.forEach((bubble) => {
      const projected = Vector3.TransformNormal(bubble.direction, projectionMatrix);
      bubble.projectedPosition.set(
        projected.x * radius + this.center.x,
        this.center.y - projected.y * radius,
        projected.z,
      );
    });
  }

  private getDrawOrder() {
    const visibleBubbles = this.bubbles.filter((bubble) => this.options.showNegativeAxes || bubble.primary);
    return visibleBubbles.slice().sort((left, right) => left.projectedPosition.z - right.projectedPosition.z);
  }

  private drawBubble(bubble: Bubble) {
    const isHovered = this.hoveredAxis === bubble;
    const isFlashed = this.flashAxisSet.has(bubble.axis);
    const color = isHovered ? "#ffffff" : bubble.projectedPosition.z >= -0.01 ? bubble.color[0] : bubble.color[1];
    const renderedColor = isFlashed ? "#ffffff" : color;
    const renderedRadius = isFlashed ? bubble.radius + 1.5 : bubble.radius;

    if (bubble.lineWidth > 0) {
      this.context.beginPath();
      this.context.moveTo(this.center.x, this.center.y);
      this.context.lineTo(bubble.projectedPosition.x, bubble.projectedPosition.y);
      this.context.lineWidth = isFlashed ? bubble.lineWidth + 0.75 : bubble.lineWidth;
      this.context.strokeStyle = renderedColor;
      this.context.stroke();
      this.context.closePath();
    }

    this.context.beginPath();
    this.context.arc(bubble.projectedPosition.x, bubble.projectedPosition.y, renderedRadius, 0, Math.PI * 2);
    this.context.fillStyle = renderedColor;
    this.context.fill();
    this.context.closePath();

    if (bubble.label) {
      this.context.font = "bold 11px Arial";
      this.context.textAlign = "center";
      this.context.textBaseline = "middle";
      this.context.fillStyle = "#151515";
      this.context.fillText(bubble.label, bubble.projectedPosition.x, bubble.projectedPosition.y);
    }
  }

  private getLocalPointerPosition(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return new Vector2(event.clientX - rect.left, event.clientY - rect.top);
  }

  private pickBubble(pointer: Vector2) {
    let nearestBubble: Bubble | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.getDrawOrder().forEach((bubble) => {
      const distance = Vector2.Distance(pointer, new Vector2(bubble.projectedPosition.x, bubble.projectedPosition.y));
      if (distance <= bubble.radius && distance < nearestDistance) {
        nearestDistance = distance;
        nearestBubble = bubble;
      }
    });

    return nearestBubble;
  }

  private pickDirectionalTarget(pointer: Vector2) {
    const fromCenter = pointer.subtract(this.center);
    const maxRadius = this.canvas.width * 0.48;
    const length = fromCenter.length();
    if (length > maxRadius || length < this.options.capSize * 0.5) {
      return null;
    }

    const normalizedPointer = fromCenter.scale(1 / length);
    const candidates = this.getDirectionalSnapCandidates();

    if (candidates.length === 0) {
      return null;
    }

    let bestCandidate: DirectionalSnapCandidate | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    candidates.forEach((candidate) => {
      const score = Vector2.Dot(normalizedPointer, candidate.projectedDirection);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    });

    return bestScore >= 0.58 ? bestCandidate : null;
  }

  private snapCameraToTarget(target: ViewportGizmoSnapTarget, direction: Vector3) {
    this.options.onSnapStart?.(target);
    this.snapCameraToDirection(direction, () => {
      this.options.onSnapEnd?.(target);
    });
  }

  private snapCameraToDirection(direction: Vector3, onComplete?: () => void) {
    const activeCamera = this.resolveCamera();
    if (!(activeCamera instanceof ArcRotateCamera)) {
      return;
    }

    const normalized = direction.normalize();
    const currentAlpha = activeCamera.alpha;
    const currentBeta = activeCamera.beta;
    const rawNextAlpha = Math.atan2(normalized.z, normalized.x);
    const nextAlpha = this.normalizeAngleNear(currentAlpha, rawNextAlpha);
    const nextBeta = this.clampBeta(Math.acos(Math.min(1, Math.max(-1, normalized.y))));

    this.scene.stopAnimation(activeCamera);
    activeCamera.inertialAlphaOffset = 0;
    activeCamera.inertialBetaOffset = 0;
    activeCamera.inertialRadiusOffset = 0;
    if (Math.abs(currentAlpha - nextAlpha) > 0.0001) {
      activeCamera.alpha = nextAlpha;
    }
    if (Math.abs(currentBeta - nextBeta) > 0.0001) {
      activeCamera.beta = nextBeta;
    }
    this.syncCamera();
    this.draw();
    onComplete?.();
  }

  private normalizeAngleNear(current: number, target: number) {
    const fullTurn = Math.PI * 2;
    let normalized = target;
    while (normalized - current > Math.PI) {
      normalized -= fullTurn;
    }
    while (normalized - current < -Math.PI) {
      normalized += fullTurn;
    }
    return normalized;
  }

  private clampBeta(beta: number) {
    return Math.min(Math.PI - ViewportGizmoController.BETA_EPSILON, Math.max(ViewportGizmoController.BETA_EPSILON, beta));
  }

  private getDirectionalSnapCandidates() {
    const camera = this.activeCamera;
    if (!camera) {
      return [];
    }

    const projectionMatrix = camera.getViewMatrix();
    const candidates: DirectionalSnapCandidate[] = [];
    for (const x of [-1, 0, 1] as const) {
      for (const y of [-1, 0, 1] as const) {
        for (const z of [-1, 0, 1] as const) {
          if (x === 0 && y === 0 && z === 0) {
            continue;
          }
          const nonZeroAxisCount = Number(x !== 0) + Number(y !== 0) + Number(z !== 0);
          if (nonZeroAxisCount < 2) {
            continue;
          }

          const direction = new Vector3(x, y, z).normalize();
          const projected = Vector3.TransformNormal(direction, projectionMatrix);
          const projectedDirection = new Vector2(projected.x, -projected.y);
          const projectedLength = projectedDirection.length();
          if (projectedLength < 0.001) {
            continue;
          }

          candidates.push({
            direction,
            flashAxes: this.getFlashAxesForDirection(x, y, z),
            projectedDirection: projectedDirection.scale(1 / projectedLength),
          });
        }
      }
    }
    return candidates;
  }

  private getFlashAxesForDirection(x: number, y: number, z: number): BubbleAxisTarget[] {
    const flashAxes: BubbleAxisTarget[] = [];
    if (x !== 0) {
      flashAxes.push(x > 0 ? "x" : "-x");
    }
    if (y !== 0) {
      flashAxes.push(y > 0 ? "y" : "-y");
    }
    if (z !== 0) {
      flashAxes.push(z > 0 ? "z" : "-z");
    }
    return flashAxes;
  }

  private flashAxes(axes: BubbleAxisTarget[]) {
    this.flashAxisSet = new Set(axes);
    if (this.flashAxisTimeoutId !== null) {
      window.clearTimeout(this.flashAxisTimeoutId);
    }
    this.draw();
    this.flashAxisTimeoutId = window.setTimeout(() => {
      this.flashAxisSet.clear();
      this.flashAxisTimeoutId = null;
      this.draw();
    }, 220);
  }

  private toColor3(color: Color3Like) {
    if (color instanceof Color3) {
      return color.clone();
    }
    if (typeof color === "string") {
      return Color3.FromHexString(color);
    }
    return new Color3(color.r, color.g, color.b);
  }

  private toColor4(color: Color4Like) {
    if (color instanceof Color4) {
      return color.clone();
    }
    if (typeof color === "string") {
      return Color4.FromHexString(color);
    }
    return new Color4(color.r, color.g, color.b, color.a);
  }
}
