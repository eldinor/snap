# User Guide

## Overview

Snap Editor is a modular building editor for placing 3D assets into a scene, organizing them in groups, and adjusting them with snapping, transforms, and scene hierarchy tools.

## Layout

The editor is divided into three main areas:

- Left sidebar: asset browser
- Center: 3D viewport
- Right sidebar: Scene Tree and Selection panel

## Asset Placement

1. Choose an asset from the left sidebar.
2. The editor enters placement mode.
3. Move the mouse over the ground to position the preview.
4. Left click or press `Enter` to place the asset.
5. Press `Esc` to cancel placement.

Notes:

- Right click is reserved for camera interaction and does not place assets.
- New objects can default to `Instance` or `Clone` from User Settings.

## Selection

### Single Selection

- Click an object in the viewport to select it.
- Click an item in the Scene Tree to select it.

### Multi-Selection in Scene Tree

- `Click`: replace current selection
- `Ctrl + Click` / `Cmd + Click`: add or remove one item
- `Shift + Click`: select a visible range

Notes:

- Multi-selection currently works from the Scene Tree.
- A primary selected item is still used for gizmo attachment and detailed transforms.

## Moving and Rotating

### Gizmo

- Select an object or group to show its gizmo.
- Use the position gizmo to move it.
- Use the rotation gizmo to rotate it around Y.

### Keyboard Movement

- `W`: move selection forward relative to the current camera view
- `S`: move selection backward relative to the current camera view
- `A`: move selection left
- `D`: move selection right

Important:

- Movement resolves to a single world axis so items stay aligned to the grid.
- When snap is on, movement uses the current grid size.
- When snap is off, movement uses a smaller step.

### Rotation

- `R`: rotate the current selection by the current rotation step

## Snapping

Toolbar controls:

- `Snap`: enables grid-aligned movement and rotation
- `Y Snap`: enables vertical snapping to the current grid size
- `Grid`: sets the snap step
- `Rotate`: sets the rotation increment

## Height Helper

When a selected object or group is above the ground:

- a vertical helper line is shown
- a ground marker is shown below it
- a height label is shown next to it

User Settings include:

- `Height Label: Transform Y`
- `Height Label: Geometry Bottom`

Use `Transform Y` if you want values like `1.00u`, `2.00u`, and so on when Y snap is active.

## Scene Tree

The Scene Tree shows:

- objects
- groups
- nested groups
- child counts on groups
- lock and hidden state labels

### Group Actions

- `Create Empty Group`: creates a group at `0,0,0`
- `Group Selected`: groups the selected top-level items
- collapse button: hide or show group children
- drag and drop: reorder items or move them into groups

### Drag and Drop Feedback

- blue hint: drop before item
- green hint: drop into group

### Group Behavior

- groups can contain objects and other groups
- empty groups stay in the tree
- child groups can be removed from their parent group

## Selection Panel

### Single Selection

For a single selected object or group, the panel shows:

- position fields
- Y rotation field
- snap info
- `Drop To Ground`

### Multi-Selection

For multi-selection, the panel shows batch actions:

- `Group Selected`
- `Hide Selected` / `Show Selected`
- `Lock Selected` / `Unlock Selected`

## Hide and Lock

Objects and groups can both be hidden or locked.

Important behavior:

- group hide applies to all descendants
- group lock applies to all descendants
- hidden or locked descendants may not attach a gizmo

Scene Tree meta labels:

- `Locked`
- `Hidden`

## Framing

- `Shift + F`: frame the current selection
- Scene Tree frame action: frame an item from the tree

Framing keeps the current camera angle and adjusts target and distance.

## Save, Load, Export

Scene file controls are grouped in the toolbar:

- `Save`: save to local storage
- `Export JSON`
- `Import JSON`
- `Load Last Saved`

The editor also tracks autosave recovery.

## User Settings

Current settings include:

- environment lighting
- environment intensity
- light intensity
- grid visibility
- grid color
- ground color
- new object mode: `Instance` or `Clone`
- height label mode

## Useful Shortcuts

- `W`, `A`, `S`, `D`: move selection
- `R`: rotate selection
- `Delete`: delete selection
- `Shift + D`: duplicate selected object
- `Shift + F`: frame selection
- `Esc`: cancel placement
- `Enter`: place current preview asset

## Known Current Behavior

- Multi-selection is centered around Scene Tree workflows.
- Batch transforms are not yet fully exposed as shared numeric transform editing.
- The primary selected item is still used for gizmo attachment.

