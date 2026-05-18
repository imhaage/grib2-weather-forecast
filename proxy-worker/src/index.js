const ALLOWED = ["data.gouv.fr", "cloud.ovh.net"];

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	"Access-Control-Expose-Headers":
		"Content-Length, Content-Range, Accept-Ranges, ETag",
};

function isAllowed(host) {
	return ALLOWED.some((d) => host === d || host.endsWith("." + d));
}

export default {
	async fetch(req) {
		if (req.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: CORS_HEADERS,
			});
		}

		const url = new URL(req.url);

		const rest = url.pathname.slice(1);
		const slash = rest.indexOf("/");

		const hostname = slash === -1 ? rest : rest.slice(0, slash);

		const path = slash === -1 ? "/" : rest.slice(slash);

		if (!isAllowed(hostname)) {
			return new Response("Forbidden", {
				status: 403,
				headers: CORS_HEADERS,
			});
		}

		const upstreamHeaders = new Headers();

		const range = req.headers.get("Range");
		if (range) {
			upstreamHeaders.set("Range", range);
		}

		upstreamHeaders.set("User-Agent", "grib2-weather-forecast-proxy");

		const upstream = await fetch(`https://${hostname}${path}${url.search}`, {
			method: req.method,
			headers: upstreamHeaders,
		});

		const headers = new Headers(upstream.headers);

		Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

		return new Response(upstream.body, {
			status: upstream.status,
			statusText: upstream.statusText,
			headers,
		});
	},
};
