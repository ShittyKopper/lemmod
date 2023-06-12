export function sleep(ms: number) {
	console.debug("Waiting", ms, "ms");
	return new Promise(r => setTimeout(r, ms));
}
