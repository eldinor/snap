# Libraries Guide

## Overview

Snap supports multiple asset libraries.

Libraries stay separate in the asset browser, so you can switch between them without mixing everything into one very large asset list.

The library names currently present in this repo are testing names. They may be renamed later, so treat the current ids and display names as temporary workflow labels rather than permanent product names.

Examples:

- `built-in`
- `fantasy-props-megakit-standard`

Promoting a library to built-in does not merge it into the first library. It stays its own selectable library entry.

## Library Types

- `built-in`
  Included with the app source structure and intended for source control and future builds.
- `imported`
  Stored in the repo under `libraries/<library-id>/` and discovered at runtime in local/dev workflows.

## Folder Layout

Built-in libraries use:

- `src/data/libraries.json`
- `src/data/libraries/<library-id>/library.json`
- `src/data/libraries/<library-id>/assets-manifest.json`
- `src/data/libraries/<library-id>/asset-categories.json`
- `src/data/libraries/<library-id>/asset-tag-templates.json`
- `public/assets/libraries/<library-id>/glTF/`
- `public/generated/asset-previews/<library-id>/`

The optional `fantasy-props-megakit-standard` built-in library is enabled by default.
Set `VITE_INCLUDE_FANTASY_PROPS_MEGAKIT_STANDARD=false` when starting Vite or building if you want to exclude it.

Imported libraries use:

- `libraries/libraries.json`
- `libraries/<library-id>/library.json`
- `libraries/<library-id>/assets-manifest.json`
- `libraries/<library-id>/asset-categories.json`
- `libraries/<library-id>/asset-tag-templates.json`
- `libraries/<library-id>/inspection-report.json`
- `libraries/<library-id>/glTF/`
- `libraries/<library-id>/thumbnails/`

## Selector Behavior

The main app and both studio pages use a `Library` selector.

That selector is the normal way to switch between libraries while keeping them separate.

After import, validation, thumbnail generation, promotion, or removal:

- in the main app, use the refresh button next to `Library`
- in the asset library studio, use `Refresh Libraries And Reports`

## Full Workflow

### 1. Inspect a GLTF ZIP

Use [`asset-library-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-library-studio.html).

In `Pack Import`:

1. Drop a `.zip` with `.gltf`, `.bin`, and textures.
2. Review missing sidecars, parse errors, external/data URIs, and collisions.
3. Fill:
   - `Draft Library ID`
   - `Draft Library Name`
   - `Default Category`
4. Download the draft library ZIP.

The draft ZIP contains metadata only:

- `library.json`
- `assets-manifest.json`
- `asset-categories.json`
- `asset-tag-templates.json`
- `inspection-report.json`

### 2. Import the Repo Library

In `Repo Import`:

1. Paste the original asset ZIP path.
2. Paste the draft ZIP path.
3. Copy the generated command.
4. Run it from the repo root.

Example:

```powershell
npm run assets:import-library-zip -- "C:\path\to\asset-pack.zip" "C:\path\to\draft-library.zip"
```

This creates:

- `libraries/<library-id>/library.json`
- `libraries/<library-id>/assets-manifest.json`
- `libraries/<library-id>/asset-categories.json`
- `libraries/<library-id>/asset-tag-templates.json`
- `libraries/<library-id>/inspection-report.json`
- `libraries/<library-id>/glTF/...`
- `libraries/<library-id>/thumbnails/.gitkeep`

### 3. Refresh and Check Discovery

After import:

1. Refresh the app or studio.
2. Confirm the imported library appears in the `Library` selector.
3. Check the `Info` panel in the asset library studio.

The `Info` panel shows:

- `Inspected`
- `Imported`
- `Thumbnails Ready`
- `Promoted`
- `Validation Errors`
- `Validation Warnings`
- `Next`

Use `Next` as the shortest recommended action.

### 4. Render Thumbnails

Use [`asset-screenshot-studio.html`](/c:/Users/Fiolent23/newrepos/snap/asset-screenshot-studio.html).

1. Choose the library in `Library`.
2. Leave `Source` as `Current library catalog`.
3. Click `Pick Project Preview Folder`.
4. Choose:
   - built-in libraries: the relevant folder under `public/generated/asset-previews/`
   - imported libraries: `libraries/<library-id>/thumbnails`
5. Click `Render Screenshots`.

For imported libraries, a small first pass like `Limit = 5` is a good sanity check before rendering everything.

### 5. Validate the Library

In `Validate Library`:

1. Select the library.
2. Copy the command.
3. Run it from the repo root.

Example:

```powershell
npm run assets:validate-library -- "<library-id>"
```

This writes:

- `public/generated/library-validation/<library-id>.json`

Then refresh the studio and confirm validation results in `Info`.

### 6. Promote to Built-In

Use this only when the imported library is ready to become part of app content.

In `Promote Library`:

1. Select the imported library.
2. Copy the generated command.
3. Run it from the repo root.

Example:

```powershell
npm run assets:promote-library -- "<library-id>"
```

This copies the library into:

- `src/data/libraries/<library-id>/`
- `public/assets/libraries/<library-id>/glTF/`
- `public/generated/asset-previews/<library-id>/`

And updates:

- `src/data/libraries.json`
- `libraries/libraries.json`

Important:

- the promoted library stays separate in the selector
- it does not merge into the original `built-in` library

### 7. Remove a Library

Use `Remove Library` when you want to clean up imported or promoted content.

Example:

```powershell
npm run assets:remove-library -- "<library-id>" --delete-files
```

This can remove:

- imported registry entry
- built-in registry entry
- imported repo folder
- built-in data folder
- built-in asset folder
- built-in thumbnail folder

The core `built-in` library is protected.

## Tested End-to-End Path

This full path has now been tested successfully:

1. inspect ZIP
2. create draft library ZIP
3. import library into `libraries/<library-id>/`
4. refresh discovery
5. render thumbnails
6. validate library
7. promote to built-in
8. keep it as a separate selectable library
