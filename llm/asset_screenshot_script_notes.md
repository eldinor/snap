# Asset Screenshot Notes

The screenshot workflow now uses Babylon.js directly in the browser, not Playwright.

## Studio page

Open:

- `/asset-screenshot-studio.html`

This page:

1. loads assets in Babylon
2. frames them in a preview scene
3. captures PNGs using Babylon screenshot tools
4. writes files to a chosen output folder with the File System Access API

## Current catalog mode

Run the dev server and open the studio page:

```bash
npm run dev
```

Then visit:

```text
http://127.0.0.1:5173/asset-screenshot-studio.html
```

## Manifest mode

Not used right now.

The current workflow uses the in-app catalog directly from `src/assets.ts`.
