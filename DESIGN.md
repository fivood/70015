# Layout rules for tool pages

The goal: **on a 1280 × 720 screen (a laptop browser or the extension's tab), the result is
visible without scrolling as soon as there is something to show.** Every tool page is checked
against this with the layout audit (see the end of this file).

## 1. Page frame

| Part | Rule |
| --- | --- |
| Header | 48 px logo row, 10 px below it (`--space-sm`). |
| Title block (`.hero`) | Title 22 px + one-line description, 16 px below. No padding of its own. Once the page holds content (`body.is-working`) only an 18 px title remains. |
| Content width | 1024 px (`--max-width`); pages with a workbench widen to 1240 px. |
| Cards (`.panel`) | 20 px padding, 16 px apart. |
| Setting groups (`.settings`) | 16 px apart, label 10 px above its control. |

Targets on an empty page: the first card starts **≤ 150 px** from the top, its first control
**≤ 210 px** (a setting label sits above it).

## 2. Workbench: controls beside the result

Any tool that turns settings into a visible result (a preview, a canvas, generated files) uses
the workbench from 900 px wide:

```html
<div class="workbench">
  <div class="workbench__side">…upload, settings…</div>
  <div class="workbench__main">…preview / stage, actions…</div>
</div>
```

- Side column 280–360 px, main column takes the rest.
- Until the main column has something visible, the side column spans the full width (so an
  empty upload box is not squeezed into a sidebar).
- Small results (a QR code, a color preview) add `workbench__main--sticky` so they stay in view
  while the settings scroll. Large stages do not stick.
- Below 900 px the two columns stack: settings first, result after.
- The workbench can wrap two cards (`.workbench` around `.panel` sections) or split one card.

## 3. Controls

- Option groups (`.segmented` inside a setting group) are as wide as their options, not the
  whole row. Full-width segmented bars are only for switching tools or modes at the top of a page.
- Number fields sit side by side (`.settings__dimensions`); one short number never spans the row.
- Help text (`.settings__note`): 12 px, at most two lines. Longer explanations belong on the
  install or about pages, not in the work area.
- One primary button per action row; secondary actions are `btn--secondary btn--sm`.

## 4. Merge, don't stack

- **Modes and directions are tabs, not stacked cards.** Two tools on one page (Base64 encode /
  decode, color picker / palette, crop / scale) use a `.segmented.page-tabs` bar at the top and
  show one at a time; each tab can be linked as `#name` (js/tabs.js). A mode switch never gets a
  card of its own.
- **One input serves every mode.** An image loaded in one mode is ready in the others
  (Image Size loads once for crop and scale).
- **Settings that act on the loaded file sit beside the upload box** (side column); the main
  column shows the file and what was found in it (Metadata: clean & download left, details right).
- **One explanation per step.** A tab name, a label and a note must not repeat each other; drop
  the label when the tab already says it. Status lines that a script fills start empty and are
  hidden while empty (`.settings__note:empty`).

## 5. Upload box

- Empty: 180 px tall, icon, title and hint.
- Holding content: a thin "drop or click to replace" strip (`body.is-working`).

## 6. Phones (< 700 px)

- One column, 16 px side padding, no horizontal scrolling.
- Toolbars that edit a canvas dock at the bottom (as on the bead page).

## Checking

`node .verify/audit-layout.js http://localhost:3456 <out dir>` (in the folder above this repo, next to the other local checks; needs Chrome and a local server) loads every tool
page at 1280 × 720, empty and with a test image, and reports where the first control and the
main output start and how much of the output is on screen. Targets: first control ≤ 210 px,
output top ≤ 400 px and at least 60 % visible. Canvas editors whose stage is taller than the
screen by design (SVG editor, isometric studio, bead pattern) only need the stage to start
on screen.
