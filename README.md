
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

Upgrading Obsidian API:

- Modify "esbuild.config.mjs" to set the build target based on the [Electron version](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), e.g. `target: ["chrome132", "node20.18"]`
  - Even better, find out the actual versions in Obsidian from the dev console by entering `process.versions`
- Modify "tsconfig.json" to set `target` and `lib` to the year-based ES version corresponding to the Electron version
- Modify "manifest.json" to set `minAppVersion` to when the Electron version bump takes place, see the [Obsidian changelog](https://obsidian.md/changelog/)
