import { App, Notice, TFile } from 'obsidian';
import { UploadResult } from 'services/gjako';
import { Accessor, createEffect, createMemo, createSignal, For, onMount, Setter, Show } from 'solid-js';
import { CSSDimensions, Dimensions, GlobalPicture, imageFormatFromLink, parseDescription, Picture, PicturesByPath, PictureSource, shouldExcludePicture, toHaystack, toLocalPicture } from 'types/picture';
import { IconButton, IconToggle, InlineIcon } from 'views/icons';

export function ImageUpload(props: {
	images: File[],
	selected: Accessor<Set<File>>,
	setSelected: Setter<Set<File>>
}) {
	function isSelected(file: File): boolean {
		return props.selected().has(file);
	}
	function toggle(file: File) {
		props.setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(file)) next.delete(file);
			else next.add(file);
			return next;
		});
	}

	return (
		<div class="imageGrid-4">
			<For each={props.images}>
				{(image) => (
					<div class="column">
						<div
							classList={{ 'selected': isSelected(image) }}
							onClick={[toggle, image]}>
							<img src={URL.createObjectURL(image)} />
						</div>

						<div class="caption">
							{image.name}
						</div>
					</div>
				)}
			</For>
		</div>
	);
}

export function UploadResultSummary(props: {
	uploads: UploadResult[]
}) {
	return (
		<div class="column column-spacing-sm">
			<For each={props.uploads}>
				{image => (
					<div class="row row-spacing-sm">
						<img class="psk-thumbnail" src={image.url} />
						<table>
							<tbody>
								<tr><th>Image dimensions</th><td>{image.width} × {image.height}</td></tr>
								<tr><th>Original size</th><td>{(image.origSize / 1000).toFixed(1)} KB</td></tr>
								<tr><th>Final size</th><td>{(image.size / 1000).toFixed(1)} KB</td></tr>
								<tr><th>Size reduction</th><td>{((image.origSize - image.size) / image.origSize * 100).toFixed(1)}%</td></tr>
							</tbody>
						</table>
					</div>
				)}
			</For>
		</div>
	);
}

export function ActivePics(props: {
	activePictures: Accessor<Picture[]>,
	activeFile: Accessor<TFile | null>,
	setGallery: Setter<Picture[]>,
	setGalleryFocus: Setter<number | null>,
}) {
	return (
		<>
			{/* <h4>{props.activeFile()?.name}</h4> */}
			<div class="my-xs">{props.activePictures().length} pictures</div>
			<div class="imageGrid-2">
				<For each={props.activePictures()}>
					{(pic, idx) => (
						<img
							src={pic.url}
							alt={pic.description}
							onClick={() => {
								props.setGallery(props.activePictures());
								props.setGalleryFocus(idx());
							}}
						/>
					)}
				</For>
			</div>
		</>
	);
}

