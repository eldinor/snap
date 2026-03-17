export const GRID_SIZES = [2, 1, 0.5, 0.25, 0.125] as const;
export const ROTATION_STEPS = [90, 45, 15] as const;

export const ASSET_CATEGORIES = [
  "Floors",
  "Walls",
  "Corners",
  "Doors",
  "Windows",
  "Roofs",
  "Stairs",
  "Props",
  "Balconies",
  "Decorations",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export type PlaceholderShape = "box" | "column";

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  fileName: string;
  tags: string[];
  placeholder: {
    shape: PlaceholderShape;
    size: [number, number, number];
    color: string;
  };
}

const ASSET_FILES = [
  "Balcony_Cross_Corner",
  "Balcony_Cross_Straight",
  "Balcony_Simple_Corner",
  "Balcony_Simple_Straight",
  "Corner_ExteriorWide_Brick",
  "Corner_ExteriorWide_Wood",
  "Corner_Exterior_Brick",
  "Corner_Exterior_TopDown",
  "Corner_Exterior_TopOnly",
  "Corner_Exterior_Wood",
  "Corner_Interior_Big",
  "Corner_Interior_Small",
  "DoorFrame_Flat_Brick",
  "DoorFrame_Flat_WoodDark",
  "DoorFrame_Round_Brick",
  "DoorFrame_Round_WoodDark",
  "Door_1_Flat",
  "Door_1_Round",
  "Door_2_Flat",
  "Door_2_Round",
  "Door_4_Flat",
  "Door_4_Round",
  "Door_8_Flat",
  "Door_8_Round",
  "Floor_Brick",
  "Floor_RedBrick",
  "Floor_UnevenBrick",
  "Floor_WoodDark",
  "Floor_WoodDark_Half1",
  "Floor_WoodDark_Half2",
  "Floor_WoodDark_Half3",
  "Floor_WoodDark_OverhangCorner",
  "Floor_WoodDark_OverhangCorner2",
  "Floor_WoodLight",
  "Floor_WoodLight_OverhangCorner",
  "Floor_WoodLight_OverhangCorner2",
  "HoleCover_90Angle",
  "HoleCover_90Half",
  "HoleCover_90Stairs",
  "HoleCover_Straight",
  "HoleCover_StraightHalf",
  "Overhang_Plaster_Corner",
  "Overhang_Plaster_Corner_Front",
  "Overhang_Plaster_Long",
  "Overhang_Plaster_Short",
  "Overhang_RoofIncline_Plaster",
  "Overhang_RoofIncline_UnevenBricks",
  "Overhang_Roof_Plaster",
  "Overhang_Roof_UnevenBricks",
  "Overhang_Side_Plaster_Long_L",
  "Overhang_Side_Plaster_Long_R",
  "Overhang_Side_Plaster_Short_L",
  "Overhang_Side_Plaster_Short_R",
  "Overhang_Side_UnevenBrick_Long_L",
  "Overhang_Side_UnevenBrick_Long_R",
  "Overhang_Side_UnevenBrick_Short_L",
  "Overhang_Side_UnevenBrick_Short_R",
  "Overhang_UnevenBrick_Corner",
  "Overhang_UnevenBrick_Corner_Front",
  "Overhang_UnevenBrick_Long",
  "Overhang_UnevenBrick_Short",
  "Prop_Brick1",
  "Prop_Brick2",
  "Prop_Brick3",
  "Prop_Brick4",
  "Prop_Chimney",
  "Prop_Chimney2",
  "Prop_Crate",
  "Prop_ExteriorBorder_Corner",
  "Prop_ExteriorBorder_Straight1",
  "Prop_ExteriorBorder_Straight2",
  "Prop_MetalFence_Ornament",
  "Prop_MetalFence_Simple",
  "Prop_Support",
  "Prop_Vine1",
  "Prop_Vine2",
  "Prop_Vine4",
  "Prop_Vine5",
  "Prop_Vine6",
  "Prop_Vine9",
  "Prop_Wagon",
  "Prop_WoodenFence_Extension1",
  "Prop_WoodenFence_Extension2",
  "Prop_WoodenFence_Single",
  "Roof_2x4_RoundTile",
  "Roof_Dormer_RoundTile",
  "Roof_FrontSupports",
  "Roof_Front_Brick2",
  "Roof_Front_Brick4",
  "Roof_Front_Brick4_Half_L",
  "Roof_Front_Brick4_Half_R",
  "Roof_Front_Brick6",
  "Roof_Front_Brick6_Half_L",
  "Roof_Front_Brick6_Half_R",
  "Roof_Front_Brick8",
  "Roof_Front_Brick8_Half_L",
  "Roof_Front_Brick8_Half_R",
  "Roof_Log",
  "Roof_Modular_RoundTiles",
  "Roof_RoundTiles_4x4",
  "Roof_RoundTiles_4x6",
  "Roof_RoundTiles_4x8",
  "Roof_RoundTiles_6x10",
  "Roof_RoundTiles_6x12",
  "Roof_RoundTiles_6x14",
  "Roof_RoundTiles_6x4",
  "Roof_RoundTiles_6x6",
  "Roof_RoundTiles_6x8",
  "Roof_RoundTiles_8x10",
  "Roof_RoundTiles_8x12",
  "Roof_RoundTiles_8x14",
  "Roof_RoundTiles_8x8",
  "Roof_RoundTile_2x1",
  "Roof_RoundTile_2x1_Long",
  "Roof_Support2",
  "Roof_Tower_RoundTiles",
  "Roof_Wooden_2x1",
  "Roof_Wooden_2x1_Center",
  "Roof_Wooden_2x1_Center_Mirror",
  "Roof_Wooden_2x1_Corner",
  "Roof_Wooden_2x1_L",
  "Roof_Wooden_2x1_Middle",
  "Roof_Wooden_2x1_R",
  "Stairs_Exterior_NoFirstStep",
  "Stairs_Exterior_Platform",
  "Stairs_Exterior_Platform45",
  "Stairs_Exterior_Platform45Clean",
  "Stairs_Exterior_PlatformU",
  "Stairs_Exterior_SidePlatform",
  "Stairs_Exterior_Sides",
  "Stairs_Exterior_Sides45",
  "Stairs_Exterior_SidesU",
  "Stairs_Exterior_SingleSide",
  "Stairs_Exterior_SingleSideThick",
  "Stairs_Exterior_Straight",
  "Stairs_Exterior_Straight_Center",
  "Stairs_Exterior_Straight_L",
  "Stairs_Exterior_Straight_R",
  "Stair_Interior_Rails",
  "Stair_Interior_Simple",
  "Stair_Interior_Solid",
  "Stair_Interior_SolidExtended",
  "Wall_Arch",
  "Wall_BottomCover",
  "Wall_Plaster_Door_Flat",
  "Wall_Plaster_Door_Round",
  "Wall_Plaster_Door_RoundInset",
  "Wall_Plaster_Straight",
  "Wall_Plaster_Straight_Base",
  "Wall_Plaster_Straight_L",
  "Wall_Plaster_Straight_R",
  "Wall_Plaster_Window_Thin_Round",
  "Wall_Plaster_Window_Wide_Flat",
  "Wall_Plaster_Window_Wide_Flat2",
  "Wall_Plaster_Window_Wide_Round",
  "Wall_Plaster_WoodGrid",
  "Wall_UnevenBrick_Door_Flat",
  "Wall_UnevenBrick_Door_Round",
  "Wall_UnevenBrick_Straight",
  "Wall_UnevenBrick_Window_Thin_Round",
  "Wall_UnevenBrick_Window_Wide_Flat",
  "Wall_UnevenBrick_Window_Wide_Round",
  "WindowShutters_Thin_Flat_Closed",
  "WindowShutters_Thin_Flat_Open",
  "WindowShutters_Thin_Round_Closed",
  "WindowShutters_Thin_Round_Open",
  "WindowShutters_Wide_Flat_Closed",
  "WindowShutters_Wide_Flat_Open",
  "WindowShutters_Wide_Round_Closed",
  "WindowShutters_Wide_Round_Open",
  "Window_Roof_Thin",
  "Window_Roof_Wide",
  "Window_Thin_Flat1",
  "Window_Thin_Round1",
  "Window_Wide_Flat1",
  "Window_Wide_Round1",
] as const;

