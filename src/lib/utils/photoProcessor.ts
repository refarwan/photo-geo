import type { PhotoItem, OverlaySettings } from '#lib/types';
import { renderStaticMap } from './mapRenderer';
import { formatCoordinates, formatDateTime } from './geo';

/**
 * Loads an image from an object URL or data URL into an HTMLImageElement.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
		img.src = src;
	});
}

/**
 * Draws a rounded rectangle path.
 */
function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

/**
 * Wraps text into multiple lines based on maximum allowed width.
 * Never cuts off or truncates with ellipsis.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	if (!text) return [];
	if (ctx.measureText(text).width <= maxWidth) {
		return [text];
	}

	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		if (ctx.measureText(testLine).width <= maxWidth) {
			currentLine = testLine;
		} else {
			if (currentLine) {
				lines.push(currentLine);
			}
			// If a single word is longer than maxWidth, break by character
			if (ctx.measureText(word).width > maxWidth) {
				let sub = '';
				for (const char of word) {
					if (ctx.measureText(sub + char).width <= maxWidth) {
						sub += char;
					} else {
						if (sub) lines.push(sub);
						sub = char;
					}
				}
				currentLine = sub;
			} else {
				currentLine = word;
			}
		}
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return lines;
}

interface RenderLine {
	text: string;
	bold?: boolean;
	color?: string;
	indent?: number;
}

/**
 * Processes a PhotoItem:
 * - Loads photo into high-resolution canvas
 * - Generates and overlays static Google map
 * - Renders date & time, coordinates, and full address (never truncated)
 * - Returns a new Blob and object URL
 */
export async function processPhotoWithOverlay(
	photo: PhotoItem,
	settings: OverlaySettings,
	fallbackCoords?: { lat: number; lng: number }
): Promise<{ blob: Blob; dataUrl: string }> {
	const img = await loadImage(photo.objectUrl);

	let width = img.naturalWidth || img.width;
	let height = img.naturalHeight || img.height;

	// Clamp max dimension for browser stability (preserves aspect ratio)
	const maxDim = 3840;
	if (width > maxDim || height > maxDim) {
		const ratio = Math.min(maxDim / width, maxDim / height);
		width = Math.round(width * ratio);
		height = Math.round(height * ratio);
	}

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not get 2D context for photo');

	// 1. Draw base photo
	ctx.drawImage(img, 0, 0, width, height);

	// Determine active coordinates: photo's own or global fallback
	const activeLat = photo.lat ?? fallbackCoords?.lat ?? null;
	const activeLng = photo.lng ?? fallbackCoords?.lng ?? null;

	// Invariant reference dimension (independent of orientation)
	const refDimension = Math.min(width, height);
	const scale = Math.max(0.6, refDimension / 900) * settings.fontScale;
	const margin = Math.round(Math.max(20, refDimension * 0.03));

	// Date and time string
	const formattedDateTime = settings.showDateTime
		? formatDateTime(photo.timestamp, settings.dateTimeFormat)
		: '';

	// Coordinates string
	const formattedCoords =
		settings.showCoordinates && activeLat !== null && activeLng !== null
			? formatCoordinates(activeLat, activeLng, settings.coordFormat)
			: '';

	// Custom note
	const note = (photo.customNote || settings.customProjectNote || '').trim();

	// Address text (full, never shortened)
	const address = settings.showAddress ? (photo.locationAddress || '').trim() : '';

	// Render Static Map if enabled and coordinates exist
	let mapCanvas: HTMLCanvasElement | null = null;
	if (settings.showMap && activeLat !== null && activeLng !== null) {
		const targetMapWidth = Math.round(((refDimension * settings.mapSizePercent) / 100) * 1.3);
		const targetMapHeight = Math.round(targetMapWidth * 0.85);

		// Logical reference dimensions ensure geographic ground coverage and zoom
		// are 100% IDENTICAL across all photos regardless of photo resolution or orientation!
		const logicalWidth = 320;
		const logicalHeight = Math.round(320 * (targetMapHeight / targetMapWidth));

		mapCanvas = await renderStaticMap({
			lat: activeLat,
			lng: activeLng,
			zoom: settings.zoom,
			width: targetMapWidth,
			height: targetMapHeight,
			logicalWidth,
			logicalHeight,
			provider: settings.mapProvider,
			scale: 1.0
		});
	}

	// 2. Render overlays based on chosen layout style
	if (settings.layoutStyle === 'bottom_banner') {
		renderBottomBannerLayout(ctx, width, height, mapCanvas, {
			formattedDateTime,
			formattedCoords,
			address,
			note,
			scale,
			settings
		});
	} else if (settings.layoutStyle === 'split') {
		renderSplitLayout(ctx, width, height, mapCanvas, {
			formattedDateTime,
			formattedCoords,
			address,
			note,
			scale,
			margin,
			settings
		});
	} else {
		// Default 'gps_badge'
		renderGpsBadgeLayout(ctx, width, height, mapCanvas, {
			formattedDateTime,
			formattedCoords,
			address,
			note,
			scale,
			margin,
			settings
		});
	}

	// 3. Export to Blob
	const mimeType = settings.outputFormat;
	const quality = settings.outputQuality;

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(b) => {
				if (b) resolve(b);
				else reject(new Error('Canvas toBlob returned null'));
			},
			mimeType,
			quality
		);
	});

	const dataUrl = URL.createObjectURL(blob);
	return { blob, dataUrl };
}

