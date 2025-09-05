import { TFile } from 'obsidian';

export { isImageUrl };
export type { Picture, PicturesByPath };

type Picture = {
	url: string,
	description: string,
	file: TFile,
};

type PicturesByPath = { [key: string]: Picture[] };

function isImageUrl(url: string) {
	const regex = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
	return regex.test(url);
}
