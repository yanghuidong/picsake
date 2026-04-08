// Crockford Base32 uppercase alphabet; excludes I, L, O, U.
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function normalizeURL(rawURL: string): string {
	const parsed = new URL(rawURL);
	parsed.hash = '';
	parsed.protocol = parsed.protocol.toLowerCase();
	parsed.hostname = parsed.hostname.toLowerCase();
	if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
		parsed.port = '';
	}
	return parsed.toString();
}

function ulidKeyFromURL(rawURL: string): string | null {
	try {
		const parsed = new URL(rawURL);
		const pathSegments = parsed.pathname.split('/').filter(Boolean);
		// Our uploaded object URLs are at least /<username>/<dir>/<filename>.
		// Anything shorter is treated as generic URL key.
		if (pathSegments.length < 3) return null;
		const filename = pathSegments.at(-1);
		if (!filename) return null;

		const extIndex = filename.lastIndexOf('.');
		const base = extIndex >= 0 ? filename.slice(0, extIndex) : filename;
		const candidate = decodeURIComponent(base).toUpperCase();

		return ULID_REGEX.test(candidate) ? `ulid:${candidate}` : null;
	} catch {
		return null;
	}
}

export function thumbnailCacheKey(rawURL: string): string {
	const ulidKey = ulidKeyFromURL(rawURL);
	if (ulidKey !== null) return ulidKey;

	try {
		return `url:${normalizeURL(rawURL)}`;
	} catch {
		return `url:${rawURL}`;
	}
}
