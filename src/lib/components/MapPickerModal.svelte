<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type * as Leaflet from 'leaflet';
	import { parseCoordinates, reverseGeocode } from '#lib/utils/geo';
	import type { Coordinates, MapTileProvider } from '#lib/types';
	import {
		Search,
		MapPin,
		Navigation,
		Check,
		X,
		Loader2,
		ExternalLink,
		Sparkles
	} from 'lucide-svelte';

	interface Props {
		initialCoords?: Coordinates | null;
		photoName?: string | null;
		onApply: (coords: Coordinates, applyToAll: boolean, address?: string) => void;
		onClose: () => void;
	}

	let { initialCoords = null, photoName = null, onApply, onClose }: Props = $props();

	// State
	let lat = $state<number>(-6.2088);
	let lng = $state<number>(106.8456);
	let address = $state<string>('');
	let isReverseGeocoding = $state<boolean>(false);

	let inputUrlOrCoord = $state<string>('');
	let searchPlaceQuery = $state<string>('');
	let isSearching = $state<boolean>(false);
	let isResolvingUrl = $state<boolean>(false);
	let searchResults = $state<Array<{ display_name: string; lat: string; lon: string }>>([]);

	let activeMapProvider = $state<MapTileProvider>('google_roadmap');
	let mapContainer: HTMLDivElement | null = $state(null);
	let mapInstance: Leaflet.Map | null = null;
	let markerInstance: Leaflet.Marker | null = null;
	let tileLayerInstance: Leaflet.TileLayer | null = null;
	let L: typeof Leaflet | null = null;

	onMount(async () => {
		if (typeof window === 'undefined') return;

		if (initialCoords) {
			lat = initialCoords.lat;
			lng = initialCoords.lng;
		}

		// Dynamically import Leaflet
		L = await import('leaflet');

		if (!mapContainer) return;

		// Initialize Leaflet Map
		mapInstance = L.map(mapContainer, {
			center: [lat, lng],
			zoom: 15,
			zoomControl: true
		});

		// Custom red marker icon
		const customIcon = L.divIcon({
			className: 'custom-map-pin',
			html: `
				<div style="position: relative; width: 32px; height: 32px;">
					<svg viewBox="0 0 24 34" width="32" height="34" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
						<path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22c0-6.63-5.37-12-12-12z" fill="#EA4335" stroke="#C5221F" stroke-width="1"/>
						<circle cx="12" cy="12" r="5" fill="#FFFFFF"/>
					</svg>
				</div>
			`,
			iconSize: [32, 34],
			iconAnchor: [16, 34]
		});

		markerInstance = L.marker([lat, lng], {
			draggable: true,
			icon: customIcon
		}).addTo(mapInstance);

		updateTileLayer();

		// Handle marker drag
		markerInstance.on('dragend', (e: Leaflet.LeafletEvent) => {
			const target = e.target as Leaflet.Marker;
			const pos = target.getLatLng();
			lat = Number(pos.lat.toFixed(6));
			lng = Number(pos.lng.toFixed(6));
			fetchAddress();
		});

		// Handle map click
		mapInstance.on('click', (e: Leaflet.LeafletMouseEvent) => {
			lat = Number(e.latlng.lat.toFixed(6));
			lng = Number(e.latlng.lng.toFixed(6));
			markerInstance?.setLatLng([lat, lng]);
			fetchAddress();
		});

		// Initial address fetch
		fetchAddress();
	});

	onDestroy(() => {
		if (mapInstance) {
			mapInstance.remove();
			mapInstance = null;
		}
	});

	function updateTileLayer() {
		if (!mapInstance || !L) return;
		if (tileLayerInstance) {
			mapInstance.removeLayer(tileLayerInstance);
		}

		let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
		let maxZoom = 20;

		if (activeMapProvider === 'google_satellite') {
			url = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
		} else if (activeMapProvider === 'google_hybrid') {
			url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
		} else if (activeMapProvider === 'google_terrain') {
			url = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
		} else if (activeMapProvider === 'osm') {
			url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
			maxZoom = 19;
		}

		tileLayerInstance = L.tileLayer(url, {
			maxZoom,
			attribution: 'Google Maps'
		}).addTo(mapInstance);
	}

	function setProvider(provider: MapTileProvider) {
		activeMapProvider = provider;
		updateTileLayer();
	}

	async function fetchAddress() {
		isReverseGeocoding = true;
		try {
			const res = await reverseGeocode(lat, lng);
			if (res) address = res;
		} finally {
			isReverseGeocoding = false;
		}
	}

	function setCenter(newLat: number, newLng: number, zoomLevel = 16) {
		lat = Number(newLat.toFixed(6));
		lng = Number(newLng.toFixed(6));
		if (mapInstance && markerInstance) {
			mapInstance.setView([lat, lng], zoomLevel);
			markerInstance.setLatLng([lat, lng]);
		}
		fetchAddress();
	}

	// Parse direct coordinates or Google Maps link
	async function handleUrlOrCoordSubmit(e?: Event) {
		if (e) e.preventDefault();
		if (!inputUrlOrCoord.trim()) return;

		// 1. Direct parse
		const direct = parseCoordinates(inputUrlOrCoord);
		if (direct) {
			setCenter(direct.lat, direct.lng);
			inputUrlOrCoord = '';
			return;
		}

		// 2. If it's a short link or needs server resolution
		if (inputUrlOrCoord.includes('goo.gl') || inputUrlOrCoord.includes('maps.app')) {
			isResolvingUrl = true;
			try {
				const res = await fetch('/api/resolve-maps-url', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: inputUrlOrCoord })
				});
				const data = await res.json();
				if (data.success && data.coords) {
					setCenter(data.coords.lat, data.coords.lng);
					inputUrlOrCoord = '';
					return;
				} else {
					alert(data.error || 'Gagal mengekstrak koordinat dari link');
				}
			} catch {
				alert('Terjadi kesalahan saat memproses link Google Maps');
			} finally {
				isResolvingUrl = false;
			}
		} else {
			alert(
				'Format tidak dikenali. Masukkan koordinat seperti "-6.2088, 106.8456" atau link Google Maps.'
			);
		}
	}

	// Search places with OpenStreetMap Nominatim
	async function handlePlaceSearch(e?: Event) {
		if (e) e.preventDefault();
		if (!searchPlaceQuery.trim()) return;

		isSearching = true;
		searchResults = [];
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchPlaceQuery)}&limit=5&addressdetails=1`
			);
			if (res.ok) {
				searchResults = await res.json();
			}
		} catch (err) {
			console.error(err);
		} finally {
			isSearching = false;
		}
	}

	function selectSearchResult(item: { lat: string; lon: string; display_name: string }) {
		setCenter(parseFloat(item.lat), parseFloat(item.lon));
		address = item.display_name;
		searchResults = [];
		searchPlaceQuery = '';
	}

	// Get browser GPS
	function getCurrentLocation() {
		if (!navigator.geolocation) {
			alert('Browser Anda tidak mendukung geolokasi');
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setCenter(pos.coords.latitude, pos.coords.longitude, 16);
			},
			(err) => {
				alert('Gagal mengambil lokasi GPS: ' + err.message);
			},
			{ enableHighAccuracy: true, timeout: 8000 }
		);
	}
</script>

<!-- Modal Backdrop -->
<div
	class="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs duration-200 sm:p-6"
>
	<div
		class="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50"
		>
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-red-100 p-2 text-red-600 dark:bg-red-950/60 dark:text-red-400">
					<MapPin class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">
						Pilih Koordinat Google Maps
					</h2>
					<p class="text-xs text-slate-500 dark:text-slate-400">
						{#if photoName}
							Untuk foto: <span class="font-medium text-slate-700 dark:text-slate-300"
								>{photoName}</span
							>
						{:else}
							Geser pin di peta atau masukkan link/koordinat Google Maps
						{/if}
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={onClose}
				class="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Body: Inputs & Map -->
		<div class="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
			<!-- Quick Input Section: Paste URL / Coords -->
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<!-- URL / Coords parser -->
				<form onsubmit={handleUrlOrCoordSubmit} class="relative flex items-center">
					<div class="absolute left-3 text-slate-400">
						<ExternalLink class="h-4 w-4" />
					</div>
					<input
						type="text"
						bind:value={inputUrlOrCoord}
						placeholder="Paste link Google Maps / koordinat lat,lng..."
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-24 pl-9 text-sm text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
					<button
						type="submit"
						disabled={isResolvingUrl || !inputUrlOrCoord.trim()}
						class="absolute right-1.5 flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
					>
						{#if isResolvingUrl}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
						{/if}
						Terapkan
					</button>
				</form>

				<!-- Place search -->
				<div class="relative">
					<form onsubmit={handlePlaceSearch} class="flex items-center">
						<div class="absolute left-3 text-slate-400">
							<Search class="h-4 w-4" />
						</div>
						<input
							type="text"
							bind:value={searchPlaceQuery}
							placeholder="Cari nama tempat / jalan..."
							class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-20 pl-9 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						/>
						<button
							type="submit"
							disabled={isSearching || !searchPlaceQuery.trim()}
							class="absolute right-1.5 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{#if isSearching}
								<Loader2 class="h-3.5 w-3.5 animate-spin" />
							{/if}
							Cari
						</button>
					</form>

					<!-- Search Autocomplete Dropdown -->
					{#if searchResults.length > 0}
						<div
							class="absolute right-0 left-0 z-20 mt-1 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800"
						>
							{#each searchResults as item (item.lat + ',' + item.lon)}
								<button
									type="button"
									onclick={() => selectSearchResult(item)}
									class="w-full px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
								>
									{item.display_name}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Coordinate Numbers & GPS Button -->
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-xs dark:border-slate-700/60 dark:bg-slate-800/60"
			>
				<div class="flex flex-wrap items-center gap-3">
					<div class="flex items-center gap-1.5">
						<span class="font-medium text-slate-500 dark:text-slate-400">Lat:</span>
						<input
							type="number"
							step="any"
							bind:value={lat}
							onchange={() => setCenter(lat, lng)}
							class="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
						/>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="font-medium text-slate-500 dark:text-slate-400">Lng:</span>
						<input
							type="number"
							step="any"
							bind:value={lng}
							onchange={() => setCenter(lat, lng)}
							class="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
						/>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={getCurrentLocation}
						class="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white shadow-xs transition hover:bg-emerald-700"
					>
						<Navigation class="h-3.5 w-3.5" />
						Gunakan GPS Saya
					</button>
				</div>
			</div>

			<!-- Map View Container -->
			<div
				class="relative h-80 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner sm:h-96 dark:border-slate-700"
			>
				<div bind:this={mapContainer} class="z-10 h-full w-full"></div>

				<!-- Map Provider Switcher Floating Controls -->
				<div
					class="absolute top-3 right-3 z-20 flex gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 text-xs shadow-md backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/90"
				>
					<button
						type="button"
						onclick={() => setProvider('google_roadmap')}
						class="rounded-lg px-2.5 py-1 font-medium transition {activeMapProvider ===
						'google_roadmap'
							? 'bg-red-600 text-white'
							: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
					>
						Roadmap
					</button>
					<button
						type="button"
						onclick={() => setProvider('google_satellite')}
						class="rounded-lg px-2.5 py-1 font-medium transition {activeMapProvider ===
						'google_satellite'
							? 'bg-red-600 text-white'
							: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
					>
						Satelit
					</button>
					<button
						type="button"
						onclick={() => setProvider('google_hybrid')}
						class="rounded-lg px-2.5 py-1 font-medium transition {activeMapProvider ===
						'google_hybrid'
							? 'bg-red-600 text-white'
							: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
					>
						Hybrid
					</button>
					<button
						type="button"
						onclick={() => setProvider('osm')}
						class="rounded-lg px-2.5 py-1 font-medium transition {activeMapProvider === 'osm'
							? 'bg-red-600 text-white'
							: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
					>
						OSM
					</button>
				</div>

				<!-- Help Pin Hint -->
				<div
					class="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg bg-black/60 px-3 py-1.5 text-[11px] text-white shadow-sm backdrop-blur-xs"
				>
					💡 Klik di peta atau drag pin merah untuk menyesuaikan titik
				</div>
			</div>

			<!-- Reverse Geocoded Address Preview -->
			{#if address || isReverseGeocoding}
				<div
					class="flex items-start gap-2 rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-xs dark:border-slate-700/60 dark:bg-slate-800/60"
				>
					<div class="mt-0.5 text-red-500">
						{#if isReverseGeocoding}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							<MapPin class="h-4 w-4" />
						{/if}
					</div>
					<div class="flex-1">
						<span class="font-semibold text-slate-700 dark:text-slate-300">Alamat Terdeteksi:</span>
						<p class="mt-0.5 text-slate-600 dark:text-slate-400">
							{address || 'Mengambil alamat...'}
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer Actions -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50"
		>
			<button
				type="button"
				onclick={onClose}
				class="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
			>
				Batal
			</button>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => onApply({ lat, lng }, false, address)}
					class="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
				>
					<Check class="h-4 w-4" />
					Terapkan ke Foto Ini
				</button>
				<button
					type="button"
					onclick={() => onApply({ lat, lng }, true, address)}
					class="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700"
				>
					<Sparkles class="h-4 w-4" />
					Terapkan ke Semua Foto
				</button>
			</div>
		</div>
	</div>
</div>
