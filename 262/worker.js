const WASM_CONTENT_TYPE = "application/wasm";

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === "/") {
			const indexURL = new URL(request.url);
			indexURL.hostname = "assets.local";
			indexURL.pathname = "/index.html";
			return env.ASSETS.fetch(new Request(indexURL, request));
		}
		if (!url.pathname.endsWith(".wasm")) {
			const assetURL = new URL(request.url);
			assetURL.hostname = "assets.local";
			return env.ASSETS.fetch(new Request(assetURL, request));
		}

		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", {
				status: 405,
				headers: { Allow: "GET, HEAD" }
			});
		}

		// The uncompressed client image is larger than Cloudflare's per-asset
		// upload limit. Store its existing Brotli sidecar and expose it under the
		// normal .wasm URL so compileStreaming still sees application/wasm.
		const assetURL = new URL(request.url);
		assetURL.hostname = "assets.local";
		assetURL.pathname = url.pathname + ".br";
		const compressed = await env.ASSETS.fetch(new Request(assetURL, {
			method: request.method
		}));
		if (!compressed.ok) {
			return new Response("Wasm image not found", {
				status: 404,
				headers: { "Cache-Control": "no-store" }
			});
		}

		const headers = new Headers(compressed.headers);
		headers.set("Content-Type", WASM_CONTENT_TYPE);
		headers.set("Content-Encoding", "br");
		headers.set("Vary", "Accept-Encoding");
		headers.set("Cache-Control", "public, max-age=31536000, immutable");
		headers.set("X-Content-Type-Options", "nosniff");
		return new Response(compressed.body, {
			status: compressed.status,
			headers,
			encodeBody: "manual"
		});
	}
};
