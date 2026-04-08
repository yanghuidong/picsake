export { isRemoteHttpURL, normalizeURLForKey };

function isRemoteHttpURL(rawURL: string): boolean {
	try {
		const parsed = new URL(rawURL);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

function normalizeURLForKey(rawURL: string): string {
	const parsed = new URL(rawURL);
	parsed.hash = '';
	parsed.protocol = parsed.protocol.toLowerCase();
	parsed.hostname = parsed.hostname.toLowerCase();
	if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
		parsed.port = '';
	}
	return parsed.toString();
}

