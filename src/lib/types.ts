export interface Coordinates {
	lat: number;
	lng: number;
}

export interface PhotoItem {
	id: string;
	file: File;
	name: string;
	size: number;
	objectUrl: string;
	width: number;
	height: number;
	lat: number | null;
	lng: number | null;
	hasExifCoords: boolean;
	hasExifDate: boolean;
	timestamp: string; // ISO date string or formatted
	customNote?: string;
	locationAddress?: string;
	processedBlob: Blob | null;
	processedDataUrl: string | null;
	isProcessing: boolean;
	error?: string;
}

export type MapTileProvider =
	| 'google_roadmap'
	| 'google_satellite'
	| 'google_hybrid'
	| 'google_terrain'
	| 'osm'
	| 'carto_voyager';

export type OverlayPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export type LayoutStyle =
	| 'gps_badge' // Classic GPS Map Camera badge (Map box + dark info box side-by-side or stacked)
	| 'split' // Map in one corner, timestamp badge in opposite corner
	| 'bottom_banner'; // Full width translucent bar across bottom

export type DateTimeFormatOption =
	| 'DD/MM/YYYY HH:mm:ss'
	| 'YYYY-MM-DD HH:mm:ss'
	| 'DD MMMM YYYY, HH:mm'
	| 'DD MMM YYYY, HH:mm:ss WIB'
	| 'ISO';

export interface OverlaySettings {
	mapProvider: MapTileProvider;
	zoom: number; // 12 - 19
	position: OverlayPosition;
	layoutStyle: LayoutStyle;
	mapSizePercent: number; // 18% to 40% of photo width
	showMap: boolean;
	showDateTime: boolean;
	dateTimeFormat: DateTimeFormatOption;
	showCoordinates: boolean;
	coordFormat: 'decimal' | 'dms';
	showAddress: boolean;
	customProjectNote: string;
	badgeTheme: 'dark' | 'light' | 'semi-dark';
	fontScale: number; // 0.8 to 1.4
	borderRadius: number; // in relative px
	outputQuality: number; // 0.8 to 1.0 (default 0.92)
	outputFormat: 'image/jpeg' | 'image/png';
}

export const DEFAULT_SETTINGS: OverlaySettings = {
	mapProvider: 'google_roadmap',
	zoom: 16,
	position: 'bottom-left',
	layoutStyle: 'gps_badge',
	mapSizePercent: 24,
	showMap: true,
	showDateTime: true,
	dateTimeFormat: 'DD/MM/YYYY HH:mm:ss',
	showCoordinates: true,
	coordFormat: 'decimal',
	showAddress: true,
	customProjectNote: '',
	badgeTheme: 'semi-dark',
	fontScale: 1.0,
	borderRadius: 8,
	outputQuality: 0.92,
	outputFormat: 'image/jpeg'
};
