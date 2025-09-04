import { App, CachedMetadata, Editor, ItemView, Modal, Notice, Plugin, PluginSettingTab, SectionCache, Setting, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import gjako, { GjakoConfig, ImageInfo } from 'services/gjako';
import { Accessor, createEffect, createRoot, createSignal, Setter } from 'solid-js';
import { createStore, SetStoreFunction } from 'solid-js/store';
import { createComponent, render } from 'solid-js/web';
import { ActivePics, ImageResults, ImageUpload, PicsExplorer } from 'views/images';

const NAME = 'Picsake';
const LANG = 'psk';
const ICON = 'images';


type MyStore = {
	activeFile: TFile | null,
};

function getCodeSections(fileCache: CachedMetadata): SectionCache[] {
	if (!fileCache.sections) return [];
	return fileCache.sections.filter(section => section.type === 'code');
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Remember to rename these classes and interfaces!

interface MySettings {
	mySetting: string;
	mySetting2: number;
	// helpers
	uploadImagesOnPaste: boolean;
	gjako: GjakoConfig;
}

const DEFAULT_SETTINGS: MySettings = {
	mySetting: 'default',
	mySetting2: 42,
	uploadImagesOnPaste: false,
	gjako: gjako.DEFAULT_CONFIG,
}

export default class MyPlugin extends Plugin {
	settings!: MySettings;

	// Solid stuff
	store!: MyStore;
	private setStore!: SetStoreFunction<MyStore>;
	private disposeEffect!: () => void;

	async onload() {
		const start = performance.now();

		const [store, setStore] = createStore<MyStore>({
			activeFile: null,
		});
		// eslint-disable-next-line solid/reactivity
		this.store = store;
		this.setStore = setStore;

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

		// Important: this is where we do stuff on startup, w/o slowing down Obsidian startup
		this.app.workspace.onLayoutReady(async () => {
			const start = performance.now();

			// new Notice('Workspace layout is ready!');

			this.setStore('activeFile', this.app.workspace.getActiveFile());

			const mdFiles = this.app.vault.getMarkdownFiles();
			for (const mdFile of mdFiles) {
				const fileCache = this.app.metadataCache.getFileCache(mdFile);
				if (!fileCache) continue;

				// const codeSections = getCodeSections(fileCache);
				// if (codeSections.length === 0) continue; // avoid `cachedRead` of the file if we know it contains no code blocks!

				// const fileContent = await this.app.vault.cachedRead(mdFile);
			}

			// await delay(500);

			this.openActivePicsView(false);

			const finish = performance.now();
			console.log(`[${NAME}] onLayoutReady: ${(finish - start).toFixed(1)} ms`);
		});

		// Note: This is not called when a file is renamed for performance reasons. You must hook the vault rename event for those.
		this.registerEvent(this.app.metadataCache.on('changed', this.onFileCacheChanged, this));

		this.registerEvent(this.app.vault.on('rename', this.onFileRename, this));
		this.registerEvent(this.app.vault.on('delete', this.onFileDelete, this));

		this.registerEvent(this.app.workspace.on('file-open', this.onActivateFile, this));

		this.registerEvent(this.app.workspace.on('editor-paste', this.onPaste, this));

		this.registerMarkdownCodeBlockProcessor(LANG, (blockText, container, ctx) => {
			const info = JSON.parse(blockText);
			if (Object.hasOwn(info, 'images')) {
				const images: ImageInfo[] = info.images;
				render(() => createComponent(ImageResults, { images }), container);
			}
		});

		await this.loadSettings();

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

			// const noteletsCount = createMemo(() => Object.values(this.store.notelets).map(l => l.length).reduce((acc, n) => acc + n, 0));
			// createEffect(() => {
			// 	statusBarItemEl.setText(`${noteletsCount()} notelets`);
			// });
			const picsCount = 0;
			statusBarItemEl.setText(`${picsCount} pics`);
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

				const canRunCommand = this.store.activeFile !== null;
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

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		const finish = performance.now();
		console.log(`[${NAME}] onload: ${(finish - start).toFixed(1)} ms`);
	}

	onunload() {
		const start = performance.now();

		this.disposeEffect();

		// Have to manually reset the flag on plugin unload to shut up Solid,
		// o/w when we reload the plugin, Solid sees this singleton flag already set, triggering a false positive:
		// console.warn("You appear to have multiple instances of Solid. This can lead to unexpected behavior.")
		if (globalThis.Solid$$) globalThis.Solid$$ = false;

		const finish = performance.now();
		console.log(`[${NAME}] onunload: ${(finish - start).toFixed(1)} ms`);
	}

	// Note: this is also called on file creation!
	onFileCacheChanged(file: TFile, newContent: string, cache: CachedMetadata) {
		// const notelets = extractNoteletsFromFile(file, newContent, cache);
		// if (notelets.length > 0) {
		// 	this.setStore('notelets', file.path, notelets);
		// } else {
		// 	this.setStore('notelets', produce(notelets => {
		// 		delete notelets[file.path];
		// 	}));
		// }
	}

	onFileRename(file: TAbstractFile, oldPath: string) {
		// const oldNotelets = this.store.notelets[oldPath];
		// if (!oldNotelets || oldNotelets.length === 0) return;

		// this.setStore('notelets', produce(notelets => {
		// 	delete notelets[oldPath];
		// 	notelets[file.path] = oldNotelets;
		// }));

		// new Notice(`${oldNotelets.length} notelets moved from ${oldPath} to ${file.path}`);
	}

	onFileDelete(file: TAbstractFile) {
		// const oldNotelets = this.store.notelets[file.path];
		// if (!oldNotelets) return;

		// this.setStore('notelets', produce(notelets => {
		// 	delete notelets[file.path];
		// }));

		// new Notice(`${oldNotelets.length} notelets deleted from ${file.path}`);
	}

	onActivateFile(file: TFile | null) {
		// new Notice(`Activated ${file?.name}`);
		this.setStore('activeFile', file);
	}

	onPaste(evt: ClipboardEvent, editor: Editor) {
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
						const infoBlock = `\`\`\`${LANG}\n${JSON.stringify({ images: res }, null, '\t')}\n\`\`\``;
						const imgMarkdown = res.map(info => `![${LANG} ${info.name}](${info.url})`).join('\n\n');
						editor.replaceSelection(`${infoBlock}\n\n${imgMarkdown}`);
					},
					onCancel: () => { new Notice('No action is taken'); }
				}
			).open();
		}
	}

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

	async openActivePicsView(show: boolean) {
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

	async openPicsExplorerView() {
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
}

const VIEW_TYPE_ACTIVE_PICS = 'psk-view-active-pics';

class ActivePicsView extends ItemView {
	plugin: MyPlugin;

	// Solid stuff
	private dispose!: () => void;
	private disposeEffect!: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.icon = ICON;
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ACTIVE_PICS;
	}

	getDisplayText(): string {
		return 'Active pics view';
	}

	async onOpen() {
		const { contentEl } = this;

		const title = contentEl.createEl('h4');

		createRoot((dispose) => {
			this.disposeEffect = dispose;

			createEffect(() => {
				title.setText(`${this.plugin.store.activeFile?.name}`);
			});
		});

		this.dispose = render(() => {
			// const activeNotelets = createMemo(() => {
			// 	const activeFile = this.plugin.store.activeFile;
			// 	return activeFile
			// 		? this.plugin.store.notelets[activeFile.path] ?? []
			// 		: []
			// });
			// return createComponent(MarkdownContextProvider, {
			// 	app: this.plugin.app,
			// 	component: this,
			// 	sourcePath: this.plugin.store.activeFile?.path ?? '',
			// 	get children() {
			// 		return createComponent(ActiveNotelets, { activeNotelets });
			// 	}
			// });
			return createComponent(ActivePics, {});
		}, contentEl);
	}

	async onClose() {
		this.dispose();
		this.disposeEffect();
	}
}

const VIEW_TYPE_PICS_EXPLORER = 'psk-view-pics-explorer';

class PicsExplorerView extends ItemView {
	plugin: MyPlugin;

	// Solid stuff
	private dispose!: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
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
			// const notelets = this.plugin.store.notelets;
			return createComponent(PicsExplorer, {});
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

		let isPhoto = false;
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
			.setName('Setting #1')
			.setDesc('It\'s a secret.')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(settings.mySetting)
				.onChange(async (value) => {
					settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Setting #2')
			.setDesc('It\'s a duh.')
			.addText(text => text
				.setPlaceholder('Enter your thing')
				.setValue(String(settings.mySetting2))
				.onChange(async (value) => {
					settings.mySetting2 = Number(value);
					await this.plugin.saveSettings();
				}));

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
