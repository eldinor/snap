# Modular GLTF Snapping Editor --- Instructions for AI Agent

## Goal

Build a minimal 3D placement editor for modular GLTF assets that snap
together (e.g., modular tiles such as floors, walls, props).

Focus on **fast placement**, **grid snapping**, and **predictable
alignment**.

------------------------------------------------------------------------

# UI Layout

## 1. Asset Picker (Left Panel)

Displays all available GLTF models.

Structure example:

-   Floors
-   Walls
-   Corners
-   Doors
-   Props
-   Decorations

Behavior: - Click asset → enter placement mode - Drag asset → start
placement

------------------------------------------------------------------------

## 2. Placement Preview (Ghost Mode)

When an asset is selected:

-   A **semi‑transparent preview mesh** follows the cursor
-   Preview **snaps to the grid**
-   Click → place object

Visual hints: - Green → valid placement - Red → invalid placement
(optional later)

------------------------------------------------------------------------

## 3. Snap Controls (Top Toolbar)

Controls:

-   Snap toggle (ON/OFF)
-   Grid size selector
-   Rotation snap selector

Grid sizes:

-   2
-   1
-   0.5
-   0.25
-   0.125

Rotation snap:

-   90° (default)
-   45°
-   15°

------------------------------------------------------------------------

## 4. Transform Gizmo

When object is selected:

Allow manipulation using a 3D transform gizmo.

Capabilities:

-   Move (snapped to grid)
-   Rotate (snapped to angle step)
-   Scale (optional, usually disabled for modular tiles)

------------------------------------------------------------------------

## 5. Keyboard Shortcuts

Recommended shortcuts:

-   **R** → rotate 90°
-   **Delete** → remove selected object
-   **Esc** → cancel placement mode

Typical workflow:

Select asset → move cursor → rotate if needed → click place.

------------------------------------------------------------------------

## 6. Visual Grid

Display a visible floor grid to indicate snapping positions.

Grid cell sizes correspond to selected snap value.

Purpose: - Make snapping predictable - Improve spatial understanding

------------------------------------------------------------------------

# Snapping System Design

## Important Rule

Use **bounding‑box based snapping**, not pivot snapping.

### Why

GLTF assets often have inconsistent pivots.

Bounding box snapping uses the real visible size of the asset.

Benefits:

-   More reliable alignment
-   Works with mixed asset sets
-   Compatible with modular tile packs (e.g., Quaternius‑style assets)

------------------------------------------------------------------------

## Snapping Behavior

Position snapping:

snap_position = round(position / grid_size) \* grid_size

Rotation snapping:

snap_rotation = round(rotation / rotation_step) \* rotation_step

------------------------------------------------------------------------

# Minimal Editor Workflow

1.  Select asset from library
2.  Enter placement mode
3.  Preview mesh follows cursor
4.  Snap to grid
5.  Rotate if needed
6.  Click to place object

Example flow:

Select asset → move → rotate → click → repeat.

------------------------------------------------------------------------

# Optional Future Improvements

Not required initially:

-   Magnet snapping (edge‑to‑edge snapping)
-   Surface snapping
-   Anchor points
-   Collision validation
-   Tile painting mode

These can be added later.

------------------------------------------------------------------------

# Summary

The editor should prioritize:

-   simplicity
-   predictable snapping
-   fast placement workflow

Core system components:

-   Asset picker
-   Placement preview
-   Grid snapping
-   Rotation snapping
-   Transform gizmo
-   Keyboard shortcuts