export function PicsExplorer(props: {
	pictures: PicturesByPath,
	excludePaths: Accessor<string[]>,
	pageSize: Accessor<number | null>,
	setGallery: Setter<Picture[]>,
	setGalleryFocus: Setter<number | null>,
	fts: (query: string) => Promise<string[]>,
	app: App,
}) {
	const [revealExcluded, setRevealExcluded] = createSignal<boolean>(false);

	const [query, setQuery] = createSignal<string>('');

	const [searchResults, setSearchResults] = createSignal<GlobalPicture[] | null>(null);

	const [ftsMode, setFtsMode] = createSignal<boolean>(false);

	const [pageIndex, setPageIndex] = createSignal<number>(0);

	const sourcesDict = createMemo(() => {
		const dict: { [key: string]: PictureSource[] } = {};
		for (const [path, pictures] of Object.entries(props.pictures)) {
			for (const pic of pictures) {
				const source = { filePath: path, description: pic.description };
				const existing = dict[pic.url];
				if (existing === undefined) {
					dict[pic.url] = [source];
				} else {
					dict[pic.url] = [...existing, source];
				}
			}
		}
		return dict;
	});

	const allPictures = createMemo(() => {
		const list: GlobalPicture[] = [];
		const urlSet = new Set<string>();
		for (const pictures of Object.values(props.pictures)) {
			for (const pic of pictures) {
				if (!urlSet.has(pic.url)) {
					const sources = sourcesDict()[pic.url] ?? [];
					const globalPic = { ...pic, sources };
					list.push(globalPic);
					urlSet.add(pic.url);
				}
			}
		}
		return list.filter(pic => !shouldExcludePicture(pic, props.excludePaths(), revealExcluded()));
	});

	const shownAllPictures = createMemo(() => {
		const hits = searchResults();
		return hits !== null
			? hits
			: allPictures();
	});

	const shownPictures = createMemo(() => {
		const shownAll = shownAllPictures();

		const pageSize = props.pageSize();
		if (pageSize === null) return shownAll;

		const start = pageIndex() * pageSize;
		const end = start + pageSize;
		const shownPage = shownAll.slice(start, end);
		return shownPage;
	});

	const showingSearchResults = createMemo(() => {
		return searchResults() !== null;
	});

	return (
		<>
			<div
				class="SearchBar row row-spacing-sm flex-center"
			>
				<div
					class="SearchBox relative row"
				>
					<input
						class="w-full h-full"
						type="search"
						value={query()}
						onInput={(evt) => {
							const str = evt.target.value;
							setQuery(str);
						}}
						onKeyUp={async (evt) => {
							if (evt.key === 'Enter') {
								const needle = query().trim().toLowerCase();
								if (needle === '') {
									setSearchResults(null);
								} else {
									let ftsMatchedPaths: string[] | null = null;
									if (evt.shiftKey) {
										setFtsMode(true);
										ftsMatchedPaths = await props.fts(needle);
									} else {
										setFtsMode(false);
									}

									const res = allPictures().filter(pic => {
										const haystack = toHaystack(pic);
										const quickMatch = haystack.contains(needle);

										const ftsMatch = ftsMatchedPaths !== null
											? pic.sources.map(src => src.filePath).some(path => ftsMatchedPaths.contains(path))
											: false;

										return quickMatch || ftsMatch;
									});

									setSearchResults(res);
								}
								// Note: must reset page index!
								setPageIndex(0);
							}
						}}
					/>
					<IconButton name="x"
						class="ClearSearch absolute right-0 flex-center"
						classList={{ 'hidden': !showingSearchResults() }}
						enabled={showingSearchResults}
						onClick={() => {
							setQuery('');
							setSearchResults(null);
							setPageIndex(0);
						}}
					/>
				</div>
				<IconToggle onIcon="eye" offIcon="eye-off"
					class="RevealToggle"
					state={revealExcluded}
					setState={setRevealExcluded}
				/>
			</div>
			<Show when={searchResults()}>
				{results =>
					<div
						class="SearchHitsInfo"
						classList={{ 'ZeroHit': results().length === 0 }}
					>
						<InlineIcon name={results().length > 0 ? 'circle-check-big' : 'circle-minus'} />
						Found <strong>{results().length}</strong> pictures via{' '}
						<em>{ftsMode() ? 'full-text' : 'quick'}</em>{' '}
						search.
						<Show when={!ftsMode()}>
							<span class="Tip">
								<InlineIcon name="info" />
								Use <kbd>Shift</kbd>+<kbd>Enter</kbd> to enable full-text search.
							</span>
						</Show>
					</div>
				}
			</Show>
			<div class="imageGrid">
				<For each={shownPictures()}>
					{(pic, idx) => (
						<div
							class="Thumbnail gridCell parent relative"
							classList={{ 'LocalFile': pic.localPath !== null }}
						>
							<img
								src={pic.url}
								alt={pic.sources[0]?.description}
								// We handle click here instead of on the parent so that sibling HoverButtons don't have to stopPropagation. Plus, better semantics.
								onClick={() => {
									props.setGallery(shownAllPictures().map(toLocalPicture));
									props.setGalleryFocus(idx() + (props.pageSize() ?? 0) * pageIndex());
								}}
							/>
							<div
								class="HoverButtonGroup showOnParentHover absolute top-0 right-0 row row-spacing-2xs"
							>
								<IconButton name="link"
									class="HoverButton"
									enabled={() => true}
									onClick={(evt) => {
										const copyContent = pic.localPath === null ? pic.url : pic.localPath;
										navigator.clipboard.writeText(copyContent)
											.then(() => new Notice(`Copied to clipboard: ${copyContent}`))
											.catch((err) => new Notice(`Failed to copy to clipboard: ${err}`));
									}}
								/>
								<IconButton name="notebook-text"
									class="HoverButton"
									enabled={() => true}
									onClick={(evt) => {
										// TODO 1) handle multi-source case, 2) Cmd+click to open in a new tab (with reuse)
										const source = pic.sources[0];
										if (source) {
											const file = props.app.vault.getFileByPath(source.filePath);
											if (file) {
												const currLeaf = props.app.workspace.getLeaf(false);
												currLeaf.openFile(file);
											}
										}
									}}
								/>
							</div>
						</div>
					)}
				</For>
			</div>
			<Paginator />
		</>
	);

	function Paginator() {
		const pageCount = createMemo(() => {
			const total = shownAllPictures().length;
			const pageSize = props.pageSize();

			if (pageSize === null) return null; // 0 (falsy) would work as well, but confusing

			return Math.ceil(total / pageSize);
		});

		return (
			<Show when={pageCount()}>
				{count =>
					<div
						class="Paginator row row-spacing-sm flex-center"
					>
						<IconButton name="chevron-left"
							enabled={() => pageIndex() > 0}
							onClick={() => {
								setPageIndex(prev => prev - 1);
							}}
						/>
						<div>{`${pageIndex() + 1} / ${count()}`}</div>
						<IconButton name="chevron-right"
							enabled={() => pageIndex() < count() - 1}
							onClick={() => {
								setPageIndex(prev => prev + 1);
							}}
						/>
					</div>
				}
			</Show>
		);
	}
}

