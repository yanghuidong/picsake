
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

function isImageLink(link: string) {
	const regex = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
	return regex.test(link);
}

function imageFormatFromLink(link: string): string | null {
	// if (!isImageLink(link)) return null;
	const ext = link.split('.').pop()?.split(/[#?]/)[0];
	if (!ext) return null;
	if (ext === 'jpg') return 'jpeg';
	return ext;
}