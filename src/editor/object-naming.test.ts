import { describe, expect, it } from "vitest";
import {
  createSequentialSceneObjectName,
  deriveSceneObjectNameBase,
  normalizeSceneObjectName,
  splitSceneObjectName,
  stripLegacyCopySuffixes,
} from "./object-naming";

describe("object naming", () => {
  it("strips repeated legacy Copy suffixes", () => {
    expect(stripLegacyCopySuffixes("Wall Uneven Brick Straight 17 Copy Copy Copy")).toBe(
      "Wall Uneven Brick Straight 17",
    );
  });

  it("splits a clean scene object name into base and index", () => {
    expect(splitSceneObjectName("Wall Uneven Brick Straight 17")).toEqual({
      base: "Wall Uneven Brick Straight",
      index: 17,
    });
  });

  it("keeps asset numbers that are part of the base name", () => {
    expect(splitSceneObjectName("Roof Round Tiles 6x8 3")).toEqual({
      base: "Roof Round Tiles 6x8",
      index: 3,
    });
  });

  it("derives a duplicate base from legacy copied names", () => {
    expect(
      deriveSceneObjectNameBase(
        "Wall Uneven Brick Straight 17 Copy Copy Copy",
        "Wall Uneven Brick Straight",
      ),
    ).toBe("Wall Uneven Brick Straight");
  });

  it("normalizes a legacy copied scene object name for export/display cleanup", () => {
    expect(
      normalizeSceneObjectName(
        "Wall Uneven Brick Straight 17 Copy Copy Copy Copy Copy",
        "Wall Uneven Brick Straight",
      ),
    ).toBe("Wall Uneven Brick Straight 17");
  });

  it("creates the next clean sequential name for default asset names", () => {
    expect(
      createSequentialSceneObjectName("Wall Uneven Brick Straight", [
        "Wall Uneven Brick Straight 1",
        "Wall Uneven Brick Straight 2",
      ]),
    ).toBe("Wall Uneven Brick Straight 3");
  });

  it("creates the next clean sequential name for custom duplicated names", () => {
    expect(createSequentialSceneObjectName("Kitchen Wall", ["Kitchen Wall", "Kitchen Wall 2"])).toBe(
      "Kitchen Wall 3",
    );
  });
});