export function Gallery(props: {
	gallery: Accessor<Picture[]>,
	galleryFocus: Accessor<number | null>,
	setGalleryFocus: Setter<number | null>,
	galleryFit: Accessor<boolean>,
	setGalleryFit: Setter<boolean>,
	galleryZoom: Accessor<number>,
	setGalleryZoom: Setter<number>,
	showPicDescription: Accessor<boolean>,
	setShowPicDescription: Setter<boolean>,
	translateX: Accessor<number>,
	setTranslateX: Setter<number>,
	translateY: Accessor<number>,
	setTranslateY: Setter<number>,
}) {
	const PAN_STEP: number = 40; // px
	const ZOOM_STEP: number = 0.05; // fraction

	const pictureInFocus = createMemo(() => {
		const index = props.galleryFocus();
		const picture = index !== null
			? props.gallery().at(index) ?? null
			: null;
		// debugLog({ picture });
		return picture;
	});

	const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 0, height: 0 });

	// Note: the semantics of `moveStart` not only tracks the coordinates,
	// but also serves as a flag similar to a Boolean `isDraggingImage`
	const [moveStart, setMoveStart] = createSignal<{ x: number, y: number } | null>(null);

	return (
		<Show when={pictureInFocus()}>
			{pic => <GalleryContent mainPic={pic} />}
		</Show>
	);

	function GalleryContent(myProps: {
		mainPic: Accessor<Picture>,
	}) {
		let modalRef!: HTMLDivElement;

		onMount(() => {
			modalRef.focus();
		});

		return (
			<div ref={modalRef}
				id="psk-gallery"
				class="fixed inset-0 flex-center"
				tabindex="-1"
				onClick={(evt) => {
					evt.stopImmediatePropagation(); // stopPropagation() won't prevent `MyPlugin.onClickDocument`
					// Note: if image dragging (pointer move) is fast enough, it can escape the Image div and land here on the parent,
					// and on pointer up, this click event on the parent will fire! (Browser idiosyncrasy)
					if (moveStart() !== null) {
						setMoveStart(null);
						return;
					}
					props.setGalleryFocus(null);
					// console.log('gallery modal clicked');
				}}
				onKeyDown={(evt) => {
					evt.preventDefault();
					// evt.stopImmediatePropagation();
					if (evt.key === 'Escape' || evt.key === 'q') {
						props.setGalleryFocus(null);
					} else if (evt.key === 'ArrowRight' || evt.key === ' ') {
						// Note: need to store the snapshot in a variable, else if calling the accessor directly inside the setter, we'll get a warning from solid eslint plugin!
						const pictureCount = props.gallery().length;
						props.setGalleryFocus((prev) => {
							if (prev !== null) {
								const curr = prev + 1;
								if (curr >= pictureCount) {
									return 0;
								} else {
									return curr;
								}
							} else {
								return null;
							}
						});
					} else if (evt.key === 'ArrowLeft' || evt.key === 'Backspace') {
						const pictureCount = props.gallery().length;
						props.setGalleryFocus((prev) => {
							if (prev !== null) {
								const curr = prev - 1;
								if (curr < 0) {
									return pictureCount - 1;
								} else {
									return curr;
								}
							} else {
								return null;
							}
						});
					} else if (evt.key === 'o' || evt.key === '0' || evt.key === '1') {
						props.setGalleryFit(false);
						props.setGalleryZoom(1);
					} else if (evt.key === '2') {
						props.setGalleryFit(false);
						props.setGalleryZoom(2);
					} else if (evt.key === 'f') {
						props.setGalleryFit(true);
						props.setGalleryZoom(1);
					} else if (evt.key === '=') {
						props.setGalleryZoom((prev) => prev + ZOOM_STEP);
					} else if (evt.key === '-') {
						props.setGalleryZoom((prev) => prev > ZOOM_STEP ? prev - ZOOM_STEP : prev);
					} else if (evt.key === 'w') {
						props.setTranslateY((prev) => prev - PAN_STEP);
					} else if (evt.key === 's') {
						props.setTranslateY((prev) => prev + PAN_STEP);
					} else if (evt.key === 'a') {
						props.setTranslateX((prev) => prev - PAN_STEP);
					} else if (evt.key === 'd') {
						props.setTranslateX((prev) => prev + PAN_STEP);
					} else if (evt.key === 'r') {
						props.setTranslateX(0);
						props.setTranslateY(0);
					} else if (evt.key === 'i') {
						props.setShowPicDescription(prev => !prev);
					}
				}}
			>
				<Image />
				<PicDescription />
				<InfoBar />
			</div>
		);

		/// sub-views (children) of GalleryContent

		function Image() {
			const dimensionsByMode = createMemo<CSSDimensions>(() => {
				const fitMode = props.galleryFit();
				return {
					width: fitMode ? '100%' : `${dimensions().width}px`,
					height: fitMode ? '100%' : `${dimensions().height}px`,
				};
			});

			let imgRef!: HTMLImageElement;

			const dpr = window.devicePixelRatio;

			// Note: no need to do this one-time setup;
			// the effect below takes care of _reactively_ updating the dimensions signal
			// per each picture currently in focus
			// onMount(() => {
			// 	if (imgRef.complete) {
			// 		setDimensionsToNatural();
			// 	} else {
			// 		imgRef.onload = setDimensionsToNatural;
			// 	}
			// });

			// Note: this is necessary to ensure every image gets its natural dimensions as we navigate / switch from one to another;
			// we don't want the aspect ratio of the previous image to carry over to the current!
			createEffect(() => {
				myProps.mainPic(); // just for tracking, i.e. change of mainPic() should trigger setDimensions
				// setDimensionsToNatural()
				setDimensions({
					width: imgRef.naturalWidth / dpr,
					height: imgRef.naturalHeight / dpr,
				});
			})

			const onPointerMove = (evt: PointerEvent) => {
				const prevStart = moveStart();
				if (prevStart !== null) {
					setMoveStart({ x: evt.clientX, y: evt.clientY });
					const deltaX = evt.clientX - prevStart.x;
					const deltaY = evt.clientY - prevStart.y;
					props.setTranslateX(prev => prev + deltaX);
					props.setTranslateY(prev => prev + deltaY);
				}
			};

			const onPointerUp = (evt: PointerEvent) => {
				setMoveStart(null);

				window.removeEventListener('pointermove', onPointerMove);
				window.removeEventListener('pointerup', onPointerUp);
			};

			return (
				<div
					// for zebra child positioning, relative would be enough;
					// but absolute is necessary for zooming, because we need it to expand beyond the confinement of the parent, #psk-gallery
					class="absolute cursor-grab"
					classList={{ 'cursor-grabbing': moveStart() !== null }}
					style={{
						width: `${dimensionsByMode().width}`,
						height: `${dimensionsByMode().height}`,
						transform: `translate(${props.translateX()}px, ${props.translateY()}px) scale(${props.galleryZoom()})`,
					}}
					onClick={(evt) => {
						evt.stopPropagation(); // no need for stopImmediatePropagation() to prevent GalleryContent onClick
					}}
					onDblClick={(evt) => {
						evt.stopPropagation();
						props.setGalleryFocus(null);
					}}
					onPointerDown={(evt) => {
						// Must prevent the browser from changing the cursor to "grabbing" hand, o/w it'd get stuck even after pointer up;
						// Note however, this issue only manifests because we called preventDefault in the inner img's onDragStart handler!
						evt.preventDefault();
						setMoveStart({ x: evt.clientX, y: evt.clientY });

						// Note: when pointer moves fast enough, it can escape the Image region,
						// but we want the move handler to continue working even if that happens!
						window.addEventListener('pointermove', onPointerMove);
						window.addEventListener('pointerup', onPointerUp);
					}}
				// onPointerUp={(evt) => {
				// 	setMoveStart(null);
				// }}
				// onPointerMove={(evt) => {
				// 	const prevStart = moveStart();
				// 	if (prevStart !== null) {
				// 		setMoveStart({ x: evt.clientX, y: evt.clientY });
				// 		const deltaX = evt.clientX - prevStart.x;
				// 		const deltaY = evt.clientY - prevStart.y;
				// 		props.setTranslateX(prev => prev + deltaX);
				// 		props.setTranslateY(prev => prev + deltaY);
				// 	}
				// }}
				>
					{/* zebra has to be absolute to not get in the way of the image,
				the image has to be explicitly positioned in order to stay on top of the zebra (relative is the weakest explicitness we can give)
				*/}
					<div class="bgZebra absolute w-full h-full" />
					<img ref={imgRef}
						class="relative w-full h-full object-contain"
						src={myProps.mainPic().url}
						alt={myProps.mainPic().description}
						onDragStart={evt => {
							// Note: Obsidian has its own handler on this
							evt.preventDefault();
						}}
					/>
				</div>
			);
		}

		function PicDescription() {
			const parsed = createMemo(() => {
				const description = myProps.mainPic().description;
				return parseDescription(description);
			});

			return (
				<Show when={props.showPicDescription()}>
					<div
						class="PicDescription bg-blur absolute"
					>
						<Show when={parsed()} fallback={<div class="NoDescription">No description</div>}>
							{description => (
								<>
									<div class="Brief">{description().brief}</div>
									<Show when={description().detail}>
										{detail =>
											<div class="Detail">{detail()}</div>
										}
									</Show>
								</>
							)}
						</Show>
					</div>
				</Show>
			);
		}

		function InfoBar() {
			const [seeking, setSeeking] = createSignal<boolean>(false);
			const [seekPosition, setSeekPosition] = createSignal<number>(0);
			const [seekIndex, setSeekIndex] = createSignal<number | null>(null);

			const seekPicture = createMemo(() => {
				const index = seekIndex();
				return index !== null
					? props.gallery().at(index) ?? null
					: null;
			});

			// range: [0, 1]
			const progress = createMemo(() => {
				const index = props.galleryFocus();
				const total = props.gallery().length;
				return index !== null ? (index + 1) / total : 0;
			});

			const translateOccurred = createMemo(() => {
				return props.translateX() !== 0 || props.translateY() !== 0;
			});

			// helper
			const getOffsetXAndIndex = (rect: DOMRect, clientX: number, total: number) => {
				// Note: must bound offset between 0 and rect.width (inclusive)
				const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
				const fraction = offsetX / rect.width;
				const index = fraction < 1
					? Math.floor(total * fraction)
					: total - 1;
				return { offsetX, index };
			};

			return (
				<div
					class="InfoBar showOnHover absolute bottom-0 w-full flex-center"
					classList={{ 'hidden': moveStart() !== null }}
					onClick={(evt) => {
						evt.stopPropagation();
					}}
				>
					<div
						class="ProgressBar relative"
						classList={{ 'hidden': props.gallery().length < 2 }}
						style={{
							width: `${props.gallery().length * 50}px`,
						}}
						onClick={(evt) => {
							const rect = evt.currentTarget.getBoundingClientRect();
							const { index } = getOffsetXAndIndex(rect, evt.clientX, props.gallery().length);
							props.setGalleryFocus(index);
						}}
						onMouseEnter={() => {
							setSeeking(true);
						}}
						onMouseLeave={() => {
							setSeeking(false);
						}}
						onMouseMove={(evt) => {
							const rect = evt.currentTarget.getBoundingClientRect();
							const { offsetX, index } = getOffsetXAndIndex(rect, evt.clientX, props.gallery().length);
							setSeekPosition(offsetX);
							setSeekIndex(index);
						}}
					>
						<div
							// because we use transform: scaleX instead of setting width,
							// the border-radius of ProgressFill will be distorted; so we need masking
							class="ProgressMask absolute inset-0"
						>
							<div
								class="ProgressFill absolute inset-0"
								style={{
									'transform': `scaleX(${progress()})`,
									'transform-origin': 'left center',
								}}
							/>
						</div>
						<SeekPreview
							seeking={seeking}
							seekPosition={seekPosition}
							seekIndex={seekIndex}
							seekPicture={seekPicture}
						/>
					</div>
					<div
						class="ImageInfo absolute bottom-0"
					>
						<div
							class="ImageInfoBasic row row-spacing-sm bg-blur"
						>
							<div class="ImageFormatBadge">{imageFormatFromLink(myProps.mainPic().url)}</div>
							<div>{dimensions().width} × {dimensions().height}</div>
							<div
								class="ImageZoom"
								classList={{ 'active': props.galleryZoom() !== 1 }}
								onClick={() => {
									if (props.galleryZoom() !== 1) props.setGalleryZoom(1);
								}}
							>
								{(props.galleryZoom() * 100).toFixed(0)}%
							</div>
							<IconButton name="undo-2"
								class="GalleryIconButton"
								enabled={translateOccurred}
								onClick={() => {
									props.setTranslateX(0);
									props.setTranslateY(0);
								}}
							/>
							<IconButton name="info"
								class="GalleryIconButton"
								enabled={() => true}
								onClick={() => {
									props.setShowPicDescription(prev => !prev);
								}}
							/>
						</div>
					</div>
				</div>
			);
		}
	}
}

