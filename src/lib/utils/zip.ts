import JSZip from 'jszip';
import type { PhotoItem, OverlaySettings } from '#lib/types';
import { processPhotoWithOverlay } from './photoProcessor';

export interface BatchProcessProgress {
	current: number;
	total: number;
	currentFileName: string;
}

/**
 * Processes all photos and downloads them as a single ZIP archive.
 */
export async function downloadAllAsZip(
	photos: PhotoItem[],
	settings: OverlaySettings,
	fallbackCoords?: { lat: number; lng: number },
	onProgress?: (progress: BatchProcessProgress) => void
): Promise<void> {
	if (photos.length === 0) return;

	const zip = new JSZip();
	const ext = settings.outputFormat === 'image/png' ? 'png' : 'jpg';

	for (let i = 0; i < photos.length; i++) {
		const photo = photos[i];

		if (onProgress) {
			onProgress({
				current: i + 1,
				total: photos.length,
				currentFileName: photo.name
			});
		}

		let blobToUse = photo.processedBlob;

		// If photo has not been processed yet or needs refresh, process it now
		if (!blobToUse) {
			const res = await processPhotoWithOverlay(photo, settings, fallbackCoords);
			blobToUse = res.blob;
		}

		// Clean base filename without original extension
		const baseName = photo.name.replace(/\.[^/.]+$/, '');
		const fileName = `geo_${baseName}.${ext}`;

		zip.file(fileName, blobToUse);
	}

	// Generate zip blob
	const zipBlob = await zip.generateAsync({
		type: 'blob',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});

	// Trigger download
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const zipFileName = `photos-geotagged-${timestamp}.zip`;

	downloadBlob(zipBlob, zipFileName);
}

/**
 * Triggers client-side download for a single Blob
 */
export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
