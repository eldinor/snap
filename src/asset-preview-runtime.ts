import "./babylon-bootstrap";
import { FramingBehavior } from "@babylonjs/core/Behaviors/Cameras/framingBehavior";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Cameras/arcRotateCameraInputsManager";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ScreenshotTools } from "@babylonjs/core/Misc/screenshotTools";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

export class AssetPreviewRenderer {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private readonly framingBehavior: FramingBehavior;
  private root: TransformNode | null = null;

  constructor(canvas: HTMLCanvasElement, background: "dark" | "transparent" = "transparent") {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = background === "transparent" ? new Color4(0, 0, 0, 0) : new Color4(0.04, 0.05, 0.06, 1);

    this.camera = new ArcRotateCamera("preview-camera", Math.PI / 3, Math.PI / 2.7, 8, Vector3.Zero(), this.scene);
    this.camera.attachControl(canvas, false);
    this.camera.lowerRadiusLimit = 1;
    this.camera.upperRadiusLimit = 100;
    this.camera.wheelDeltaPercentage = 0.02;
    this.camera.alpha = Math.PI / 3;
    this.camera.beta = Math.PI / 2.55;

    this.framingBehavior = new FramingBehavior();
    this.framingBehavior.framingTime = 0;
    this.framingBehavior.positionScale = 0.5;
    this.framingBehavior.radiusScale = 1.05;
    this.framingBehavior.autoCorrectCameraLimitsAndSensibility = false;
    this.camera.addBehavior(this.framingBehavior);

    const hemi = new HemisphericLight("preview-hemi", new Vector3(0.3, 1, 0.2), this.scene);
    hemi.intensity = 1.1;
    hemi.groundColor = new Color3(0.16, 0.17, 0.19);

    const key = new DirectionalLight("preview-key", new Vector3(-0.5, -1, -0.35), this.scene);
    key.position = new Vector3(6, 10, 6);
    key.intensity = 1.5;

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  async loadAsset(fileName: string, basePath = "/assets/glTF/") {
    this.root?.dispose(false, false);
    const result = await SceneLoader.ImportMeshAsync("", basePath, fileName, this.scene);
    const root = new TransformNode("preview-root", this.scene);

    [...result.transformNodes, ...result.meshes].forEach((node) => {
      if (!node.parent && node !== root) {
        node.parent = root;
      }
    });

    this.root = root;
    this.frameNode(root);
    await this.whenReady();
  }

  async capture(width: number, height: number, samples = 4) {
    await this.whenReady();
    return ScreenshotTools.CreateScreenshotUsingRenderTargetAsync(
      this.engine,
      this.camera,
      { width, height },
      "image/png",
      samples,
      true,
    );
  }

  private frameNode(root: TransformNode) {
    const meshes = root.getChildMeshes();
    if (meshes.length === 0) {
      return;
    }

    this.framingBehavior.stopAllAnimations();
    this.framingBehavior.zoomOnMeshesHierarchy(meshes, false);
  }

  private whenReady() {
    return new Promise<void>((resolve) => {
      this.scene.executeWhenReady(() => resolve());
    });
  }
}
