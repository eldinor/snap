# User Guide

## Overview

Snap Editor is a modular building editor for placing 3D assets into a scene, organizing them in groups, and adjusting them with snapping, transforms, and scene hierarchy tools.

## Layout

The editor is divided into three main areas:

- Left sidebar: asset browser
- Center: 3D viewport
- Right sidebar: Scene Tree and Selection panel

The built-in asset library is defined by [`src/data/libraries/built-in/assets-manifest.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/assets-manifest.json), while the actual model files remain under `public/assets/glTF/`.

The asset browser now has a library selector. At the moment it shows the built-in library, but it is ready for additional registered libraries later.

For the full library lifecycle, see [`docs/LIBRARIES.md`](/c:/Users/Fiolent23/newrepos/snap/docs/LIBRARIES.md).

For the current shortcut list, see [`docs/HOTKEYS.md`](/c:/Users/Fiolent23/newrepos/snap/docs/HOTKEYS.md).

## Asset Library Maintenance

Use [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html) to maintain the built-in asset library.

Important:

- open it through the Vite app server, for example with `npm run dev`
- do not open the HTML file directly from disk

Use the `Library` selector at the top of the studio to choose which registered library you are editing.

After a repo library import, reload the studio page. Imported libraries discovered through `libraries/libraries.json` should then appear in the same selector.

Look at the `Info` panel in the studio when you are unsure what comes next. It now shows:

- `Inspected`
- `Imported`
- `Thumbnails Ready`
- `Promoted`
- `Validation Errors`
- `Validation Warnings`
- `Next`

The `Next` line is the shortest recommended next action for the selected library.

You no longer need a full page reload every time:

- in the main app, use the refresh button next to the `Library` selector
- in the asset library studio, use `Refresh Libraries And Reports`

Use those after import, validation, promotion, or removal commands to rescan library state.

The studio `History` panel shows the latest logged actions for the selected library. After you run one of the repo commands, use refresh and check that the new history entry appears.

Use [`asset-screenshot-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-screenshot-studio.html) to render thumbnails for the currently selected library.

### Before You Start

1. Run `npm run assets:validate`.
2. Open [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html).
3. Keep these two files in mind:
   - [`src/data/libraries/built-in/assets-manifest.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/assets-manifest.json): assets, categories, tags, thumbnails, placeholders
   - [`src/data/libraries/built-in/asset-categories.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-categories.json): category list
   - [`src/data/libraries/built-in/asset-tag-templates.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-tag-templates.json): curated category tag templates

### Clean Up the Asset Manifest

Use the left sidebar first:

- `Search`: find assets by name, file, or tags
- `Category`: narrow the list to one category
- `Show`: focus on:
  - all assets
  - missing tags
  - duplicate names
  - duplicate tags

Use `Filtered Assets` for bulk edits:

- `Set Category`: apply one category to all currently shown assets
- `Add Tag`: add one tag to all currently shown assets

### Create and Remove Categories

Use the `Categories` panel in the studio.

To add a category:

1. Enter the new name in `New Category`.
2. Click `Add`.
3. Save or download the categories JSON.

To remove a category:

1. Move or recategorize any assets that still use it.
2. Choose it in `Existing Category`.
3. Click `Remove Selected Category`.
4. Save or download the categories JSON.

Important:

- a category can only be removed when no assets still use it
- at least one category must remain
- category changes are stored in [`src/data/libraries/built-in/asset-categories.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-categories.json)

Use the selected asset panel for precise edits:

- `Name`
- `Category`
- `Tags`

Check `Validation` on the right:

- warns about empty names
- warns about duplicate names
- warns about duplicate tags
- warns when an asset has no tags

### Normalize Tag Vocabulary

Use `Consistency` on the left to see:

- total unique tags
- singleton tags
- most common tags
- tags that should be reviewed first

Use `Tag Cleanup` when two tags mean the same thing:

1. Choose the old tag in `Replace Tag`.
2. Enter the preferred tag in `With`.
3. Click `Merge`.

This updates all matching assets and removes duplicate tags created by the merge.

### Maintain Category Templates

Category templates are curated tag sets for each asset category.

Use `Category Templates` to:

- choose a category
- edit its curated template tags directly
- save or download template JSON

Use:

- `Promote Selected Tags`: copy tags from the selected asset into the current category template
- `Promote Filtered Tags`: copy tags from all currently shown assets of that category into the current template

Check `Template Validation`:

- warns if the current template is empty
- warns if other categories still have empty templates
- warns when the current template overlaps too much with another category

### Inspect A New GLTF Pack ZIP

The `Pack Import` panel is the current first step for bringing in a new GLTF pack and preparing a draft imported library.

1. Prepare one `.zip` that contains:
   - `.gltf` files
   - any referenced `.bin` files
   - any referenced textures or images
2. Drop the `.zip` onto `Pack Import`.
3. Review the report for each `.gltf`.
4. Fill in:
   - `Draft Library ID`
   - `Draft Library Name`
   - `Default Category`
5. Click `Download Draft Library ZIP`.

The report shows:

- `Missing Sidecars`: files referenced by the `.gltf` that are not present in the zip
- `Parse Errors`: invalid or unreadable `.gltf` JSON
- `External/data URIs`: non-local references that will not import like normal sidecars
- `Name Collisions`: files whose names already exist in the built-in library

Important:

