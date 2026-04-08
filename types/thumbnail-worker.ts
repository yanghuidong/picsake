import type { GjakoConfig } from 'services/gjako';

export type ThumbnailWorkerRequest = {
	type: 'start',
	payload: {
		dbName: string,
		dbVersion: number,
		urls: string[],
		gjako: Pick<GjakoConfig, 'urlPrefix' | 'apiKey'>,
		concurrency: number,
	}
};

export type ThumbnailWorkerDone = {
	type: 'done',
	payload: {
		cachedCount: number,
		remoteCount: number,
		attempted: number,
		failed: string[],
	}
};

export type ThumbnailWorkerError = {
	type: 'error',
	payload: {
		error: string,
	}
};

export type ThumbnailWorkerResponse = ThumbnailWorkerDone | ThumbnailWorkerError;
