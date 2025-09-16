
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

export { uploadImages };
export default { uploadImages, DEFAULT_CONFIG };
