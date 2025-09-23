import { App, CachedMetadata, Editor, getLinkpath, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, prepareSimpleSearch, SectionCache, Setting, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import gjako, { GjakoConfig, UploadResult } from 'services/gjako';
import { Accessor, createEffect, createMemo, createRoot, createSignal, Setter } from 'solid-js';
import { createStore, produce, SetStoreFunction } from 'solid-js/store';
import { createComponent, render } from 'solid-js/web';
import { Annotation, AnnotationsByURL, isImageLink, Picture, PicturesByPath, UploadResultDict } from 'types/picture';
import { ActivePics, Gallery, ImageUpload, PicsExplorer, UploadResultSummary } from 'views/images';

const NAME = 'Picsake';
const LANG = 'psk';
const ICON = 'images';

const GALLERY_ID = 'psk-gallery-container';


// function getSectionsOfType(type: 'code' | 'paragraph', fileCache: CachedMetadata): SectionCache[] {
// 	if (!fileCache.sections) return [];
// 	return fileCache.sections.filter(section => section.type === type);
// }

function getSectionsOfInterest(fileCache: CachedMetadata) {
	const codeblocks: SectionCache[] = [];
	const paragraphs: SectionCache[] = [];

	if (fileCache.sections) {
		for (const section of fileCache.sections) {
			if (section.type === 'code') {
				codeblocks.push(section);
			} else if (section.type === 'paragraph') {
				paragraphs.push(section);
			}
		}
	}

	return { codeblocks, paragraphs };
}

// function shouldHandleTargetImage(target: HTMLImageElement): boolean {
// 	// const isPicsExplorerView = target.closest(`[data-type="${VIEW_TYPE_PICS_EXPLORER}"]`) !== null;
// 	const isMarkdownView = target.closest('.workspace-leaf-content[data-type="markdown"]') !== null;
// 	return isMarkdownView;
// }

// function findPeerImages(target: HTMLImageElement): HTMLImageElement[] {
// 	const isReadingView = target.closest('.markdown-reading-view') !== null;
// 	const isLivePreview = target.closest('.markdown-source-view.is-live-preview') !== null;
// 	if (isLivePreview) {
// 		// Note: embedded local images are NOT among top-level siblings like remote ones!
// 		// const nodes = target.parentElement?.querySelectorAll('img:not(.psk-thumbnail)');
// 		const closestAncestor = target.closest('.cm-content');
// 		const imgNodes = closestAncestor?.querySelectorAll('img:not(.psk-thumbnail)') ?? [];
// 		return Array.from(imgNodes) as HTMLImageElement[];
// 	} else if (isReadingView) {
// 		const nodes = document.querySelectorAll('.markdown-reading-view img:not(.psk-thumbnail)');
// 		return Array.from(nodes) as HTMLImageElement[];
// 	} else {
// 		return [];
// 	}
// }

// function delay(ms: number): Promise<void> {
// 	return new Promise(resolve => setTimeout(resolve, ms));
// }

// Remember to rename these classes and interfaces!

interface MySettings {
	explorerPageSize: number | null;
	excludePaths: string[];
	// helpers
	uploadImagesOnPaste: boolean;
	gjako: GjakoConfig;
}

const DEFAULT_SETTINGS: MySettings = {
	explorerPageSize: 20,
	excludePaths: [],
	uploadImagesOnPaste: false,
	gjako: gjako.DEFAULT_CONFIG,
}

type MyStore = {
	pictures: PicturesByPath,
	uploads: UploadResultDict,
	annotations: AnnotationsByURL,
};

export default class MyPlugin extends Plugin {
	// 0. States

	settings!: MySettings;

	// Solid stuff
	store!: MyStore;
	private setStore!: SetStoreFunction<MyStore>;
	private disposeEffect!: () => void;
	activeFile!: Accessor<TFile | null>;
	setActiveFile!: Setter<TFile | null>;
	gallery!: Accessor<Picture[]>;
	setGallery!: Setter<Picture[]>;
	galleryFocus!: Accessor<number | null>;
	setGalleryFocus!: Setter<number | null>;
	galleryFit!: Accessor<boolean>;
	setGalleryFit!: Setter<boolean>;
	galleryZoom!: Accessor<number>;
	setGalleryZoom!: Setter<number>;
	showPicDescription!: Accessor<boolean>;
	setShowPicDescription!: Setter<boolean>;
	translateX!: Accessor<number>;
	setTranslateX!: Setter<number>;
	translateY!: Accessor<number>;
	setTranslateY!: Setter<number>;
	// Make settings reactive!
	explorerPageSize!: Accessor<number | null>;
	setExplorerPageSize!: Setter<number | null>;
	excludePaths!: Accessor<string[]>;
	setExcludePaths!: Setter<string[]>;

	// 1. Class fields as arrow functions
	// Advantage over using class methods: `this` always refers to the class instance!
	// No need for manual bind(this)

	// Note: this is also called on file creation!
	onFileCacheChanged = (file: TFile, newContent: string, cache: CachedMetadata) => {
		const { codeblocks, paragraphs } = getSectionsOfInterest(cache);

		const pictures = this.extractPicturesFromFile(file, newContent, paragraphs);
		if (pictures.length > 0) {
			this.setStore('pictures', file.path, pictures);
		} else {
			this.setStore('pictures', produce(pictures => {
				delete pictures[file.path];
			}));
		}

		const { uploads } = this.extractPictureMetadataFromFile(file, newContent, codeblocks);
		uploads.forEach(upload => {
			this.setStore('uploads', upload.url, upload);
		});
	}

	onFileRename = (newFile: TAbstractFile, oldPath: string) => {
		if (this.activeFile()?.path === oldPath) {
			// Note: newFile is NOT a TFile
			// Note: alternatively, use `this.app.workspace.getActiveFile()`
			this.setActiveFile(this.app.vault.getFileByPath(newFile.path));
		}

		const oldPictures = this.store.pictures[oldPath];
		if (!oldPictures || oldPictures.length === 0) return;

		this.setStore('pictures', produce(pictures => {
			delete pictures[oldPath];
			pictures[newFile.path] = oldPictures;
		}));

		new Notice(`${oldPictures.length} pictures moved from ${oldPath} to ${newFile.path}`);
	}

	onFileDelete = (file: TAbstractFile) => {
		const oldPictures = this.store.pictures[file.path];
		if (!oldPictures) return;

		this.setStore('pictures', produce(pictures => {
			delete pictures[file.path];
		}));

		new Notice(`${oldPictures.length} pictures deleted from ${file.path}`);
	}

	onActivateFile = (file: TFile | null) => {
		// new Notice(`Activated ${file?.name}`);
		this.setActiveFile(file);

		// FIXME this doesn't dynamically update the tooltip text;
		// somehow the Outline core plugin is able to update correctly, what's the API?
		// const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_PICS);
		// for (const leaf of leaves) {
		// 	// ???
		// }
	}

	onPaste = (evt: ClipboardEvent, editor: Editor) => {
		// https://docs.obsidian.md/Reference/TypeScript+API/Workspace/on('editor-paste')
		// Check for evt.defaultPrevented before attempting to handle this event, and return if it has been already handled.
		// Use evt.preventDefault() to indicate that you've handled the event.
		if (evt.defaultPrevented) return;

		const files = evt.clipboardData?.files;
		if (!files) return;

		const images = Array.from(files).filter((file) => file.type.startsWith('image/'));
		if (images.length === 0) return;

		// We have to use the blocking `window.confirm` dialogue to give users the option to use Obsidian's default pasting handler.
		// const ok = window.confirm(`Upload ${images.length} images e.g. ${images[0]?.name}?`);
		if (this.settings.uploadImagesOnPaste) {
			evt.preventDefault();
			new ImageUploadModal(this.app, this.settings, images,
				{
					onConfirm: async (selected, isPhoto, subDir) => {
						new Notice(`Selected ${selected.size} images to upload`);
						const res = await gjako.uploadImages(selected, isPhoto, subDir, this.settings.gjako);
						const infoBlock = `\`\`\`${LANG}\n${JSON.stringify({ uploads: res }, null, '\t')}\n\`\`\``;
						const imgMarkdown = res.map(info => `![${info.name}](${info.url})`).join('\n\n');
						editor.replaceSelection(`${infoBlock}\n\n${imgMarkdown}`);
					},
					onCancel: () => { new Notice('No action is taken'); }
				}
			).open();
		}
	}

	onClickDocument = (evt: PointerEvent) => {
		if (evt.target) {
			const targetEl = evt.target as HTMLElement;
			if (targetEl instanceof HTMLImageElement) {
				// Note: for our custom view like PicsExplorer, we don't have to trigger the Gallery modal from here, because we have full control of the UI;
				// We do the following only in places where we don't have control, e.g. the Markdown view. (Well, technically we could, via editor extensions etc.)
				// const picsExplorerView = this.app.workspace.getActiveViewOfType(PicsExplorerView);
				//
				// Note: if Gallery modal is already activated, then we shouldn't handle the click, o/w clicking the focused picture of the gallery will also trigger the handler here!
				// Alternatively, we could use the old approach, which is a tad hacky, but safe from this false positive:
				// const isMarkdownView = targetEl.closest('.workspace-leaf-content[data-type="markdown"]') !== null;
				// if (isMarkdownView) {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && this.galleryFocus() === null) {
					evt.preventDefault();

					// Note: DOM cannot be used as a reliable source, because of lazy loading;
					// We therefore have to use our global state obtained from parsing the Markdown source.
					// see `extractPicturesFromFile`

					const activeFile = this.activeFile();
					if (activeFile) {
						const gallery: Picture[] = this.store.pictures[activeFile.path] ?? [];
						this.setGallery(gallery);

						const targetIndex = gallery.map(pic => pic.url).indexOf(targetEl.src);
						this.setGalleryFocus(targetIndex >= 0 ? targetIndex : null);
					}
				}
			}
		}
	}

	openActivePicsView = async (show: boolean) => {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_PICS);

		if (leaves[0]) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				// console.log(`leaf: ${leaf.getViewState().type}`);
				await leaf.setViewState({ type: VIEW_TYPE_ACTIVE_PICS, active: show });
				// console.log(`leaf: ${leaf.getViewState().type}`);
			} else {
				// shouldn't happen!
				new Notice('getRightLeaf failed');
			}
		}

		// Reveal the leaf in case it is in a collapsed sidebar
		if (leaf && show) await workspace.revealLeaf(leaf);
	}

	openPicsExplorerView = async () => {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_PICS_EXPLORER);

		if (leaves[0]) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getLeaf('tab');
			await leaf?.setViewState({ type: VIEW_TYPE_PICS_EXPLORER, active: true });
		}

		// Reveal the leaf in case it is in a collapsed sidebar
		if (leaf) await workspace.revealLeaf(leaf);
	}

	// Note: fts needs to be an arrow function instead of a class method because `this` binding is automatic;
	// o/w we'd get TypeError: Cannot read properties of undefined (reading 'vault')
	fts = async (query: string): Promise<string[]> => {
		const searcher = prepareSimpleSearch(query);
		const mdFiles = this.app.vault.getMarkdownFiles();
		const matchedPaths = [];

		for (const mdFile of mdFiles) {
			const content = await this.app.vault.cachedRead(mdFile);
			const searchResult = searcher(content);
			if (searchResult !== null) matchedPaths.push(mdFile.path);
		}

		return matchedPaths;
	}

	// 2. Overriding inherited class methods

	async onload() {
		const start = performance.now();

		const [store, setStore] = createStore<MyStore>({
			pictures: {},
			uploads: {},
			annotations: {},
		});
		// eslint-disable-next-line solid/reactivity
		this.store = store;
		this.setStore = setStore;

		const [activeFile, setActiveFile] = createSignal<TFile | null>(null);
		this.activeFile = activeFile;
		this.setActiveFile = setActiveFile;

		const [gallery, setGallery] = createSignal<Picture[]>([]);
		this.gallery = gallery;
		this.setGallery = setGallery;

		const [galleryFocus, setGalleryFocus] = createSignal<number | null>(null);
		this.galleryFocus = galleryFocus;
		this.setGalleryFocus = setGalleryFocus;

		const [galleryFit, setGalleryFit] = createSignal<boolean>(false);
		this.galleryFit = galleryFit;
		this.setGalleryFit = setGalleryFit;

		const [galleryZoom, setGalleryZoom] = createSignal<number>(1);
		this.galleryZoom = galleryZoom;
		this.setGalleryZoom = setGalleryZoom;

		const [showPicDescription, setShowPicDescription] = createSignal<boolean>(false);
		this.showPicDescription = showPicDescription;
		this.setShowPicDescription = setShowPicDescription;

		const [translateX, setTranslateX] = createSignal<number>(0);
		this.translateX = translateX;
		this.setTranslateX = setTranslateX;

		const [translateY, setTranslateY] = createSignal<number>(0);
		this.translateY = translateY;
		this.setTranslateY = setTranslateY;

		// Note: This is not called when a file is renamed for performance reasons. You must hook the vault rename event for those.
		this.registerEvent(this.app.metadataCache.on('changed', this.onFileCacheChanged, this));

		this.registerEvent(this.app.vault.on('rename', this.onFileRename, this));
		this.registerEvent(this.app.vault.on('delete', this.onFileDelete, this));

		this.registerEvent(this.app.workspace.on('file-open', this.onActivateFile, this));

		this.registerEvent(this.app.workspace.on('editor-paste', this.onPaste, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', this.onClickDocument);

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Critical importance: registerView must be done before `workspace.onLayoutReady`
		// if we need to open a view leaf inside there,
		// o/w `leaf.setViewState` can fail!
		this.registerView(
			VIEW_TYPE_ACTIVE_PICS,
			(leaf) => new ActivePicsView(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_PICS_EXPLORER,
			(leaf) => new PicsExplorerView(leaf, this)
		);

		this.registerMarkdownCodeBlockProcessor(LANG, (blockText, container, ctx) => {
			const info = JSON.parse(blockText);
			if (Object.hasOwn(info, 'uploads')) {
				const uploads: UploadResult[] = info.uploads;
				render(() => createComponent(UploadResultSummary, { uploads }), container);
			}
		});

		// Important: this is where we do stuff on startup, w/o slowing down Obsidian startup
		this.app.workspace.onLayoutReady(async () => {
			const start = performance.now();

			// new Notice('Workspace layout is ready!');

			// 0. States

			this.setActiveFile(this.app.workspace.getActiveFile());

			const mdFiles = this.app.vault.getMarkdownFiles();
			for (const mdFile of mdFiles) {
				const fileCache = this.app.metadataCache.getFileCache(mdFile);
				if (!fileCache) continue;

				const { codeblocks, paragraphs } = getSectionsOfInterest(fileCache);
				if (paragraphs.length === 0) continue; // avoid `cachedRead` of the file if we know it contains no paragraphs!

				const fileContent = await this.app.vault.cachedRead(mdFile);

				const pictures = this.extractPicturesFromFile(mdFile, fileContent, paragraphs);
				if (pictures.length === 0) continue;
				this.setStore('pictures', mdFile.path, pictures);

				// Note: we assume that the metadata are bound to the pictures present in the file;
				// if no pictures are found in the file, we skip, ignoring any metadata (regarding them as broken references)
				const { uploads } = this.extractPictureMetadataFromFile(mdFile, fileContent, codeblocks);
				uploads.forEach(upload => {
					this.setStore('uploads', upload.url, upload);
				});
			}

			// 1. DOM

			// insert modal UI
			const appContainer = document.querySelector('.app-container');
			if (appContainer) {
				const galleryContainer = document.createElement('div');
				galleryContainer.id = GALLERY_ID;
				appContainer.appendChild(galleryContainer);
				render(() => createComponent(Gallery, {
					gallery: this.gallery,
					galleryFocus: this.galleryFocus,
					setGalleryFocus: this.setGalleryFocus,
					galleryFit: this.galleryFit,
					setGalleryFit: this.setGalleryFit,
					galleryZoom: this.galleryZoom,
					setGalleryZoom: this.setGalleryZoom,
					showPicDescription: this.showPicDescription,
					setShowPicDescription: this.setShowPicDescription,
					translateX: this.translateX,
					setTranslateX: this.setTranslateX,
					translateY: this.translateY,
					setTranslateY: this.setTranslateY,
				}), galleryContainer);
			}

			const finish = performance.now();
			console.log(`[${NAME}] onLayoutReady: ${(finish - start).toFixed(1)} ms`);
		});

		await this.loadSettings();

		const [excludePaths, setExcludePaths] = createSignal<string[]>(this.settings.excludePaths);
		this.excludePaths = excludePaths;
		this.setExcludePaths = setExcludePaths;

		const [explorerPageSize, setExplorerPageSize] = createSignal<number | null>(this.settings.explorerPageSize);
		this.explorerPageSize = explorerPageSize;
		this.setExplorerPageSize = setExplorerPageSize;

		// This creates an icon in the left ribbon.
		this.addRibbonIcon(ICON, NAME, (evt: MouseEvent) => {
			if (evt.metaKey) {
				new OverviewModal(this.app, this).open();
			} else {
				this.openPicsExplorerView();
			}
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();

		createRoot((dispose) => {
			// this.register(dispose); // do it in `onunload` is more explicit
			this.disposeEffect = dispose;

			const picsCount = createMemo(() => {
				const urlSet = new Set<string>();
				for (const pictures of Object.values(this.store.pictures)) {
					for (const pic of pictures) {
						urlSet.add(pic.url);
					}
				}
				return urlSet.size;
			});

			const uploadCount = createMemo(() => {
				return Object.keys(this.store.uploads).length;
			});

			createEffect(() => {
				statusBarItemEl.setText(`${picsCount()} (${uploadCount()}) pics`);
			});
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'psk-open-active-pics-view',
			name: 'Open active pics view',
			checkCallback: (checking: boolean) => {
				// The currently active view could be in the sidebar, but what we care about is the most recently active file!
				// const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

				// actually, we already keep track of this in `this.store.activeFile`
				// const activeFile = this.app.workspace.getActiveFile();

				const canRunCommand = this.activeFile() !== null;
				if (canRunCommand) {
					// If checking is true, we're simply _checking_ if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						this.openActivePicsView(true);
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MyPluginSettingTab(this.app, this));

		const finish = performance.now();
		console.log(`[${NAME}] onload: ${(finish - start).toFixed(1)} ms`);
	}

	// Important: this does NOT run on app / plugin startup! It's meant for _one-time_ initialization when plugin is _manually_ enabled;
	// for code that needs to run on every plugin load, put it in workspace.onLayoutReady.
	// This happens after workspace.onLayoutReady!
	// Officially recommended place to auto open custom views! (This way, if a user wants a custom view closed, it'll stay so the next time the app / plugin starts.)
	onUserEnable() {
		// new Notice('onUserEnable');

		// auto open custom views
		this.openActivePicsView(false);
	}

	// onunload is inherited from generic Component rather than Plugin, and it can't be async!
	onunload() {
		const start = performance.now();

		this.disposeEffect();

		// delete modal UI
		document.getElementById(GALLERY_ID)?.remove();

		// Have to manually reset the flag on plugin unload to shut up Solid,
		// o/w when we reload the plugin, Solid sees this singleton flag already set, triggering a false positive:
		// console.warn("You appear to have multiple instances of Solid. This can lead to unexpected behavior.")
		if (globalThis.Solid$$) globalThis.Solid$$ = false;

		const finish = performance.now();
		console.log(`[${NAME}] onunload: ${(finish - start).toFixed(1)} ms`);
	}

	// 3. My own class methods (utilities)

	async loadSettings() {
		// Assert: this.settings === undefined
		const data = await this.loadData();
		// As we add new fields to `GjakoConfig`, the `gjako` object from data.json, now with incomplete fields,
		// will completely overwrite `DEFAULT_SETTINGS.gjako`, hence those new fields won't appear in the final settings;
		// this is because `Object.assign` only does "shallow merge", so to speak.
		if (data) {
			data.gjako = data.gjako
				? Object.assign({}, DEFAULT_SETTINGS.gjako, data.gjako)
				: DEFAULT_SETTINGS.gjako;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// console.log(`settings: ${JSON.stringify(this.settings, null, '\t')}`);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getAttachmentInfo(linkText: string): { url: string, path: string } | null {
		const linkPath = getLinkpath(linkText);
		const sourcePath = this.activeFile()?.path ?? '';
		const file = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);

		return file ? { url: this.app.vault.getResourcePath(file), path: file.path } : null;
	}

	/**
	 * Currently naive parsing:
	 * - only allows a single image per line
	 * - only checks common image extensions
	 * - doesn't validate URL / path
	 * - doesn't support URL query string
	 * - doesn't support data: blobs
	 */
	extractPicturesFromFile(file: TFile, fileContent: string, paragraphs: SectionCache[]): Picture[] {
		const fileLines = fileContent.split('\n');

		const pictures = [];
		for (const paragraph of paragraphs) {
			const { start, end } = paragraph.position;

			const sectionLines = fileLines.slice(start.line, end.line + 1);

			for (const line of sectionLines) {
				let picture: Picture | null = null;
				const matches = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)/); // Note: possible trailing block ID
				if (matches) {
					const [, description, url] = matches;
					// Note: description is allowed to be an empty string here!
					// Note: url is guaranteed to be non-empty by the regex.
					if (description !== undefined && url && isImageLink(url)) {
						picture = {
							url,
							localPath: null,
							description,
						};
					}
				} else {
					// maybe it's an embedded local image?
					const matchesEmbed = line.trim().match(/^!\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
					if (matchesEmbed) {
						const [, linkText, displayText] = matchesEmbed;
						if (linkText && isImageLink(linkText)) {
							const info = this.getAttachmentInfo(linkText);
							if (info) {
								picture = {
									url: info.url,
									localPath: info.path,
									description: displayText ?? linkText,
								};
							}
						}
					}
				}
				if (picture) {
					// dedupe by url
					if (!pictures.map(pic => pic.url).contains(picture.url)) {
						pictures.push(picture);
					}
				}
			}
		}
		return pictures;
	}

	extractPictureMetadataFromFile(file: TFile, fileContent: string, codeblocks: SectionCache[]) {
		const uploads: UploadResult[] = [];
		const annotations: Annotation[] = [];

		const fileLines = fileContent.split('\n');

		for (const codeblock of codeblocks) {
			const { start, end } = codeblock.position;
			const lines = fileLines.slice(start.line, end.line); // exclude the final ``` line
			const firstLine = lines[0];
			if (firstLine && firstLine === `\`\`\`${LANG}`) {
				const content = lines.slice(1).join('\n');
				const parsed = JSON.parse(content);
				if (Object.hasOwn(parsed, 'uploads')) {
					const uploadsInCodeblock: UploadResult[] = parsed.uploads;
					uploads.push(...uploadsInCodeblock);
				} else if (Object.hasOwn(parsed, 'annotations')) {
					// MAYBE (NOT)
				}
			}
		}

		return { uploads, annotations };
	}
}

const VIEW_TYPE_ACTIVE_PICS = 'psk-view-active-pics';

class ActivePicsView extends ItemView {
	plugin: MyPlugin;

	// Solid stuff
	private dispose!: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.icon = ICON;
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ACTIVE_PICS;
	}

	getDisplayText(): string {
		// Note: the code below can update the "title" property persisted in "workspace.json" when active file changes,
		// but it doesn't update the UI, including the view leaf's tab title and its tooltip.
		// return `Pictures in ${this.plugin.store.activeFile?.name}`;
		return 'Pictures in active file';
	}

	async onOpen() {
		this.dispose = render(() => {
			const activePictures = createMemo(() => {
				const activeFile = this.plugin.activeFile();
				return activeFile
					? this.plugin.store.pictures[activeFile.path] ?? []
					: []
			});
			return createComponent(ActivePics, {
				activePictures,
				activeFile: this.plugin.activeFile,
				setGallery: this.plugin.setGallery,
				setGalleryFocus: this.plugin.setGalleryFocus,
			});
		}, this.contentEl);
	}

	async onClose() {
		this.dispose();
	}
}

const VIEW_TYPE_PICS_EXPLORER = 'psk-view-pics-explorer';

class PicsExplorerView extends ItemView {
	plugin: MyPlugin;

	// Solid stuff
	private dispose!: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.navigation = true; // if not, pressing Escape key will switch to the previous active file!
		this.icon = ICON;
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_PICS_EXPLORER;
	}

	getDisplayText(): string {
		return 'Pics explorer';
	}

	async onOpen() {
		const { contentEl } = this;

		this.dispose = render(() => {
			const pictures = this.plugin.store.pictures;
			return createComponent(PicsExplorer, {
				pictures,
				excludePaths: this.plugin.excludePaths,
				pageSize: this.plugin.explorerPageSize,
				setGallery: this.plugin.setGallery,
				setGalleryFocus: this.plugin.setGalleryFocus,
				fts: this.plugin.fts,
				app: this.plugin.app,
			});
		}, contentEl);
	}

	async onClose() {
		this.dispose();
	}
}

class ImageUploadModal extends Modal {
	settings: MySettings;
	images: File[];
	onConfirm: (selected: Set<File>, isPhoto: boolean, subDir: string) => void;
	onCancel: () => void;

	// Solid stuff
	private selected: Accessor<Set<File>>;
	private setSelected: Setter<Set<File>>;
	private dispose!: () => void;
	private disposeEffect!: () => void;

	constructor(app: App, settings: MySettings, images: File[], handlers: { onConfirm: (selected: Set<File>, isPhoto: boolean, subDir: string) => void, onCancel: () => void }) {
		super(app);
		this.settings = settings;
		this.images = images;
		this.onConfirm = handlers.onConfirm;
		this.onCancel = handlers.onCancel;

		const [selected, setSelected] = createSignal<Set<File>>(new Set(images));
		this.selected = selected;
		this.setSelected = setSelected;
	}

	onOpen() {
		createRoot((dispose) => {
			this.disposeEffect = dispose;

			createEffect(() => {
				this.setTitle(`Ready to upload ${this.selected().size} images`);
			});
		});

		const { contentEl } = this;

		const mainDiv = contentEl.createDiv();
		mainDiv.style.maxHeight = '60vh';
		mainDiv.style.overflowY = 'auto';

		this.dispose = render(() =>
			createComponent(ImageUpload, {
				images: this.images,
				selected: this.selected,
				setSelected: this.setSelected,
			}), mainDiv
		);

		let isPhoto = true;
		let subDir = '';
		const config = this.settings.gjako

		new Setting(contentEl)
			.addToggle(toggle =>
				toggle
					.setValue(isPhoto)
					.onChange(value => {
						isPhoto = value;
					})
			)
			.addDropdown(dropdown =>
				dropdown
					.addOption('', config.dir)
					.addOptions(Object.fromEntries(config.subDirs.map(sub => [sub, `${config.dir}/${sub}`])))
					.setValue(subDir)
					.onChange(value => {
						subDir = value;
					})
			)
			.addButton(btn =>
				btn
					.setButtonText('OK')
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm(this.selected(), isPhoto, subDir);
					})
			)
			.addButton(btn =>
				btn
					.setButtonText('Cancel')
					.onClick(() => {
						this.close();
						this.onCancel();
					})
			);
	}

	onClose() {
		this.dispose();
		this.disposeEffect();
		// this.contentEl.empty(); // NOT necessary, a new Modal instance is created on every paste, no UI reuse (unlike PluginSettingTab, which is added once on plugin load)
	}
}

class OverviewModal extends Modal {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		// const { contentEl } = this;

		// render(() => createComponent(Notelets, { notelets: this.plugin.store.notelets }), contentEl);
	}

	onClose() {
		// this.contentEl.empty(); // NOT necessary, a new Modal instance is created on every trigger action (e.g. ribbon icon click)
	}
}

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const settings = this.plugin.settings;

		const { containerEl } = this;

		containerEl.empty(); // Necessary! o/w we get duplicated settings whenever we navigate back to our tab

		new Setting(containerEl)
			.setName('Pics explorer')
			.setHeading();

		new Setting(containerEl)
			.setName('Page size')
			.setDesc('Select the number of thumbnails to show at once.')
			.addDropdown(comp => comp
				.addOptions({
					'20': '20',
					'40': '40',
					'0': 'Unlimited'
				})
				.setValue(settings.explorerPageSize === null ? '0' : String(settings.explorerPageSize))
				.onChange(async value => {
					settings.explorerPageSize = value === '0' ? null : Number(value);
					this.plugin.setExplorerPageSize(settings.explorerPageSize);
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName('Excluded paths')
			.setDesc('Add one path prefix per line, e.g. Tmp/ will exclude all file paths that match the prefix.')
			.addTextArea(comp => comp
				.setPlaceholder('Tmp/\nTmp file.md')
				.setValue(settings.excludePaths.join('\n'))
				.onChange(async value => {
					settings.excludePaths = value.split('\n').filter(line => line.length > 0);
					this.plugin.setExcludePaths(settings.excludePaths);
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName('Helpers')
			.setDesc('Optional utilities that assist the workflow.')
			.setHeading();

		new Setting(containerEl)
			.setName('Upload images on paste')
			.addToggle(toggle => toggle
				.setValue(settings.uploadImagesOnPaste)
				.onChange(async value => {
					settings.uploadImagesOnPaste = value;
					await this.plugin.saveSettings();
					// To refresh the view of other settings whose `isDisabled` states are dependent on this toggle value,
					// is there a better way?
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Gjako server URL prefix')
			.addText(comp => comp
				.setValue(settings.gjako.urlPrefix)
				.onChange(async value => {
					settings.gjako.urlPrefix = value;
					await this.plugin.saveSettings();
				})
			)
			.setDisabled(!settings.uploadImagesOnPaste);

		new Setting(containerEl)
			.setName('Gjako API key')
			.addText(comp => comp
				.setValue(settings.gjako.apiKey)
				.onChange(async value => {
					settings.gjako.apiKey = value;
					await this.plugin.saveSettings();
				})
			)
			.setDisabled(!settings.uploadImagesOnPaste);

		new Setting(containerEl)
			.setName('Gjako upload directory')
			.addText(comp => comp
				.setValue(settings.gjako.dir)
				.onChange(async value => {
					settings.gjako.dir = value;
					await this.plugin.saveSettings();
				})
			)
			.setDisabled(!settings.uploadImagesOnPaste);

		new Setting(containerEl)
			.setName('Gjako upload subdirectories')
			.setDesc('Add one directory name per line.')
			.addTextArea(comp => comp
				.setValue(settings.gjako.subDirs.join('\n'))
				.onChange(async value => {
					settings.gjako.subDirs = value.split('\n').filter(line => line.length > 0);
					await this.plugin.saveSettings();
				})
			)
			.setDisabled(!settings.uploadImagesOnPaste);
	}
}
