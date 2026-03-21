import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { afterEach, describe, expect, it } from "vitest";
import { collapseRedundantImportRoot } from "./import-root-collapse";

function roundedMatrixValues(node: TransformNode) {
  return node
    .computeWorldMatrix(true)
    .toArray()
    .map((value) => Number(value.toFixed(5)));
}

describe("collapseRedundantImportRoot", () => {
  const engines: NullEngine[] = [];

  afterEach(() => {
    while (engines.length > 0) {
      engines.pop()?.dispose();
    }
  });

  it("collapses a single-child technical wrapper and preserves world transform", () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const templateRoot = new TransformNode("template-root", scene);
    const wrapper = new TransformNode("__root__", scene);
    wrapper.position.set(2, 3, 4);
    wrapper.rotation.y = Math.PI / 4;
    wrapper.scaling.set(1, 1, 1);

    const child = MeshBuilder.CreateBox("child-mesh", { size: 1 }, scene);
    child.parent = wrapper;
    child.position.set(1, 0.5, -2);
    child.rotation.y = Math.PI / 6;
    child.scaling.set(1, 1.25, 1);

    const before = roundedMatrixValues(child);
    const collapsedChild = collapseRedundantImportRoot(wrapper, templateRoot);

    expect(collapsedChild).toBe(child);
    expect(child.parent).toBe(templateRoot);
    expect(wrapper.isDisposed()).toBe(true);
    expect(roundedMatrixValues(child)).toEqual(before);
  });

  it("does not collapse a non-technical root wrapper", () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const templateRoot = new TransformNode("template-root", scene);
    const wrapper = new TransformNode("HouseRoot", scene);
    const child = MeshBuilder.CreateBox("child-mesh", { size: 1 }, scene);
    child.parent = wrapper;

    const result = collapseRedundantImportRoot(wrapper, templateRoot);

    expect(result).toBeNull();
    expect(child.parent).toBe(wrapper);
    expect(wrapper.isDisposed()).toBe(false);
  });

  it("keeps a technical wrapper when flattening would change the child world transform", () => {
    const engine = new NullEngine();
    engines.push(engine);
    const scene = new Scene(engine);
    const templateRoot = new TransformNode("template-root", scene);
    const wrapper = new TransformNode("__root__", scene);
    wrapper.position.set(2, 3, 4);
    wrapper.rotation.y = Math.PI / 4;
    wrapper.scaling.set(1.5, 2, 0.5);

    const child = MeshBuilder.CreateBox("child-mesh", { size: 1 }, scene);
    child.parent = wrapper;
    child.position.set(1, 0.5, -2);
    child.rotation.y = Math.PI / 6;
    child.scaling.set(0.75, 1.25, 1.5);
    const before = roundedMatrixValues(child);

    const result = collapseRedundantImportRoot(wrapper, templateRoot);

    expect(result).toBeNull();
    expect(child.parent).toBe(wrapper);
    expect(wrapper.isDisposed()).toBe(false);
    expect(roundedMatrixValues(child)).toEqual(before);
  });
});
