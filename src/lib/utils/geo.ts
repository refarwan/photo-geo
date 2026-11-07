import type { Coordinates, DateTimeFormatOption } from '#lib/types';

// In-memory cache for reverse geocoding to avoid duplicate network requests
const geocodeCache = new Map<string, string>();

/**
 * Parses user input (Google Maps URL, coordinates string, or DMS)
 * into a valid latitude and longitude pair.
 */
export function parseCoordinates(input: string): Coordinates | null {
	if (!input) return null;
	const trimmed = input.trim();

	// 1. Google Maps URL with @lat,lng
	// Example: https://www.google.com/maps/@-6.2087634,106.845599,15z
	const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
	if (atMatch) {
		const lat = parseFloat(atMatch[1]);
		const lng = parseFloat(atMatch[2]);
		if (isValidLatLng(lat, lng)) return { lat, lng };
	}

	// 2. Query param: ?q=lat,lng or &q=lat,lng or query=lat,lng or ll=lat,lng or destination=lat,lng
	const queryMatch = trimmed.match(
		/[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/
	);
	if (queryMatch) {
		const lat = parseFloat(queryMatch[1]);
		const lng = parseFloat(queryMatch[2]);
		if (isValidLatLng(lat, lng)) return { lat, lng };
	}

	// 3. /place/lat,lng or /place/data=...
	const placeMatch = trimmed.match(/\/place\/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
	if (placeMatch) {
		const lat = parseFloat(placeMatch[1]);
		const lng = parseFloat(placeMatch[2]);
		if (isValidLatLng(lat, lng)) return { lat, lng };
	}

	// 4. DMS format: 6°12'31.7"S 106°50'44.2"E or similar
	const dmsMatch = trimmed.match(
		/(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)["]?\s*([NSEWnsew])[,\s]+(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)["]?\s*([NSEWnsew])/
	);
	if (dmsMatch) {
		const latDeg = parseFloat(dmsMatch[1]);
		const latMin = parseFloat(dmsMatch[2]);
		const latSec = parseFloat(dmsMatch[3]);
		const latDir = dmsMatch[4].toUpperCase();

		const lngDeg = parseFloat(dmsMatch[5]);
		const lngMin = parseFloat(dmsMatch[6]);
		const lngSec = parseFloat(dmsMatch[7]);
		const lngDir = dmsMatch[8].toUpperCase();

		let lat = latDeg + latMin / 60 + latSec / 3600;
		if (latDir === 'S') lat = -lat;
		let lng = lngDeg + lngMin / 60 + lngSec / 3600;
		if (lngDir === 'W') lng = -lng;

		if (isValidLatLng(lat, lng)) return { lat, lng };
	}

	// 5. Standard decimal format: "-6.2088, 106.8456" or "-6.2088 106.8456"
	const decimalMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
	if (decimalMatch) {
		const lat = parseFloat(decimalMatch[1]);
		const lng = parseFloat(decimalMatch[2]);
		if (isValidLatLng(lat, lng)) return { lat, lng };
	}

	return null;
}

export function isValidLatLng(lat: number, lng: number): boolean {
	return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Converts decimal degrees to DMS string
 */
export function toDMS(val: number, isLat: boolean): string {
	const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
	const abs = Math.abs(val);
	const deg = Math.floor(abs);
	const minFloat = (abs - deg) * 60;
	const min = Math.floor(minFloat);
	const sec = ((minFloat - min) * 60).toFixed(1);
	return `${deg}°${min}'${sec}"${dir}`;
}

/**
 * Format coordinates for badge display
 */
export function formatCoordinates(
	lat: number,
	lng: number,
	format: 'decimal' | 'dms' = 'decimal'
): string {
	if (format === 'dms') {
		return `${toDMS(lat, true)} ${toDMS(lng, false)}`;
	}
	return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
}

const MONTH_NAMES_ID = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember'
];

const MONTH_NAMES_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/**
 * Formats a Date object or ISO string based on selected format option
 */
export function formatDateTime(
	dateInput: Date | string | number,
	format: DateTimeFormatOption
): string {
	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return '';

	const pad = (n: number) => n.toString().padStart(2, '0');
	const day = pad(d.getDate());
	const month = pad(d.getMonth() + 1);
	const year = d.getFullYear();
	const hours = pad(d.getHours());
	const mins = pad(d.getMinutes());
	const secs = pad(d.getSeconds());

	switch (format) {
		case 'DD/MM/YYYY HH:mm:ss':
			return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
		case 'YYYY-MM-DD HH:mm:ss':
			return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
		case 'DD MMMM YYYY, HH:mm':
			return `${day} ${MONTH_NAMES_ID[d.getMonth()]} ${year}, ${hours}:${mins}`;
		case 'DD MMM YYYY, HH:mm:ss WIB':
			return `${day} ${MONTH_NAMES_SHORT[d.getMonth()]} ${year}, ${hours}:${mins}:${secs} WIB`;
		case 'ISO':
			return d.toISOString().replace('T', ' ').substring(0, 19);
		default:
			return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
	}
}

/**
 * Reverse geocodes coordinates into an address string using Nominatim
 */
export function reverseGeocode(lat: number, lng: number): Promise<string | null> {
	const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
	if (geocodeCache.has(key)) {
		return Promise.resolve(geocodeCache.get(key) || null);
	}

	return new Promise((resolve) => {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 4000);

		fetch(
			`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
			{
				signal: controller.signal,
				headers: {
					'Accept-Language': 'id,en;q=0.8'
				}
			}
		)
			.then((res) => {
				clearTimeout(timeoutId);
				if (!res.ok) throw new Error('Geocoding response not OK');
				return res.json();
			})
			.then((data) => {
				let address = '';
				if (data.display_name) {
					// Return the full, complete address without shortening
					address = data.display_name;
				}
				geocodeCache.set(key, address);
				resolve(address);
			})
			.catch(() => {
				clearTimeout(timeoutId);
				resolve(null);
			});
	});
}
