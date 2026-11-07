import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCoordinates } from '#lib/utils/geo';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url } = await request.json();
		if (!url || typeof url !== 'string') {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// First, check if the input already contains coordinates directly
		const directCoords = parseCoordinates(url);
		if (directCoords) {
			return json({ success: true, coords: directCoords, resolvedUrl: url });
		}

		// Otherwise, attempt to follow redirects if it's a URL
		if (url.startsWith('http://') || url.startsWith('https://')) {
			try {
				const response = await fetch(url, {
					method: 'GET',
					redirect: 'follow',
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
					}
				});

				const finalUrl = response.url;
				const resolvedCoords = parseCoordinates(finalUrl);

				if (resolvedCoords) {
					return json({ success: true, coords: resolvedCoords, resolvedUrl: finalUrl });
				}

				// If finalUrl didn't match directly, try to search for @lat,lng in the response body if needed
				const text = await response.text();
				const bodyMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
				if (bodyMatch) {
					const lat = parseFloat(bodyMatch[1]);
					const lng = parseFloat(bodyMatch[2]);
					return json({ success: true, coords: { lat, lng }, resolvedUrl: finalUrl });
				}
			} catch (fetchErr) {
				console.warn('Error fetching URL for redirect:', fetchErr);
			}
		}

		return json({ error: 'Tidak dapat menemukan koordinat dari URL tersebut' }, { status: 404 });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Internal error';
		return json({ error: message }, { status: 500 });
	}
};