/**
 * Layout Style 1: GPS Badge (Map + Info Card tightly integrated with full multi-line text)
 */
function renderGpsBadgeLayout(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	mapCanvas: HTMLCanvasElement | null,
	data: {
		formattedDateTime: string;
		formattedCoords: string;
		address: string;
		note: string;
		scale: number;
		margin: number;
		settings: OverlaySettings;
	}
) {
	const { formattedDateTime, formattedCoords, address, note, scale, margin, settings } = data;

	const fontSize = Math.round(18 * scale);
	const lineSpacing = Math.round(fontSize * 1.35);
	const padding = Math.round(14 * scale);
	const borderRadius = Math.round(settings.borderRadius * scale);

	const mapWidth = mapCanvas ? mapCanvas.width : 0;
	const mapHeight = mapCanvas ? mapCanvas.height : 0;

	// Calculate maximum allowed card width (up to 75% of photo width to comfortably hold full address)
	const maxCardWidth = Math.min(
		width - margin * 2,
		Math.max(mapWidth, Math.min(width * 0.75, Math.round(540 * scale)))
	);
	const contentWidth = maxCardWidth - padding * 2;

	ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;

	// Prepare multi-line render array
	const renderLines: RenderLine[] = [];

	if (formattedDateTime) {
		renderLines.push({ text: `🕒  ${formattedDateTime}`, bold: true });
	}

	if (formattedCoords) {
		renderLines.push({ text: `📍  ${formattedCoords}`, bold: true, color: '#6ee7b7' });
	}

	if (address) {
		const iconStr = '🏠  ';
		const iconWidth = ctx.measureText(iconStr).width;
		const wrapped = wrapText(ctx, address, contentWidth - iconWidth);
		if (wrapped.length > 0) {
			renderLines.push({ text: iconStr + wrapped[0], color: '#cbd5e1' });
			for (let i = 1; i < wrapped.length; i++) {
				renderLines.push({ text: wrapped[i], indent: iconWidth, color: '#cbd5e1' });
			}
		}
	}

	if (note) {
		const iconStr = '📝  ';
		const iconWidth = ctx.measureText(iconStr).width;
		const wrapped = wrapText(ctx, note, contentWidth - iconWidth);
		if (wrapped.length > 0) {
			renderLines.push({ text: iconStr + wrapped[0], color: '#fef08a' });
			for (let i = 1; i < wrapped.length; i++) {
				renderLines.push({ text: wrapped[i], indent: iconWidth, color: '#fef08a' });
			}
		}
	}

	const hasText = renderLines.length > 0;
	const hasMap = mapCanvas !== null;

	if (!hasText && !hasMap) return;

	// Calculate exact needed text block dimensions
	let maxRenderWidth = 0;
	for (const line of renderLines) {
		const w = ctx.measureText(line.text).width + (line.indent || 0);
		if (w > maxRenderWidth) maxRenderWidth = w;
	}

	const textBlockWidth = hasText
		? Math.min(maxCardWidth, Math.max(mapWidth, maxRenderWidth + padding * 2))
		: 0;
	const textBlockHeight = hasText ? renderLines.length * lineSpacing + padding * 2 : 0;

	// Determine positioning coordinates
	const isBottom = settings.position.includes('bottom');
	const isLeft = settings.position.includes('left');

	const totalWidth = Math.max(mapWidth, textBlockWidth);
	const totalHeight =
		mapHeight + (hasMap && hasText ? Math.round(10 * scale) : 0) + textBlockHeight;

	const startX = isLeft ? margin : width - margin - totalWidth;
	const startY = isBottom ? height - margin - totalHeight : margin;

	let currentY = startY;

	// 1. Draw Map if available
	if (hasMap && mapCanvas) {
		const mapX = isLeft ? startX : width - margin - mapWidth;
		ctx.save();

		ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
		ctx.shadowBlur = Math.round(12 * scale);
		ctx.shadowOffsetY = Math.round(4 * scale);

		const borderWidth = Math.round(3 * scale);
		ctx.fillStyle = '#FFFFFF';
		drawRoundedRect(
			ctx,
			mapX - borderWidth,
			currentY - borderWidth,
			mapWidth + borderWidth * 2,
			mapHeight + borderWidth * 2,
			borderRadius + borderWidth
		);
		ctx.fill();
		ctx.restore();

		ctx.save();
		drawRoundedRect(ctx, mapX, currentY, mapWidth, mapHeight, borderRadius);
		ctx.clip();
		ctx.drawImage(mapCanvas, mapX, currentY);
		ctx.restore();

		currentY += mapHeight + Math.round(10 * scale);
	}

	// 2. Draw Text Badge with full complete address (never truncated)
	if (hasText) {
		const cardX = isLeft ? startX : width - margin - textBlockWidth;
		const cardY = currentY;

		ctx.save();
		ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
		ctx.shadowBlur = Math.round(10 * scale);
		ctx.shadowOffsetY = Math.round(3 * scale);

		if (settings.badgeTheme === 'light') {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
		} else if (settings.badgeTheme === 'dark') {
			ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
		} else {
			ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
		}

		drawRoundedRect(ctx, cardX, cardY, textBlockWidth, textBlockHeight, borderRadius);
		ctx.fill();

		ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
		ctx.strokeStyle = settings.badgeTheme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';
		ctx.stroke();
		ctx.restore();

		// Draw each line in full
		ctx.save();
		ctx.textBaseline = 'middle';
		let textY = cardY + padding + fontSize / 2;

		const textColorDefault = settings.badgeTheme === 'light' ? '#0f172a' : '#f8fafc';

		for (const line of renderLines) {
			const textX = cardX + padding + (line.indent || 0);
			ctx.font = `${line.bold ? 'bold' : '500'} ${fontSize}px system-ui, -apple-system, sans-serif`;
			ctx.fillStyle = line.color || textColorDefault;
			ctx.fillText(line.text, textX, textY);
			textY += lineSpacing;
		}
		ctx.restore();
	}
}

