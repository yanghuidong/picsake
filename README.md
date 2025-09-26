# Picsake for Obsidian

## Features

- Gathers images from Markdown notes
  - **PicsExplorer**: displays and searches all images in a grid layout
    - Two search modes:
      - Quick mode: searches the image description (`alt` attribute) and the note's file path
      - Full-text mode: searches in addition the contents of the entire vault. Activated by `Shift+Enter`
    - Exclude certain images from the view
      - Exclude by path prefix in the Settings, or by adding a leading `//` in the description of a specific image, e.g. `![// Won't find me](...)`
      - Excluded images can be revealed manually using the "Eye" icon button next to the search box
    - Go to note: hover on an image thumbnail and click the "Note" icon button to jump to the note in which the image is referenced
  - **ActivePics**: displays pictures from the active file in the sidebar
  - Detects both remote and local image references
    - Status bar count (details in the tooltip)
- Modal gallery view
  - Activate by clicking on an image in a Markdown note, as well as in ActivePics and PicsExplorer
  - **SeekPreview**: hover on the bottom progress bar to show a pop-out thumbnail preview of the image at the corresponding position; click on the preview to jump to the full image. With this design, inspired by modern video players, the gallery view provides a refreshing alternative to the conventional "scrolling filmstrip" UI.
  - Navigation & inspection:
    - Go to previous / next image by Left / Right arrow keys, or Backspace / Space keys
    - Pan & Zoom:
      - Zoom in / out: "=" / "-" keys
      - Original size (device pixel-density aware): "O", number "0" or "1"
      - Fit to window size: "F"
      - Pan: Drag to pan, or use "W", "A", "S", "D" keys; use "R" to reset
    - Exit gallery: Escape key, "Q" key, or double-click
  - Image description:
    - Toggle the description pane using the "I" key, or the icon button in the bottom bar
    - The description can be displayed in two parts using a simple syntax: `![Brief words {Then in great detail that goes on and on}](...)`
      - To hide the description entirely, put all the text inside the curly braces, this can be useful if the description is primarily meant for search rather than presentation.

## Limitations

- Images are detected via Markdown source matching, with the assumption that each line starts with an image, and contains only one image. Leading whitespaces are tolerated, so are any contents after the image (e.g. auto-generated block ID).
- Visual layouts and styles are currently developed only in the following setting:
  - Obsidian Desktop >= 1.9.10,
  - Obsidian's "Default" theme, **Dark** mode.
- Canvas currently not handled.

## Dev notes

First-time dev setup:

```bash
bun install
bun run dev
```

Manage version:

```bash
# First, update `minAppVersion` manually in manifest.json, if necessary;
# Next, update `version` manually in package.json; and then
bun run version
```

Production build:

```bash
bun run build
```

### Upgrading Obsidian API:

- Modify "esbuild.config.mjs" to set the build target based on the [Electron version](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), e.g. `target: ["chrome132", "node20.18"]`
  - Even better, find out the actual versions in Obsidian from the dev console by entering `process.versions`
- Modify "tsconfig.json" to set `target` and `lib` to the year-based ES version corresponding to the Electron version
- Modify "manifest.json" to set `minAppVersion` to when the Electron version bump takes place, see the [Obsidian changelog](https://obsidian.md/changelog/)
