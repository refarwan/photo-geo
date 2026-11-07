import exifr from 'exifr';

export interface ExifExtractionResult {
	lat: number | null;
	lng: number | null;
	timestamp: string; // ISO string
	hasExifCoords: boolean;
	hasExifDate: boolean;
}

/**
 * Extracts GPS coordinates and timestamp from an image File.
 */
export async function extractExifData(file: File): Promise<ExifExtractionResult> {
	let lat: number | null = null;
	let lng: number | null = null;
	let timestamp: string = '';
	let hasExifCoords = false;
	let hasExifDate = false;

	try {
		// Read GPS and dates
		const data = await exifr.parse(file, {
			gps: true,
			pick: ['latitude', 'longitude', 'DateTimeOriginal', 'CreateDate', 'ModifyDate']
		});

		if (data) {
			if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
				lat = data.latitude;
				lng = data.longitude;
				hasExifCoords = true;
			}

			const dateCandidate = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
			if (dateCandidate instanceof Date && !isNaN(dateCandidate.getTime())) {
				timestamp = dateCandidate.toISOString();
				hasExifDate = true;
			}
		}
	} catch (e) {
		console.warn('Could not parse EXIF data for file:', file.name, e);
	}

	// Fallback timestamp if not found in EXIF
	if (!timestamp) {
		if (file.lastModified) {
			timestamp = new Date(file.lastModified).toISOString();
		} else {
			timestamp = new Date().toISOString();
		}
	}

	return {
		lat,
		lng,
		timestamp,
		hasExifCoords,
		hasExifDate
	};
}
