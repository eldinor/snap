# UI Instructions for AI Agent — Modular GLTF Snapping Editor

## Goal
Create a **compact editor UI** for placing modular GLTF assets that snap to a grid.

The visual style must follow **Material Design Dark**, but kept **dense and practical** for editor use.

---

## Design Direction

The UI should feel like a **tool**, not a marketing page.

Required style rules:

- **Material Design Dark**
- **Compact layout**
- **No rounded borders**
- **No large paddings**
- **Dense controls**
- **Low visual noise**
- **Clear hierarchy**
- **Fast access to tools**

Avoid:

- oversized buttons
- decorative spacing
- soft cards
- pill-shaped controls
- playful styling

Use:

- sharp rectangular panels
- tight spacing
- thin dividers
- muted dark surfaces
- subtle elevation only where necessary

---

## Visual Theme

### Base Style
Use a dark editor-like palette inspired by Material Design Dark.

Suggested surface structure:

- background: very dark
- primary panel surfaces: dark gray
- secondary surfaces: slightly lighter dark gray
- dividers: thin, low-contrast
- text: high-contrast light gray or white
- accents: restrained Material-style highlight color

### Shape Language
All UI elements should use:

- **square corners**
- **no rounded containers**
- **no rounded buttons**
- **no rounded input fields**

### Density
All components should be **compact**.

Rules:

- small control heights
- tight vertical rhythm
- narrow gaps between controls
- minimal internal padding
- no empty decorative space

---

## Main Layout

Use a **three-region editor layout**:

1. **Top toolbar**
2. **Left asset panel**
3. **Main viewport**

Optional later:

4. **Right properties panel**
5. **Bottom status bar**

### Layout Principle
The viewport should get most of the screen space.

Panels should be narrow and functional.

---

## 1. Top Toolbar

Purpose:
global editor controls

Include compact controls for:

- snap on/off
- grid size
- rotation snap
- selection mode
- placement mode

Style:

- single horizontal strip
- compact rectangular buttons
- compact dropdowns
- small labels
- thin separators between groups

Do not use large icon buttons.

Toolbar should feel similar to a professional DCC/editor tool row.

---

## 2. Left Asset Panel

Purpose:
select GLTF assets for placement

Content:

- search field
- category list
- asset list

Recommended categories:

- Floors
- Walls
- Corners
- Doors
- Props
- Decorations

Style:

- compact vertical panel
- dense rows
- small thumbnails
- short text labels
- minimal padding
- no card-based gallery layout

Asset items should look like a **tight list**, not a storefront.

Interaction:

- click asset → enter placement mode
- selected item should have clear highlight
- hover state should be subtle

---

## 3. Main Viewport

Purpose:
place and manipulate assets

Must include:

- visible grid
- ghost placement preview
- selected object outline
- transform gizmo

Viewport UI overlays should also stay compact.

### Placement Preview
When asset is selected:

- show semi-transparent ghost model
- snap it to grid
- show valid placement clearly

### Grid
The floor grid should be visible but not bright.

It should support snap values such as:

- 1
- 0.5
- 0.25
- 0.125

### Selection Feedback
When object is selected:

- outline or highlight
- transform gizmo appears
- no oversized handles

---

## 4. Right Properties Panel (Optional)

Purpose:
show selected object settings

Possible content:

- asset name
- position
- rotation
- snap status
- delete action

Style:

- narrow panel
- stacked compact fields
- rectangular numeric inputs
- dense label/value layout

Keep this panel minimal.

---

## 5. Bottom Status Bar (Optional)

Purpose:
lightweight feedback

Can show:

- current mode
- selected asset
- grid size
- snap state
- hint text for shortcuts

Style:

- very thin horizontal strip
- compact text
- low prominence

---

## Component Rules

### Buttons
Buttons must be:

- rectangular
- compact
- low height
- tight horizontal padding

No rounded Material buttons.

### Inputs
Inputs and dropdowns must be:

- rectangular
- compact
- dark themed
- easy to scan quickly

### Panels
Panels should be:

- flat or slightly elevated
- sharp edged
- separated by thin lines, not big gaps

### Typography
Use clear editor-style typography.

Rules:

- small to medium font sizes
- strong contrast
- short labels
- avoid oversized headings

---

## Spacing Rules

The interface must feel dense.

Use:

- tight margins
- tight paddings
- small gaps between controls

Avoid:

- roomy layouts
- large content breathing space
- decorative empty areas

General principle:

**every pixel should serve usability**

---

## Interaction Flow

Primary workflow:

1. select asset from left panel
2. move cursor in viewport
3. preview snaps to grid
4. rotate if needed
5. click to place
6. repeat quickly

This flow should require minimal mouse travel.

---

## Shortcuts

Support compact editor workflow with keyboard shortcuts:

- **R** → rotate 90°
- **Delete** → remove selected object
- **Esc** → cancel placement

Shortcuts may be hinted in the status bar or tooltip area.

---

## UX Priorities

Prioritize these in order:

1. fast placement
2. predictable snapping
3. compact information density
4. clear dark-theme readability
5. low visual distraction

The UI should feel suitable for repeated level-building actions.

---

## Final Summary

Build the UI as a **compact Material Design Dark editor** with:

- sharp rectangular panels
- no rounded borders
- no large paddings
- dense controls
- dark surfaces
- clear grid-based placement workflow

Essential areas:

- top toolbar
- left asset panel
- main 3D viewport

The result should feel closer to a **professional level editor** than a consumer app.
