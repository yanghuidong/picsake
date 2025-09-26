
## Limitations

- Images are detected via Markdown source matching, with the assumption that each line starts with an image, and contains only one image. Leading whitespaces are tolerated, so are any contents after the image (e.g. auto-generated block ID).
- Visual layouts and styles are currently developed only in the following setting:
  - Obsidian Desktop >= 1.9.10,
  - Obsidian's "Default" theme, **Dark** mode.

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
