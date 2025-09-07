import { ImageInfo } from 'services/gjako';
import { Accessor, createMemo, For, Setter, Show } from 'solid-js';
import { Picture } from 'types/picture';

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
						<img class="thumbnail" src={image.url} />
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
}) {
	const pictureInFocus = createMemo(() => {
		const index = props.galleryFocus();
		const picture = index !== null
			? props.gallery().at(index) ?? null
			: null;
		return picture;
	});
	return (
		<Show when={pictureInFocus() !== null}>
			<div id="psk-gallery" class="fixed inset-0 flex-center" onClick={() => props.setGalleryFocus(null)}>
				<img class="infocus" src={pictureInFocus()?.url} alt={pictureInFocus()?.description} />
			</div>
		</Show>
	);
}