const CATEGORY_ORDER = new Map<AssetCategory, number>(
  ASSET_CATEGORIES.map((category, index) => [category, index]),
);

const TOKEN_SPLIT_PATTERN = /(?=[A-Z][a-z])|_|(?<=\d)(?=[A-Za-z])|(?<=[A-Za-z])(?=\d)/g;

function detectCategory(file: string): AssetCategory {
  if (file.startsWith("Floor_") || file.startsWith("HoleCover_")) {
    return "Floors";
  }
  if (file.startsWith("Wall_")) {
    return "Walls";
  }
  if (file.startsWith("Corner_")) {
    return "Corners";
  }
  if (file.startsWith("Door") || file.startsWith("DoorFrame_")) {
    return "Doors";
  }
  if (file.startsWith("Window") || file.startsWith("WindowShutters_")) {
    return "Windows";
  }
  if (file.startsWith("Roof_") || file.startsWith("Overhang_")) {
    return "Roofs";
  }
  if (file.startsWith("Stair_") || file.startsWith("Stairs_")) {
    return "Stairs";
  }
  if (file.startsWith("Prop_")) {
    return "Props";
  }
  if (file.startsWith("Balcony_")) {
    return "Balconies";
  }
  return "Decorations";
}

function splitFileTokens(file: string) {
  return file
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter(Boolean);
}

