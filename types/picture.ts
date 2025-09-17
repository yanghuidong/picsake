import { UploadResult } from 'services/gjako';

export { imageFormatFromLink, isImageLink, shouldExcludePicture };
export type { Annotation, AnnotationsByURL, CSSDimensions, Dimensions, GlobalPicture, Picture, PicturesByPath, UploadResultDict };

type Picture = {
	url: string,
	description: string,
};

type GlobalPicture = {
	url: string,
	description: string,
	sourcePaths: string[],
};

function shouldExcludePicture(pic: GlobalPicture, excludePaths: string[], alwaysInclude: boolean): boolean {
	function shouldExcludeByPath(path: string): boolean {
		return excludePaths.some(exclude => {
			return path.startsWith(exclude);
		});
	}

	if (alwaysInclude) return false;
	if (pic.description.startsWith('//')) return true;
	if (pic.sourcePaths.some(path => shouldExcludeByPath(path))) return true;
	return false;
}

type Annotation = {
	url: string,
	filePath: string,
	note: string,
	// tags, groups, flags, even visual effects and processing, etc
};

type PicturesByPath = { [key: string]: Picture[] };

type UploadResultDict = { [key: string]: UploadResult };

type AnnotationsByURL = { [key: string]: Annotation[] };

type Dimensions = {
	width: number,
	height: number,
};

type CSSDimensions = {
	width: string,
	height: string,
};

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