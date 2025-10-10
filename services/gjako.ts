import { Thumbnail } from 'types/picture';

export type UploadResult = {
	name: string,
	size: number,
	origSize: number,
	format: string,
	width: number,
	height: number,
	url: string,
};

async function uploadImages(files: Iterable<File>, isPhoto: boolean, subDir: string, config: GjakoConfig): Promise<UploadResult[]> {
	const formData = new FormData();
	for (const file of files) {
		formData.append('file', file);
	}

	formData.append('photo', String(isPhoto));

	const dir = subDir.length > 0 ? `${config.dir}/${subDir}` : config.dir;
	formData.append('dir', dir);

	const apiEndpoint = `${config.urlPrefix.replace(/\/+$/, '')}/upload`;
	const res = await fetch(apiEndpoint, {
		method: 'POST',
		headers: {
			'X-API-Key': config.apiKey,
		},
		body: formData,
	});
	if (res.ok) {
		const data = await res.json();
		return data as UploadResult[];
	} else {
		throw new Error(`HTTP ${res.status}: ${res.statusText}`);
	}
}

async function makeThumbnail(url: string): Promise<Thumbnail> {
	// TODO!
	const DATA_URL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath d="M21 15c0 3.313-2.687 6-6 6H9c-3.313 0-6-2.687-6-6V9c0-3.313 2.687-6 6-6h6c3.313 0 6 2.687 6 6v6zM7 9h10v6H7V9z" fill="gray"/%3E%3C/svg%3E';
	return { id: url, data: DATA_URL };
}

export type GjakoConfig = {
	urlPrefix: string,
	apiKey: string,
	dir: string,
	subDirs: string[],
};

const DEFAULT_CONFIG: GjakoConfig = {
	urlPrefix: 'http://localhost:9159/api',
	apiKey: '',
	dir: 'pkm',
	subDirs: [],
}

export { makeThumbnail, uploadImages };
export default { uploadImages, makeThumbnail, DEFAULT_CONFIG };