- the inspection step still does not copy files into the repo
- `Download Draft Library ZIP` creates metadata only
- the draft zip contains `library.json`, `assets-manifest.json`, `asset-categories.json`, `asset-tag-templates.json`, and `inspection-report.json`
- only `.gltf` entries without parse errors, missing sidecars, external/data URIs, or file-name collisions are included

### Create The Repo Library Folder

Use the `Repo Import` panel in the studio after you already have:

- the original asset pack zip
- the downloaded draft library zip

Steps:

1. Put the full path to the original asset pack zip into `Asset ZIP Path`.
2. Put the full path to the draft library zip into `Draft ZIP Path`.
3. Click `Copy Command`.
4. Run the copied command from the repo root terminal.

The command looks like:

```powershell
npm run assets:import-library-zip -- "C:\path\to\asset-pack.zip" "C:\path\to\draft-library.zip"
```

That command creates:

- `libraries/<library-id>/library.json`
- `libraries/<library-id>/assets-manifest.json`
- `libraries/<library-id>/asset-categories.json`
- `libraries/<library-id>/asset-tag-templates.json`
- `libraries/<library-id>/inspection-report.json`
- `libraries/<library-id>/glTF/...`
- `libraries/<library-id>/thumbnails/.gitkeep`

Important:

- it imports only the valid assets that were included in the draft manifest
- it preserves the relative glTF sidecar file layout inside `libraries/<library-id>/glTF/`
- it updates `libraries/libraries.json` for imported-library discovery
- reload the app after the import command finishes and the library should appear in the asset browser selector

### Render Thumbnails For A Library

Use [`asset-screenshot-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-screenshot-studio.html).

User path:

1. Reload the page after importing a library.
2. Choose the target library in `Library`.
3. Leave `Source` as `Current library catalog` for the clearest workflow.
4. Click `Pick Project Preview Folder`.
5. Choose the correct output folder:
   - built-in libraries: `public/generated/asset-previews`
   - imported libraries: `libraries/<library-id>/thumbnails`
6. Click `Render Screenshots`.
7. Reload the app or studio page to see the updated thumbnails.

Notes:

- the screenshot studio reads asset files from the selected library's own asset base path
- it writes `.png` files and `asset-preview-relations.json` into the folder you picked
- for imported libraries, the most understandable default is to render directly from the current library catalog

### Promote An Imported Library To Built-In

When an imported library is ready to become part of the built-in app content:

1. Open [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html).
2. Select the imported library in `Library`.
3. In `Promote Library`, copy the generated command.
4. Run it from the repo root terminal.
5. Reload the app and the studio page.

The command looks like:

```powershell
npm run assets:promote-library -- "<library-id>"
```

What it does:

- copies metadata into `src/data/libraries/<library-id>/`
- copies asset files into `public/assets/libraries/<library-id>/glTF/`
- copies thumbnails into `public/generated/asset-previews/<library-id>/`
- updates `src/data/libraries.json`
- updates `libraries/libraries.json`

Why this is useful:

- the library is prepared for source control and future builds
- after reload, the promoted library still remains discoverable in the current app workflow

### Remove A Library

When you want to clean up an imported or promoted library:

1. Open [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html).
2. Select the library in `Library`.
3. In `Remove Library`, copy the generated command.
4. Run it from the repo root terminal.
5. Reload the app and the studio page.

The command looks like:

```powershell
npm run assets:remove-library -- "<library-id>" --delete-files
```

What it removes:

- imported registry entry in `libraries/libraries.json`, when present
- built-in registry entry in `src/data/libraries.json`, when present
- imported library folder `libraries/<library-id>/`
- built-in data folder `src/data/libraries/<library-id>/`
- built-in asset folder `public/assets/libraries/<library-id>/`
- built-in thumbnail folder `public/generated/asset-previews/<library-id>/`

Important:

- the core `built-in` library is protected
- the cleanup command is intentionally explicit and requires `--delete-files`

### Validate A Library

Use `Validate Library` in the studio.

Steps:

1. Select the library in `Library`.
2. Copy the generated validation command.
3. Run it from the repo root terminal.
4. Reload the studio page.

The command looks like:

```powershell
npm run assets:validate-library -- "<library-id>"
```

What it checks:

- manifest structure
- category references
- duplicate ids and file names
- missing `.gltf` files
- missing glTF sidecars like `.bin` and textures
- missing thumbnails

What it writes:

- `public/generated/library-validation/<library-id>.json`

After reload, the studio `Info` panel reads that report and shows the current validation error and warning counts.

### Apply Category Templates Back to Assets

When an asset is selected, the right-side `Category Template` block shows the current category’s template tags.

You can:

- click an individual template tag to append it to the asset
- click `Apply To Selected` to add the whole template to the selected asset
- click `Apply To Filtered` to add the template to all currently shown assets in the same category

### Save Your Changes

When you finish:

1. Save or download the asset manifest.
2. Save or download the categories JSON.
3. Save or download the category templates.
4. Run `npm run assets:validate` again.
5. If thumbnails are missing or outdated, run `npm run assets:thumbnails`.

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

## Debugging Import Root Collapse

If you want to check whether Babylon is creating a technical `__root__` wrapper during glTF import and whether Snap collapses it:

1. Open the browser console.
2. Enable the flag:

```js
localStorage.setItem("snap.debug.importRootCollapse", "1");
location.reload();
```

Or for the current page only:

```js
window.__snapDebugImportRootCollapse = true;
```

3. Load one or more assets.
4. Inspect:

```js
window.__snapImportRootCollapseStats
```

This debug object reports:

- how many technical import roots were seen
- how many were collapsed
- how many were kept because flattening would change the final transform
