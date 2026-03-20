# Snap Editor

Snap Editor is a browser-based modular scene builder for arranging 3D building pieces, props, and grouped structures on a grid.

It is built with:

- `React`
- `TypeScript`
- `Vite`
- `Babylon.js`

## What It Does

- Browse and place modular assets by category
- Move, rotate, group, ungroup, and nest groups
- Use grid snap and optional Y snap
- Build scenes with clones or instances
- Reorder items in a Scene Tree with drag and drop
- Save to local storage and import/export JSON scene files
- Use transform helpers such as height guides and drop-to-ground

## Project Structure

- [`src/App.tsx`](/c:/Users/Fiolent23/newrepos/snap/src/App.tsx): app wiring
- [`src/editor.ts`](/c:/Users/Fiolent23/newrepos/snap/src/editor.ts): core editor logic
- [`src/components/editor-shell.tsx`](/c:/Users/Fiolent23/newrepos/snap/src/components/editor-shell.tsx): main UI shell
- [`src/editor/scene-core-controller.ts`](/c:/Users/Fiolent23/newrepos/snap/src/editor/scene-core-controller.ts): scene helpers, grid, helper visuals
- [`src/assets.ts`](/c:/Users/Fiolent23/newrepos/snap/src/assets.ts): asset catalog and categories
- [`docs/USER_GUIDE.md`](/c:/Users/Fiolent23/newrepos/snap/docs/USER_GUIDE.md): end-user workflow guide
- [`docs/PREFAB_AND_SOURCE_OF_TRUTH.md`](/c:/Users/Fiolent23/newrepos/snap/docs/PREFAB_AND_SOURCE_OF_TRUTH.md): architecture notes for assets, groups, prefabs, and clone/instance rules

## Getting Started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Run type checking:

```bash
npm run typecheck
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Main Features

- Asset browser with search and category filters
- Placement mode with live preview
- Scene Tree with nested groups
- Multi-selection in the Scene Tree
- Camera-relative `W`, `A`, `S`, `D` nudging aligned to a single world axis
- Per-object and per-group hide/lock state
- User settings for environment, grid, placement kind, and height label mode

## Current Controls

- `Click`: select item or place asset in placement mode
- `Shift + Click` in Scene Tree: select visible range
- `Ctrl + Click` / `Cmd + Click` in Scene Tree: add or remove item from selection
- `W`, `A`, `S`, `D`: move current selection by one step
- `R`: rotate current selection
- `Delete`: delete selected item(s)
- `Shift + D`: duplicate selected object
- `Shift + F`: frame selected item
- `Esc`: cancel placement / return to selection mode
- `Enter`: place current preview asset

## Saving and Loading

- `Save` stores the current scene in local storage
- `Export JSON` writes a scene file
- `Import JSON` loads a scene file
- `Load Last Saved` restores the last local saved snapshot
- Autosave recovery is shown in the scene file menu

## Notes

- The editor currently validates cleanly with `npm run typecheck`.
- The user guide focuses on actual implemented behavior, including current shortcuts and selection rules.

## Debug Flags

To inspect Babylon import-root cleanup for glTF assets, enable the import-root debug flag before loading assets:

```js
localStorage.setItem("snap.debug.importRootCollapse", "1");
location.reload();
```

Or for the current page session only:

```js
window.__snapDebugImportRootCollapse = true;
```

Then inspect:

```js
window.__snapImportRootCollapseStats
```

This shows how many Babylon technical roots like `__root__` were seen, collapsed, or intentionally kept.