/**
 * Layout Style 2: Split (Map in one corner, info badge in opposite corner with full text)
 */
function renderSplitLayout(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	mapCanvas: HTMLCanvasElement | null,
	data: {
		formattedDateTime: string;
		formattedCoords: string;
		address: string;
		note: string;
		scale: number;
		margin: number;
		settings: OverlaySettings;
	}
) {
	const { formattedDateTime, formattedCoords, address, note, scale, margin, settings } = data;
	const borderRadius = Math.round(settings.borderRadius * scale);

	// 1. Draw Map at chosen position
	if (mapCanvas) {
		const isBottom = settings.position.includes('bottom');
		const isLeft = settings.position.includes('left');

		const mapX = isLeft ? margin : width - margin - mapCanvas.width;
		const mapY = isBottom ? height - margin - mapCanvas.height : margin;

		ctx.save();
		ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
		ctx.shadowBlur = Math.round(12 * scale);
		ctx.shadowOffsetY = Math.round(4 * scale);

		const borderWidth = Math.round(3 * scale);
		ctx.fillStyle = '#FFFFFF';
		drawRoundedRect(
			ctx,
			mapX - borderWidth,
			mapY - borderWidth,
			mapCanvas.width + borderWidth * 2,
			mapCanvas.height + borderWidth * 2,
			borderRadius + borderWidth
		);
		ctx.fill();
		ctx.restore();

		ctx.save();
		drawRoundedRect(ctx, mapX, mapY, mapCanvas.width, mapCanvas.height, borderRadius);
		ctx.clip();
		ctx.drawImage(mapCanvas, mapX, mapY);
		ctx.restore();
	}

	// 2. Draw info badge at opposite corner with multi-line wrapping
	const fontSize = Math.round(17 * scale);
	const lineSpacing = Math.round(fontSize * 1.35);
	const padding = Math.round(12 * scale);

	const maxCardWidth = Math.min(
		width - margin * 2,
		Math.max(Math.min(width * 0.65, Math.round(520 * scale)), 320 * scale)
	);
	const contentWidth = maxCardWidth - padding * 2;

	ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;

	const renderLines: RenderLine[] = [];
	if (formattedDateTime) renderLines.push({ text: `🕒  ${formattedDateTime}`, bold: true });
	if (formattedCoords)
		renderLines.push({ text: `📍  ${formattedCoords}`, bold: true, color: '#6ee7b7' });

	if (address) {
		const iconStr = '🏠  ';
		const iconWidth = ctx.measureText(iconStr).width;
		const wrapped = wrapText(ctx, address, contentWidth - iconWidth);
		if (wrapped.length > 0) {
			renderLines.push({ text: iconStr + wrapped[0], color: '#cbd5e1' });
			for (let i = 1; i < wrapped.length; i++) {
				renderLines.push({ text: wrapped[i], indent: iconWidth, color: '#cbd5e1' });
			}
		}
	}

	if (note) {
		const iconStr = '📝  ';
		const iconWidth = ctx.measureText(iconStr).width;
		const wrapped = wrapText(ctx, note, contentWidth - iconWidth);
		if (wrapped.length > 0) {
			renderLines.push({ text: iconStr + wrapped[0], color: '#fef08a' });
			for (let i = 1; i < wrapped.length; i++) {
				renderLines.push({ text: wrapped[i], indent: iconWidth, color: '#fef08a' });
			}
		}
	}

	if (renderLines.length > 0) {
		let maxW = 0;
		for (const l of renderLines) {
			const w = ctx.measureText(l.text).width + (l.indent || 0);
			if (w > maxW) maxW = w;
		}

		const badgeW = Math.min(maxCardWidth, maxW + padding * 2);
		const badgeH = renderLines.length * lineSpacing + padding * 2;

		const isBottom = settings.position.includes('bottom');
		const isOppositeLeft = !settings.position.includes('left');

		const badgeX = isOppositeLeft ? margin : width - margin - badgeW;
		const badgeY = isBottom ? height - margin - badgeH : margin;

		ctx.save();
		ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
		ctx.shadowBlur = Math.round(10 * scale);
		ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
		drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, borderRadius);
		ctx.fill();

		ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
		ctx.stroke();
		ctx.restore();

		ctx.save();
		ctx.textBaseline = 'middle';
		let textY = badgeY + padding + fontSize / 2;

		for (const line of renderLines) {
			const textX = badgeX + padding + (line.indent || 0);
			ctx.font = `${line.bold ? 'bold' : '500'} ${fontSize}px system-ui, -apple-system, sans-serif`;
			ctx.fillStyle = line.color || '#f8fafc';
			ctx.fillText(line.text, textX, textY);
			textY += lineSpacing;
		}
		ctx.restore();
	}
}

