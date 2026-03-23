# Snap Editor

Snap Editor is a browser-based modular scene builder for arranging 3D building pieces, props, and grouped structures on a grid.

Current library names in this repo are temporary testing names. Expect those asset-library names and labels to change in the future as the real content lineup settles.

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
- [`src/data/libraries.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries.json): built-in library registry
- [`src/data/libraries/built-in/library.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/library.json): built-in library metadata
- [`src/data/libraries/built-in/assets-manifest.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/assets-manifest.json): built-in asset library manifest
- [`src/data/libraries/built-in/asset-categories.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-categories.json): built-in asset categories
- [`src/data/libraries/built-in/asset-tag-templates.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-tag-templates.json): curated category tag templates for library cleanup
- [`docs/USER_GUIDE.md`](/c:/Users/Fiolent23/newrepos/snap/docs/USER_GUIDE.md): end-user workflow guide
- [`docs/HOTKEYS.md`](/c:/Users/Fiolent23/newrepos/snap/docs/HOTKEYS.md): current editor shortcuts
- [`docs/LIBRARIES.md`](/c:/Users/Fiolent23/newrepos/snap/docs/LIBRARIES.md): multi-library import, validation, thumbnails, promotion, and removal
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

Exclude the optional second built-in library from a run or build:

```bash
VITE_INCLUDE_FANTASY_PROPS_MEGAKIT_STANDARD=false npm run dev
```

Run type checking:

```bash
npm run typecheck
```

Validate the built-in asset library:

```bash
npm run assets:validate
```

Validate one library and write a report for the studio:

```bash
npm run assets:validate-library -- "<library-id>"
```

Regenerate the built-in asset manifest from `public/assets/glTF`:

```bash
npm run assets:regenerate
```

Prepare the screenshot queue manifest for thumbnail regeneration:

```bash
npm run assets:thumbnails
```

Import a draft library ZIP plus its source asset ZIP into `libraries/<library-id>/`:

```bash
npm run assets:import-library-zip -- "C:\\path\\to\\asset-pack.zip" "C:\\path\\to\\draft-library.zip"
```

Promote an imported library into the built-in source structure:

```bash
npm run assets:promote-library -- "<library-id>"
```

Remove a library and its repo files:

```bash
npm run assets:remove-library -- "<library-id>" --delete-files
```

Open the built-in asset metadata editor:

- [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html)

Open the screenshot studio:

- [`asset-screenshot-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-screenshot-studio.html)

Important:

- open studio pages through `npm run dev` or `npm run preview`
- do not open the HTML files directly from disk, because their TypeScript entry modules must be served by Vite

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
- Asset browser library selector driven by the library registry
- Placement mode with live preview
- Scene Tree with nested groups
- Multi-selection in the Scene Tree
- Camera-relative `W`, `A`, `S`, `D` nudging aligned to a single world axis
- Per-object and per-group hide/lock state
- User settings for environment, grid, placement kind, and height label mode

## Built-In Asset Library

The built-in asset browser is now manifest-driven.

Note:

- the currently registered library names are testing names
- those names should not be treated as stable product-facing names
- expect them to change as the asset libraries are refined

- [`src/data/libraries.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries.json) registers the built-in libraries available to the app
- [`src/data/libraries/built-in/library.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/library.json) describes the built-in library and its file layout
- [`src/data/libraries/built-in/assets-manifest.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/assets-manifest.json) is the source of truth for built-in library entries
- [`src/data/libraries/built-in/asset-categories.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-categories.json) stores the category list used across the app and library tools
- [`src/data/libraries/built-in/asset-tag-templates.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-tag-templates.json) stores curated category-level tag templates used by the asset library studio
- [`src/assets.ts`](/c:/Users/Fiolent23/newrepos/snap/src/assets.ts) now provides shared types/constants plus manifest validation
- asset files still live under `public/assets/glTF/`
- thumbnails still live under `public/generated/asset-previews/`
- [`scripts/asset-library.mjs`](/c:/Users/Fiolent23/newrepos/snap/scripts/asset-library.mjs) validates or regenerates the manifest
- `npm run assets:thumbnails` writes `public/generated/asset-screenshot-manifest.json` for the screenshot studio
- [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html) lets you edit built-in asset names, categories, tags, and curated category templates
- [`asset-screenshot-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-screenshot-studio.html) can now render screenshots for the currently selected library

For the full multi-library workflow, see [`docs/LIBRARIES.md`](/c:/Users/Fiolent23/newrepos/snap/docs/LIBRARIES.md).

The asset browser library selector is registry-backed and includes the core `built-in` library plus the optional `fantasy-props-megakit-standard` built-in library by default.

Those labels reflect the current testing asset libraries only and may change later.

Set `VITE_INCLUDE_FANTASY_PROPS_MEGAKIT_STANDARD=false` to exclude that second built-in library from the app and studio at build time.

### Asset Library Studio Workflow

Open [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html) when you want to curate the built-in library.

The studio now has its own `Library` selector, so you can manage the currently selected registered library independently.

After you import a repo library and reload the studio page, imported libraries discovered from `libraries/libraries.json` should also appear in that selector.

The `Info` panel now also shows a simple lifecycle summary for the selected library:

- `Inspected`
- `Imported`
- `Thumbnails Ready`
- `Promoted`
- `Validation Errors`
- `Validation Warnings`
- `Next`

Use that `Next` line as the fastest guide for what to do next in the workflow.

You can now use refresh actions instead of full page reloads:

- in the main app asset sidebar, use the refresh button next to `Library`
- in the asset library studio, use `Refresh Libraries And Reports`

The studio also has a `History` panel now. After you run import, validate, promote, or remove commands, use refresh and the latest entry should appear there for the selected library.

Recommended workflow:

