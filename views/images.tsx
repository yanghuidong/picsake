import { ImageInfo } from 'services/gjako';
import { Accessor, createMemo, createSignal, For, onMount, Setter, Show } from 'solid-js';
import { CSSDimensions, Dimensions, Picture } from 'types/picture';
import { debugLog } from 'utils/debug';

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

export function PicsExplorer() {
	return (
		<></>
	);
}

export function Gallery(props: {
	gallery: Accessor<Picture[]>,
	galleryFocus: Accessor<number | null>,
	setGalleryFocus: Setter<number | null>,
	galleryZoom: Accessor<number | null>,
	setGalleryZoom: Setter<number | null>,
}) {
	const pictureInFocus = createMemo(() => {
		const index = props.galleryFocus();
		const picture = index !== null
			? props.gallery().at(index) ?? null
			: null;
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
				onClick={() => props.setGalleryFocus(null)}
				onKeyDown={(evt) => {
					evt.preventDefault();
					// evt.stopImmediatePropagation();
					if (evt.key === 'Escape') {
						props.setGalleryFocus(null);
					} else if (evt.key === 'ArrowRight') {
						// Note: need to store the snapshot in a variable, else if calling the accessor directly inside the setter, we'll get a warning from solid eslint plugin!
						const pictureCount = props.gallery().length;
						debugLog({ pictureCount });
						props.setGalleryFocus((prev) => {
							debugLog({ prev });
							if (prev !== null) {
								const next = prev + 1;
								if (next >= pictureCount) {
									return 0;
								} else {
									return next;
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

		const setDimensionsToNatural = () => {
			const dpr = window.devicePixelRatio;
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

		return (
			<img ref={imgRef}
				class="infocus"
				src={pictureInFocus()?.url}
				alt={pictureInFocus()?.description}
				style={{
					'object-fit': 'contain',
					width: `${zoomDimensions().width}`,
					height: `${zoomDimensions().height}`,
				}}
			/>
		);
	};

	return (
		<Show when={pictureInFocus() !== null}>
			<GalleryContent />
		</Show>
	);
}