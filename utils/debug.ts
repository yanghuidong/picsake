export { debugLog };

function debugLog(obj: object) {
	const output: string = Object.entries(obj).map(([key, val]) => `${key}: ${JSON.stringify(val, null, '\t')}`).join('\n');
	console.log(output);
}