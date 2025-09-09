
export { isImageLink };
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
