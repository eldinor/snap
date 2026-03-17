# Asset Preview Folder

This folder is the default location for generated asset screenshots used by the app UI.

## Recommended workflow

1. Run the app:

```bash
npm run dev
```

2. Open:

```text
http://127.0.0.1:5173/asset-screenshot-studio.html
```

3. Leave save mode as `Project Preview Folder`

4. Click `Pick Project Preview Folder`

5. Choose this exact folder:

```text
public/generated/asset-previews
```

6. Click `Render Screenshots`

The generated images will be available to the app at paths like:

```text
/generated/asset-previews/Floor_Brick.png
/generated/asset-previews/Wall_Plaster_Straight.png
```

## Notes

- Use this folder when screenshots should be reused inside the app UI later.
- Use `Use Default Folder` only if you want temporary browser downloads instead.
