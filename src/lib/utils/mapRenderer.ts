import type { MapTileProvider } from '#lib/types';

// In-memory tile cache to prevent re-fetching identical tiles across photos
const tileCache = new Map<string, HTMLImageElement>();

/**
 * Returns the tile URL for a given tile coordinate (x, y, z) and provider.
 */
function getTileUrl(x: number, y: number, z: number, provider: MapTileProvider): string {
	// Round-robin subdomain for google mt0, mt1, mt2, mt3
	const s = (x + y) % 4;

	switch (provider) {
		case 'google_roadmap':
			return `https://mt${s}.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`;
		case 'google_satellite':
			return `https://mt${s}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
		case 'google_hybrid':
			return `https://mt${s}.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`;
		case 'google_terrain':
			return `https://mt${s}.google.com/vt/lyrs=p&x=${x}&y=${y}&z=${z}`;
		case 'carto_voyager':
			return `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
		case 'osm':
		default:
			return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
	}
}

/**
 * Loads a single tile image with CORS support and caching.
 */
function loadTileImage(url: string): Promise<HTMLImageElement | null> {
	if (tileCache.has(url)) {
		const cached = tileCache.get(url)!;
		if (cached.complete && cached.naturalWidth > 0) {
			return Promise.resolve(cached);
		}
	}

	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';

		const timer = setTimeout(() => {
			resolve(null);
		}, 6000);

		img.onload = () => {
			clearTimeout(timer);
			tileCache.set(url, img);
			resolve(img);
		};

		img.onerror = () => {
			clearTimeout(timer);
			resolve(null);
		};

		img.src = url;
	});
}

/**
 * Converts latitude and longitude to floating point tile coordinates at zoom level z.
 */
function latLngToTileCoordinates(lat: number, lng: number, zoom: number): { x: number; y: number } {
	const n = Math.pow(2, zoom);
	const latRad = (lat * Math.PI) / 180;
	const x = ((lng + 180) / 360) * n;
	const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
	return { x, y };
}

/**
 * Draws an authentic Google Maps style red pin marker.
 */
function drawGooglePin(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	scale = 1.0
) {
	ctx.save();
	ctx.translate(centerX, centerY);

	const w = 24 * scale;
	const h = 34 * scale;

	// Drop shadow ellipse at pin tip
	ctx.beginPath();
	ctx.ellipse(0, 0, 8 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.fill();

	// Pin body (tip at 0, 0, top circle centered at 0, -h + w/2)
	const headRadius = w / 2;
	const headCenterY = -h + headRadius;

	ctx.beginPath();
	// Left slope from tip to head
	ctx.moveTo(0, 0);
	ctx.lineTo(-headRadius * 0.9, headCenterY + headRadius * 0.3);
	// Arc around head
	ctx.arc(0, headCenterY, headRadius, Math.PI * 0.75, Math.PI * 2.25, false);
	// Right slope from head back to tip
	ctx.lineTo(0, 0);
	ctx.closePath();

	// Red gradient for 3D look
	const grad = ctx.createLinearGradient(
		-headRadius,
		headCenterY - headRadius,
		headRadius,
		headCenterY + headRadius
	);
	grad.addColorStop(0, '#EA4335');
	grad.addColorStop(1, '#C5221F');
	ctx.fillStyle = grad;
	ctx.fill();

	ctx.lineWidth = 1.2 * scale;
	ctx.strokeStyle = '#B31412';
	ctx.stroke();

	// Inner white dot
	ctx.beginPath();
	ctx.arc(0, headCenterY, headRadius * 0.42, 0, Math.PI * 2);
	ctx.fillStyle = '#FFFFFF';
	ctx.fill();

	ctx.restore();
}

export interface StaticMapOptions {
	lat: number;
	lng: number;
	zoom: number;
	width: number;
	height: number;
	logicalWidth?: number;
	logicalHeight?: number;
	provider: MapTileProvider;
	scale?: number; // e.g. 1 or 2 for retina
}

/**
 * Renders a static map tile canvas centered at (lat, lng) with a red marker at the center.
 * Crucially: uses a standardized logical geographic viewport so that the visible ground
 * area, streets, and zoom level are 100% IDENTICAL across photos of any resolution!
 */
export async function renderStaticMap(options: StaticMapOptions): Promise<HTMLCanvasElement> {
	const { lat, lng, zoom, width, height, provider, scale = 1.0 } = options;

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not create canvas context');

	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';

	// Background color fallback depending on provider
	if (provider === 'google_satellite' || provider === 'google_hybrid') {
		ctx.fillStyle = '#1e293b';
	} else {
		ctx.fillStyle = '#f1f0ea';
	}
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Scale context if needed
	ctx.scale(scale, scale);

	// Standard geographic viewport reference (in pixels at zoom Z)
	// Defaulting to 320 x 260 ensures all photos show the exact same geographic radius and zoom!
	const logicalW = options.logicalWidth || 320;
	const logicalH = options.logicalHeight || Math.round(logicalW * (height / width));

	// Calculate center in tile coordinates at zoom level
	const centerTile = latLngToTileCoordinates(lat, lng, zoom);

	// Geographic span in tile units (constant across all photos!)
	const halfTileW = logicalW / 2 / 256;
	const halfTileH = logicalH / 2 / 256;

	const minTileX = centerTile.x - halfTileW;
	const maxTileX = centerTile.x + halfTileW;
	const minTileY = centerTile.y - halfTileH;
	const maxTileY = centerTile.y + halfTileH;

	const spanTileX = maxTileX - minTileX;
	const spanTileY = maxTileY - minTileY;

	// Tile coordinate bounds
	const minTileIntX = Math.floor(minTileX);
	const maxTileIntX = Math.floor(maxTileX);
	const minTileIntY = Math.floor(minTileY);
	const maxTileIntY = Math.floor(maxTileY);

	const numTilesAtZoom = Math.pow(2, zoom);

	// Fetch all needed tiles in parallel
	const tileJobs: Array<{
		destX: number;
		destY: number;
		destW: number;
		destH: number;
		promise: Promise<HTMLImageElement | null>;
	}> = [];

	for (let tx = minTileIntX; tx <= maxTileIntX; tx++) {
		for (let ty = minTileIntY; ty <= maxTileIntY; ty++) {
			// Handle wrapping across 180th meridian if needed
			const normalizedX = ((tx % numTilesAtZoom) + numTilesAtZoom) % numTilesAtZoom;
			const normalizedY = ty;

			if (normalizedY >= 0 && normalizedY < numTilesAtZoom) {
				const tileUrl = getTileUrl(normalizedX, normalizedY, zoom, provider);

				// Calculate exact position and dimensions on destination canvas
				const destX = ((tx - minTileX) / spanTileX) * width;
				const destY = ((ty - minTileY) / spanTileY) * height;
				const destW = (1 / spanTileX) * width;
				const destH = (1 / spanTileY) * height;

				tileJobs.push({
					destX,
					destY,
					destW,
					destH,
					promise: loadTileImage(tileUrl)
				});
			}
		}
	}

	// Draw tiles once resolved
	const results = await Promise.all(tileJobs.map((j) => j.promise));
	for (let i = 0; i < tileJobs.length; i++) {
		const img = results[i];
		const job = tileJobs[i];
		if (img) {
			ctx.drawImage(img, job.destX, job.destY, job.destW, job.destH);
		}
	}

	// Draw center Google Maps Pin
	const pinScale = Math.max(0.9, Math.min(2.5, (width / 260) * 1.0));
	drawGooglePin(ctx, width / 2, height / 2, pinScale);

	// Small Google / Map attribution at bottom corner
	const attrScale = Math.max(0.8, Math.min(2.0, width / 300));
	ctx.save();
	ctx.font = `bold ${Math.round(9 * attrScale)}px sans-serif`;
	ctx.textBaseline = 'bottom';
	if (provider.startsWith('google')) {
		// Small Google watermark
		const boxW = Math.round(46 * attrScale);
		const boxH = Math.round(14 * attrScale);
		const boxY = height - Math.round(18 * attrScale);
		ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
		ctx.fillRect(4, boxY, boxW, boxH);
		ctx.fillStyle = '#444444';
		ctx.fillText('Google', 7, boxY + boxH - 2);
	} else {
		// OSM
		const boxW = Math.round(36 * attrScale);
		const boxH = Math.round(12 * attrScale);
		const boxY = height - Math.round(16 * attrScale);
		ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
		ctx.fillRect(4, boxY, boxW, boxH);
		ctx.fillStyle = '#555555';
		ctx.fillText('© OSM', 6, boxY + boxH - 2);
	}
	ctx.restore();

	return canvas;
}
