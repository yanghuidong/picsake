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
}) {
	return (
		<>
			<div>{props.activePictures().length} pictures</div>
			<For each={props.activePictures()}>
				{picture => (
					<img src={picture.url} alt={picture.description} />
				)}
			</For>
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
	galleryZoom: Accessor<number | null>,
	setGalleryZoom: Setter<number | null>,
	translateY: Accessor<number | null>,
	setTranslateY: Setter<number | null>,
}) {
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
						props.setGalleryZoom(1);
					} else if (evt.key === 'f') {
						props.setGalleryZoom(null);
					} else if (evt.key === '=') {
						props.setGalleryZoom((prev) => prev !== null ? prev + 0.05 : 1);
					} else if (evt.key === '-') {
						props.setGalleryZoom((prev) => prev !== null ? prev - 0.05 : 1);
					} else if (evt.key === 'w') {
						props.setTranslateY((prev) => prev !== null ? prev - 40 : 0);
					}
				}}
			>
				<Image />
			</div>
		);
	};

	const Image = () => {
		const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 0, height: 0 });

		const zoomDimensions = createMemo<CSSDimensions>(() => {
			const zoom = props.galleryZoom();
			return {
				width: zoom === null ? '100%' : `${dimensions().width * zoom}px`,
				height: zoom === null ? '100%' : `${dimensions().height * zoom}px`,
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

		onMount(() => {
			if (imgRef.complete) {
				setDimensionsToNatural();
			} else {
				imgRef.onload = setDimensionsToNatural;
			}
		});

		createEffect(() => {
			if (pictureInFocus()) setDimensionsToNatural();
		})

		return (
			<div
				class="absolute"
				style={{
					width: `${zoomDimensions().width}`,
					height: `${zoomDimensions().height}`,
					transform: `translateY(${props.translateY()}px)`
				}}
				onClick={(evt) => {
					evt.stopPropagation(); // no need for stopImmediatePropagation() to prevent GalleryContent onClick
				}}
			>
				<div
					class="zebra absolute w-full h-full"
				/>
				<img ref={imgRef}
					class="relative w-full h-full object-contain"
					src={pictureInFocus()?.url}
					alt={pictureInFocus()?.description}
				/>
			</div>
		);
	};

	return (
		<Show when={pictureInFocus() !== null}>
			<GalleryContent />
		</Show>
	);
}