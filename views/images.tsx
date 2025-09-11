import { TFile } from 'obsidian';
import { ImageInfo } from 'services/gjako';
import { Accessor, createEffect, createMemo, createSignal, For, onMount, Setter, Show } from 'solid-js';
import { CSSDimensions, Dimensions, Picture, PicturesByPath } from 'types/picture';

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
		<div class="image-grid-4">
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

export function ImageResults(props: {
	images: ImageInfo[]
}) {
	return (
		<div class="column column-spacing-sm">
			<For each={props.images}>
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
			<h4>{props.activeFile()?.name}</h4>
			<div class="my-xs">{props.activePictures().length} pictures</div>
			<div class="image-grid-2">
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
	setGallery: Setter<Picture[]>,
	setGalleryFocus: Setter<number | null>,
}) {
	const allPictures = createMemo(() => {
		const list: Picture[] = [];
		const urlSet = new Set<string>();
		for (const pictures of Object.values(props.pictures)) {
			for (const pic of pictures) {
				if (!urlSet.has(pic.url)) {
					list.push(pic);
					urlSet.add(pic.url);
				}
			}
		}
		return list;
	});

	const sourcePathsDict = createMemo(() => {
		const dict: { [key: string]: string[] } = {};
		for (const [path, pictures] of Object.entries(props.pictures)) {
			for (const pic of pictures) {
				const existing = dict[pic.url];
				if (existing === undefined) {
					dict[pic.url] = [path];
				} else {
					dict[pic.url] = [...existing, path];
				}
			}
		}
		return dict;
	});

	return (
		<>
			<div class="image-grid-4">
				<For each={allPictures()}>
					{(pic, idx) => (
						<img
							src={pic.url}
							alt={pic.description}
							onClick={() => {
								props.setGallery(allPictures());
								props.setGalleryFocus(idx());
							}}
						/>
					)}
				</For>
			</div>
		</>
	);
}

export function Gallery(props: {
	gallery: Accessor<Picture[]>,
	galleryFocus: Accessor<number | null>,
	setGalleryFocus: Setter<number | null>,
	galleryFit: Accessor<boolean>,
	setGalleryFit: Setter<boolean>,
	galleryZoom: Accessor<number>,
	setGalleryZoom: Setter<number>,
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

	const GalleryContent = () => {
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
					props.setGalleryFocus(null);
				}}
				onKeyDown={(evt) => {
					evt.preventDefault();
					// evt.stopImmediatePropagation();
					if (evt.key === 'Escape') {
						props.setGalleryFocus(null);
					} else if (evt.key === 'ArrowRight') {
						// Note: need to store the snapshot in a variable, else if calling the accessor directly inside the setter, we'll get a warning from solid eslint plugin!
						const pictureCount = props.gallery().length;
						props.setGalleryFocus((curr) => {
							if (curr !== null) {
								const next = curr + 1;
								if (next >= pictureCount) {
									return 0;
								} else {
									return next;
								}
							} else {
								return null;
							}
						});
					} else if (evt.key === 'ArrowLeft') {
						const pictureCount = props.gallery().length;
						props.setGalleryFocus((curr) => {
							if (curr !== null) {
								const prev = curr - 1;
								if (prev < 0) {
									return pictureCount - 1;
								} else {
									return prev;
								}
							} else {
								return null;
							}
						});
					} else if (evt.key === 'o' || evt.key === '0' || evt.key === '1') {
						props.setGalleryFit(false);
						props.setGalleryZoom(1);
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
					} else if (evt.key === 'q') {
						props.setTranslateX(0);
						props.setTranslateY(0);
					}
				}}
			>
				<Image />
				<InfoBar />
			</div>
		);
	};

	const Image = () => {
		const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 0, height: 0 });

		const dimensionsByMode = createMemo<CSSDimensions>(() => {
			const fitMode = props.galleryFit();
			return {
				width: fitMode ? '100%' : `${dimensions().width}px`,
				height: fitMode ? '100%' : `${dimensions().height}px`,
			};
		});

		let imgRef!: HTMLImageElement;

		const dpr = window.devicePixelRatio;
		const setDimensionsToNatural = () => {
			setDimensions({
				width: imgRef.naturalWidth / dpr,
				height: imgRef.naturalHeight / dpr,
			});
		};

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
			if (pictureInFocus()) setDimensionsToNatural();
		})

		return (
			<div
				// for zebra child positioning, relative would be enough;
				// but absolute is necessary for zooming, because we need it to expand beyond the confinement of the parent, #psk-gallery
				class="absolute"
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
			>
				{/* zebra has to be absolute to not get in the way of the image,
				the image has to be explicitly positioned in order to stay on top of the zebra (relative is the weakest explicitness we can give)
				*/}
				<div class="zebra absolute w-full h-full" />
				<img ref={imgRef}
					class="relative w-full h-full object-contain"
					src={pictureInFocus()?.url}
					alt={pictureInFocus()?.description}
				/>
			</div>
		);
	};

	const InfoBar = () => {
		const progress = createMemo(() => {
			const index = props.galleryFocus();
			const total = props.gallery().length;
			return index !== null ? (index + 1) / total : 0;
		});

		return (
			<div
				class="infobar hoverbar absolute bottom-0 w-full flex-center"
				onClick={(evt) => {
					evt.stopPropagation();
				}}
			>
				<div
					class="progressbar relative"
				>
					<div
						class="absolute inset-0"
						style={{
							'transform': `scaleX(${progress()})`,
							'transform-origin': 'left center',
							'transition': 'transform 0.5s ease',
						}}
					/>
				</div>
			</div>
		);
	};

	return (
		<Show when={pictureInFocus() !== null}>
			<GalleryContent />
		</Show>
	);
}