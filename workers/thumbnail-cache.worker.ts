import { DBSchema, openDB } from 'idb';
import type { ThumbnailWorkerRequest, ThumbnailWorkerResponse } from 'types/thumbnail-worker';
import { thumbnailCacheKey } from 'utils/cache-key';
import { isRemoteHttpURL } from 'utils/url';

type ResizeRequest = {
	url: string,
	width: number,
	height: number,
	fit: 'cover' | 'contain',
};

interface ThumbnailDBSchema extends DBSchema {
	thumbnails: {
		key: string,
		value: Blob,
	}
}

async function makeThumbnail(url: string, config: ThumbnailWorkerRequest['payload']['gjako']): Promise<Blob> {
	const req: ResizeRequest = {
		url,
		width: 500,
		height: 500,
		fit: 'cover',
	};

	const apiEndpoint = `${config.urlPrefix.replace(/\/+$/, '')}/resize`;
	const res = await fetch(apiEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': config.apiKey,
		},
		body: JSON.stringify(req),
	});
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}: ${res.statusText}`);
	}
	return res.blob();
}

async function cacheMisses(payload: ThumbnailWorkerRequest['payload']) {
	const remoteKeyToURL = new Map<string, string>();
	for (const url of payload.urls) {
		if (!isRemoteHttpURL(url)) continue;
		const key = thumbnailCacheKey(url);
		if (!remoteKeyToURL.has(key)) {
			remoteKeyToURL.set(key, url);
		}
	}

	const db = await openDB<ThumbnailDBSchema>(payload.dbName, payload.dbVersion);
	try {
		const cached = await db.getAllKeys('thumbnails');
		const cachedSet = new Set<string>(cached.map(key => String(key)));
		const misses = cachedSet.size > 0
			? [...remoteKeyToURL.keys()].filter(key => !cachedSet.has(key))
			: Array.from(remoteKeyToURL.keys());

		const failed: string[] = [];
		const workerCount = Math.max(1, Math.min(payload.concurrency, misses.length || 1));
		let cursor = 0;

		await Promise.all(Array.from({ length: workerCount }, async () => {
			while (cursor < misses.length) {
				const index = cursor;
				cursor += 1;

				const key = misses[index];
				if (!key) continue;
				const url = remoteKeyToURL.get(key);
				if (!url) continue;

				try {
					const thumb = await makeThumbnail(url, payload.gjako);
					await db.put('thumbnails', thumb, key);
				} catch {
					failed.push(url);
				}
			}
		}));

		const response: ThumbnailWorkerResponse = {
			type: 'done',
			payload: {
				cachedCount: cachedSet.size,
				remoteCount: remoteKeyToURL.size,
				attempted: misses.length,
				failed,
			},
		};
		postMessage(response);
	} finally {
		db.close();
	}
}

self.onmessage = async (event: MessageEvent<ThumbnailWorkerRequest>) => {
	if (event.data.type !== 'start') return;

	try {
		await cacheMisses(event.data.payload);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const response: ThumbnailWorkerResponse = {
			type: 'error',
			payload: { error: message },
		};
		postMessage(response);
	}
};