function SeekPreview(props: {
	seeking: Accessor<boolean>,
	seekPosition: Accessor<number>,
	seekIndex: Accessor<number | null>,
	seekPicture: Accessor<Picture | null>,
}) {
	// one-based index: string
	const seekNumber = createMemo(() => {
		const index = props.seekIndex();
		return index !== null
			? String(index + 1)
			: '';
	});

	return (
		<div
			class="SeekPreview absolute bottom-0 column column-spacing-xs"
			classList={{ 'hidden': !props.seeking() }}
			style={{
				transform: `translateX(${props.seekPosition()}px)`
			}}
		>
			<Show when={props.seekPicture()}>
				{pic => (
					// The purpose of PreviewPicturePlaceholder is such that even when the pointer enters
					// the _gap_ between the SeekBall and the PreviewPicture, the latter still stays in place,
					// because it has this nice wrapper that's "holding its place"!
					<div
						class="PreviewPicturePlaceholder absolute"
					>
						<div
							class="PreviewPicture absolute flex-center"
						>
							<img
								class="w-full h-full object-cover"
								src={pic().url}
								alt={pic().description}
							/>
							<div
								class="NumberBadge absolute flex-center"
							>
								{seekNumber()}
							</div>
						</div>
					</div>
				)}
			</Show>
			<div
				class="SeekBall"
			/>
		</div>
	);
};