/**
 * Layout Style 3: Full-width Bottom Banner with dynamic height for full multi-line text
 */
function renderBottomBannerLayout(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	mapCanvas: HTMLCanvasElement | null,
	data: {
		formattedDateTime: string;
		formattedCoords: string;
		address: string;
		note: string;
		scale: number;
		settings: OverlaySettings;
	}
) {
	const { formattedDateTime, formattedCoords, address, note, scale, settings } = data;

	const fontSize = Math.round(17 * scale);
	const lineSpacing = Math.round(fontSize * 1.35);
	const padding = Math.round(16 * scale);

	let currentX = padding;
	let mapH = 0;

	if (mapCanvas) {
		mapH = Math.round(80 * scale);
		const initialMapW = Math.round(mapH * 1.3);
		currentX += initialMapW + padding * 1.2;
	}

	const maxTextWidth = width - currentX - padding * 2;
	ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;

	const renderLines: RenderLine[] = [];
	if (formattedDateTime) renderLines.push({ text: `🕒  ${formattedDateTime}`, bold: true });
	if (formattedCoords)
		renderLines.push({ text: `📍  ${formattedCoords}`, bold: true, color: '#6ee7b7' });

	if (address) {
		const iconStr = '🏠  ';
		const iconWidth = ctx.measureText(iconStr).width;
		const wrapped = wrapText(ctx, address, maxTextWidth - iconWidth);
		if (wrapped.length > 0) {
			renderLines.push({ text: iconStr + wrapped[0], color: '#cbd5e1' });
			for (let i = 1; i < wrapped.length; i++) {
				renderLines.push({ text: wrapped[i], indent: iconWidth, color: '#cbd5e1' });
			}
		}
	}

	if (note) {
		const iconStr = '📝  ';
		const iconWidth = ctx.measureText(iconStr).width;
		const wrapped = wrapText(ctx, note, maxTextWidth - iconWidth);
		if (wrapped.length > 0) {
			renderLines.push({ text: iconStr + wrapped[0], color: '#fef08a' });
			for (let i = 1; i < wrapped.length; i++) {
				renderLines.push({ text: wrapped[i], indent: iconWidth, color: '#fef08a' });
			}
		}
	}

	const textRequiredHeight = renderLines.length * lineSpacing + padding * 2;
	const bannerHeight = Math.max(Math.round(100 * scale), mapH + padding * 2, textRequiredHeight);
	const bannerY = height - bannerHeight;

	ctx.save();
	const grad = ctx.createLinearGradient(0, bannerY, 0, height);
	grad.addColorStop(0, 'rgba(15, 23, 42, 0.90)');
	grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
	ctx.fillStyle = grad;
	ctx.fillRect(0, bannerY, width, bannerHeight);

	ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
	ctx.fillRect(0, bannerY, width, Math.max(1, Math.round(1.5 * scale)));
	ctx.restore();

	// Draw Map inside banner
	if (mapCanvas) {
		const actualMapH = bannerHeight - padding * 2;
		const actualMapW = Math.round(actualMapH * 1.3);
		const mapY = bannerY + padding;

		ctx.save();
		const borderRadius = Math.round(settings.borderRadius * scale);
		drawRoundedRect(ctx, padding, mapY, actualMapW, actualMapH, borderRadius);
		ctx.clip();
		ctx.drawImage(mapCanvas, padding, mapY, actualMapW, actualMapH);
		ctx.restore();

		ctx.save();
		ctx.lineWidth = Math.max(1, Math.round(2 * scale));
		ctx.strokeStyle = '#FFFFFF';
		drawRoundedRect(ctx, padding, mapY, actualMapW, actualMapH, borderRadius);
		ctx.stroke();
		ctx.restore();
	}

	// Draw all text lines
	if (renderLines.length > 0) {
		ctx.save();
		ctx.textBaseline = 'middle';
		let textY = bannerY + padding + fontSize / 2;

		for (const line of renderLines) {
			const textX = currentX + (line.indent || 0);
			ctx.font = `${line.bold ? 'bold' : '500'} ${fontSize}px system-ui, -apple-system, sans-serif`;
			ctx.fillStyle = line.color || '#f8fafc';
			ctx.fillText(line.text, textX, textY);
			textY += lineSpacing;
		}
		ctx.restore();
	}
}