function toLabel(file: string) {
  return splitFileTokens(file)
    .map((token) => {
      if (/^\d+x\d+$/i.test(token)) {
        return token.toLowerCase();
      }
      if (/^\d+$/.test(token)) {
        return token;
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function toSlug(file: string) {
  return splitFileTokens(file)
    .map((token) => token.toLowerCase())
    .join("-");
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function toTags(file: string, category: AssetCategory) {
  const parts = splitFileTokens(file).map((token) => token.toLowerCase());
  const expanded = parts.flatMap((token) => {
    if (token === "wooddark") {
      return ["wood", "dark"];
    }
    if (token === "woodlight") {
      return ["wood", "light"];
    }
    if (token === "redbrick") {
      return ["red", "brick"];
    }
    if (token === "unevenbrick" || token === "unevenbricks") {
      return ["uneven", "brick"];
    }
    if (token === "roundtiles") {
      return ["round", "tiles"];
    }
    if (token === "roundtile") {
      return ["round", "tile"];
    }
    if (token === "wide" || token === "thin" || token === "flat" || token === "round") {
      return [token];
    }
    if (token === "l" || token === "r" || token === "u") {
      return [token];
    }
    if (token === "doorframe") {
      return ["door", "frame"];
    }
    if (token === "windowshutters") {
      return ["window", "shutters"];
    }
    if (token === "exteriorwide") {
      return ["exterior", "wide"];
    }
    if (token === "singleside") {
      return ["single", "side"];
    }
    if (token === "sideplatform") {
      return ["side", "platform"];
    }
    if (token === "nofirststep") {
      return ["no", "first", "step"];
    }
    if (token === "solidextended") {
      return ["solid", "extended"];
    }
    if (token === "roundinset") {
      return ["round", "inset"];
    }
    return [token];
  });

  return dedupe([category.toLowerCase(), ...expanded]);
}

function placeholderFor(category: AssetCategory, tags: string[]): AssetDefinition["placeholder"] {
  if (category === "Walls" || category === "Doors" || category === "Windows") {
    return {
      shape: "box",
      size: [2, 2.5, 0.25],
      color: category === "Doors" ? "#a1887f" : "#8d6e63",
    };
  }

  if (category === "Floors") {
    return { shape: "box", size: [2, 0.2, 2], color: "#546e7a" };
  }

  if (category === "Corners") {
    return { shape: "box", size: [1.4, 2.4, 1.4], color: "#795548" };
  }

  if (category === "Roofs") {
    return { shape: "box", size: [2.2, 0.6, 2.2], color: "#5d4037" };
  }

  if (category === "Stairs") {
    return { shape: "box", size: [2, 1.4, 2], color: "#7b8d93" };
  }

  if (category === "Balconies") {
    return { shape: "box", size: [2, 1.2, 1], color: "#607d8b" };
  }

  if (tags.includes("vine")) {
    return { shape: "column", size: [0.5, 1.8, 0.5], color: "#689f38" };
  }

  return { shape: "box", size: [1, 1, 1], color: "#8bc34a" };
}

export const ASSETS: AssetDefinition[] = ASSET_FILES.map((file) => {
  const category = detectCategory(file);
  const tags = toTags(file, category);

  return {
    id: toSlug(file),
    name: toLabel(file),
    category,
    fileName: `${file}.gltf`,
    tags,
    placeholder: placeholderFor(category, tags),
  };
}).sort((left, right) => {
  const categoryDelta = (CATEGORY_ORDER.get(left.category) ?? 0) - (CATEGORY_ORDER.get(right.category) ?? 0);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }
  return left.name.localeCompare(right.name);
});