1. Use `Search`, `Category`, and `Show` to narrow the list.
2. Use `Filtered Assets` to fix batches:
   - `Set Category` changes all currently shown assets.
   - `Add Tag` appends one tag to all currently shown assets.
   - `Show` can isolate missing tags, duplicate names, or duplicate tags.
3. Select one asset to review the right-side metadata panel:
   - edit `Name`
   - edit `Category`
   - edit `Tags`
   - review the `Validation` box for missing or duplicate metadata
4. Check `Consistency` on the left:
   - `Top Tags` shows the most common vocabulary
   - `Review First` highlights singleton tags that may indicate wording drift
5. Use `Tag Cleanup` to merge old or inconsistent tags into one preferred tag across the full library.
6. Use `Categories` to maintain the category list:
   - add a new category with `New Category`
   - remove a category only after no assets still use it
   - `Save Categories` or `Download JSON` for [`src/data/libraries/built-in/asset-categories.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-categories.json)
7. Use `Category Templates` to maintain curated per-category tags:
   - edit the template tags directly
   - `Promote Selected Tags` copies good tags from the current asset into the active category template
   - `Promote Filtered Tags` grows the current template from all shown assets in that category
8. In the selected asset panel, use `Category Template` to apply common category tags to the selected asset or to the current filtered asset set.
9. Save your results:
   - `Save Manifest` or `Download JSON` for [`src/data/libraries/built-in/assets-manifest.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/assets-manifest.json)
   - `Save Categories` or `Download JSON` for [`src/data/libraries/built-in/asset-categories.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-categories.json)
   - `Save Templates` or `Download JSON` for [`src/data/libraries/built-in/asset-tag-templates.json`](/c:/Users/Fiolent23/newrepos/snap/src/data/libraries/built-in/asset-tag-templates.json)

### GLTF Pack ZIP Inspection And Draft Library Metadata

The asset library studio now includes an inspection-first step for future pack import work.

Use `Pack Import` to:

1. drop a `.zip` containing `.gltf` files and their sidecars
2. inspect how each `.gltf` resolves relative `buffer` and `image` paths inside the archive
3. fill in:
   - `Draft Library ID`
   - `Draft Library Name`
   - `Default Category`
4. download a draft imported-library zip that contains:
   - `library.json`
   - `assets-manifest.json`
   - `asset-categories.json`
   - `asset-tag-templates.json`
   - `inspection-report.json`
5. review:
   - missing sidecar files
   - parse errors
   - external or data URIs
   - file-name collisions with the current built-in library

Important:

- the downloaded draft zip is metadata only
- it does not copy source `.gltf`, `.bin`, or texture files yet
- it is meant to become the starting point for a future imported library
- only fully valid `.gltf` entries are included in the draft manifest

### Repo Import Command

The studio also includes a `Repo Import` panel.

Use it to:

1. paste the original asset ZIP path
2. paste the downloaded draft ZIP path
3. copy the generated `npm run assets:import-library-zip` command

That script creates:

- `libraries/<library-id>/library.json`
- `libraries/<library-id>/assets-manifest.json`
- `libraries/<library-id>/asset-categories.json`
- `libraries/<library-id>/asset-tag-templates.json`
- `libraries/<library-id>/inspection-report.json`
- `libraries/<library-id>/glTF/...`
- `libraries/<library-id>/thumbnails/.gitkeep`

Important:

- this creates the imported library folder in the repo
- it also updates `libraries/libraries.json` so the app can discover the imported library
- reload the app after import and the library should appear in the asset browser selector
- thumbnail generation for imported libraries is still a later step

### Screenshot Workflow Per Library

Use [`asset-screenshot-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-screenshot-studio.html) for both built-in and imported libraries.

Recommended flow:

1. choose the target `Library`
2. leave `Source` as `Current library catalog` unless you have a separate manifest URL to use
3. click `Pick Project Preview Folder`
4. choose the correct folder for that library:
   - built-in libraries: `public/generated/asset-previews`
   - imported libraries: `libraries/<library-id>/thumbnails`
5. click `Render Screenshots`
6. reload the app or studio page if you want to see the new thumbnails immediately

This keeps the screenshot process understandable:

- asset files are read from the selected library’s own `assetBasePath`
- screenshots are written into that library’s thumbnail folder

### Promote To Built-In

When an imported library is ready, use the `Promote Library` panel in [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html).

User path:

1. select the imported library in the studio
2. copy the generated `npm run assets:promote-library -- "<library-id>"` command
3. run it from the repo root
4. reload the app and studio

The promotion script:

- copies metadata into `src/data/libraries/<library-id>/`
- copies assets into `public/assets/libraries/<library-id>/glTF/`
- copies thumbnails into `public/generated/asset-previews/<library-id>/`
- updates `src/data/libraries.json`
- updates `libraries/libraries.json`

This keeps the user path understandable while also preparing the library for source control and future app builds.

### Remove Or Clean Up A Library

Use the `Remove Library` panel in [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html).

User path:

1. select the library in the studio
2. copy the generated cleanup command
3. run it from the repo root
4. reload the app and studio

The cleanup command:

- removes the library from `libraries/libraries.json` when present
- removes the library from `src/data/libraries.json` when present
- deletes the imported library folder under `libraries/<library-id>/`
- deletes built-in copies under:
  - `src/data/libraries/<library-id>/`
  - `public/assets/libraries/<library-id>/`
  - `public/generated/asset-previews/<library-id>/`

The core `built-in` library is intentionally protected from removal.

Recommended maintenance order:

1. Run `npm run assets:validate`
2. Fix names, categories, and tags in the studio
3. Curate category templates
4. Save both JSON files
5. Run `npm run assets:validate` again
6. If needed, run `npm run assets:thumbnails` and refresh thumbnails

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
