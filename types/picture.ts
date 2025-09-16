
export { imageFormatFromLink, isImageLink };
export type { CSSDimensions, Dimensions, Picture, PicturesByPath };

type Picture = {
	url: string,
	description: string,
};

type Dimensions = {
	width: number,
	height: number,
};

type CSSDimensions = {
	width: string,
	height: string,
};

type PicturesByPath = { [key: string]: Picture[] };

const IMAGE_EXT_LIST = [
	'avif',
	'gif',
	'jpeg',
	'jpg',
	'png',
	'svg',
	'webp',
];

function isImageLink(link: string) {
	// const regex = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
	// return regex.test(link);
	const ext = extFromLink(link);
	if (!ext) return false;
	return IMAGE_EXT_LIST.contains(ext);
}

function imageFormatFromLink(link: string): string | null {
	const ext = extFromLink(link);
	if (ext === 'jpg') return 'jpeg';
	return ext;
}

function extFromLink(link: string): string | null {
	if (!link.contains('.')) return null;
	const ext = link.split('.').pop()?.split(/[#?]/)[0];
	if (!ext) return null;
	return ext.toLowerCase();
}