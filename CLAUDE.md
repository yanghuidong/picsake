# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Picsake is an Obsidian plugin for working with pictures in Markdown notes. It gathers, searches, and displays images from across the vault in an interactive gallery view. Built with SolidJS for reactive UI and leverages Obsidian's metadata and content caches.

**Key Features:**
- PicsExplorer: Grid-based image search across vault (quick mode searches alt text and paths; full-text mode searches entire vault)
- ActivePics: Sidebar view showing images from the active file
- Modal Gallery: Interactive image viewer with SeekPreview (thumbnail preview on hover over progress bar)
- Image upload integration via gjako service (optional)
- IndexedDB-based thumbnail caching

## Development Commands

```bash
# First-time setup
bun install

# Development (watch mode)
bun run dev

# Type-check and production build
bun run build

# Linting
npx eslint .
```

## Build System

- **Bundler**: esbuild with SolidJS plugin
- **Target**: Electron 37 (Chrome 138, Node 22.16)
- **Output**:
  - Dev: `main.js` (with inline sourcemaps)
  - Prod: `dist/main.js`, `dist/styles.css`, `dist/manifest.json`
- **Dev build** runs in watch mode; production build includes minification and tree-shaking

## Architecture

### Entry Point & Plugin Lifecycle

**File**: `main.ts` (large monolithic file ~1000+ lines)

The `PskPlugin` class extends Obsidian's `Plugin` and manages:
- **State management**: SolidJS reactive store for pictures, uploads, annotations
- **Event handlers**: File cache changes, renames, deletes, active file changes, paste events, document clicks
- **IndexedDB**: Thumbnail caching (IDB store named "thumbnails")
- **Views**: Registers PicsExplorer (grid view) and ActivePics (sidebar) as custom Obsidian views
- **Modal**: Gallery modal for full-screen image viewing

### Core Data Flow

1. **Image Detection**: Parses Markdown source line-by-line looking for image syntax `![...](...)` in paragraph sections
2. **Cache Updates**: On file changes, extracts pictures and stores them in reactive store keyed by file path
3. **Store Structure**:
   - `pictures: PicturesByPath` - Maps file paths to Picture arrays
   - `uploads: UploadResultDict` - Tracks uploaded images from gjako service
   - `annotations: AnnotationsByURL` - Future feature for image annotations

### Key Components

**Types** (`types/picture.ts`):
- `Picture`: Single image reference with URL, local path, and description
- `GlobalPicture`: Aggregated view with multiple sources (same image referenced in different files)
- `PictureSource`: Describes where an image is referenced
- Description parsing supports structured format: `![Brief {Detailed}](url)` or `![Brief {Detailed}|400x300](url)`
- Images prefixed with `//` in alt text are excluded from search

**Views** (`views/images.tsx`):
- SolidJS components for PicsExplorer, ActivePics, Gallery modal
- Gallery includes pan/zoom controls, keyboard navigation, SeekPreview
- Uses Obsidian's `ItemView` for workspace integration

**Icons** (`views/icons.tsx`):
- Reusable icon components (IconButton, IconToggle, InlineIcon)

**Service** (`services/gjako.ts`):
- External image upload/resize service integration
- `uploadImages()`: Uploads files to configured endpoint
- `makeThumbnail()`: Generates 500x500 thumbnails via resize API

### State Management

Uses SolidJS createStore for reactive state. All major state is defined as class fields in `PskPlugin`:
- Gallery state: focused image, zoom, pan coordinates, fit mode
- Active file tracking
- Settings (explorerPageSize, excludePaths, cacheThumbnails, gjako config)

Settings are made reactive by creating Accessor/Setter pairs, allowing UI to update automatically when settings change.

### Image Extraction Logic

**Assumptions** (important for correctness):
- Each image must start a new line (leading whitespace tolerated)
- Only one image per line
- Content after image on same line is allowed (e.g., block IDs)

**Exclusion rules**:
- Alt text starting with `//`
- File paths matching excludePaths prefixes
- Can be revealed with "Eye" icon in PicsExplorer

### IndexedDB Thumbnail Cache

- Database: "psk-db" with store "thumbnails"
- Keys: Image URLs
- Values: Blob objects (not object URLs - those are temporary!)
- Schema defined in `PskDBSchema` interface
- Cache generation happens on picture extraction if `cacheThumbnails` setting enabled

## Version Management

```bash
# 1. Update minAppVersion in manifest.json (if needed)
# 2. Update version in package.json
bun run version  # Updates manifest.json and versions.json
npm version patch -m "[0.3.1]"  # Auto-commit (.npmrc for customization)
```

## Electron/Obsidian Version Updates

When Obsidian updates Electron version:
1. Update `esbuild.config.mjs`: Set `target` based on [Electron version](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
   - Check actual versions in Obsidian dev console: `process.versions`
2. Update `tsconfig.json`: Set `target` and `lib` to corresponding ES version
3. Update `manifest.json`: Set `minAppVersion` to Obsidian version with new Electron (see [changelog](https://obsidian.md/changelog/))

## Code Style

- **Linting**: ESLint with TypeScript and SolidJS plugins
- **Style**: Tab indentation, single quotes (enforced by @stylistic)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess` enabled
- **JSX**: Preserved and processed by SolidJS plugin

## Testing

No test suite currently exists. Manual testing in Obsidian desktop (v1.9.10+) with Default theme in Dark mode.

## Limitations & Known Issues

- Images detected via Markdown source matching only (not Canvas)
- Visual styles developed only for Obsidian Default theme (Dark mode)
- File structure is monolithic - `main.ts` contains most logic
