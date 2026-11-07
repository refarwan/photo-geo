<script lang="ts">
	import type { PhotoItem, Coordinates, OverlaySettings } from '#lib/types';
	import { DEFAULT_SETTINGS } from '#lib/types';
	import { extractExifData } from '#lib/utils/exif';
	import { processPhotoWithOverlay } from '#lib/utils/photoProcessor';
	import { downloadAllAsZip, downloadBlob } from '#lib/utils/zip';
	import { parseCoordinates, reverseGeocode, formatCoordinates } from '#lib/utils/geo';

	import Navbar from '#lib/components/Navbar.svelte';
	import PhotoUploader from '#lib/components/PhotoUploader.svelte';
	import PhotoCard from '#lib/components/PhotoCard.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';
	import MapPickerModal from '#lib/components/MapPickerModal.svelte';
	import PreviewModal from '#lib/components/PreviewModal.svelte';

	import {
		MapPin,
		Trash2,
		Download,
		RefreshCw,
		CheckCircle2,
		Sparkles,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';

	// App State
	let photos = $state<PhotoItem[]>([]);
	let settings = $state<OverlaySettings>({ ...DEFAULT_SETTINGS });

	// Default global coordinates (Jakarta Pusat / Monas)
	let globalCoords = $state<Coordinates>({ lat: -6.175392, lng: 106.827153 });
	let globalAddress = $state<string>('Gambir, Jakarta Pusat, DKI Jakarta');

	// Selected photo for direct showcase view
	let selectedPhotoId = $state<string | null>(null);
	let showOriginalComparison = $state<boolean>(false);

	// Quick input for pasting link or coordinates directly
	let quickInputText = $state<string>('');
	let isQuickResolving = $state<boolean>(false);

	// Active modals
	let isMapModalOpen = $state<boolean>(false);
	let mapModalPhoto = $state<PhotoItem | null>(null); // null means editing global
	let previewModalPhoto = $state<PhotoItem | null>(null);

	// Processing & Zip status
	let isProcessingQueue = $state<boolean>(false);
	let isZipping = $state<boolean>(false);
	let zipProgress = $state<{ current: number; total: number; currentFileName: string } | null>(
		null
	);

	// Mobile settings drawer toggle
	let showMobileSettings = $state<boolean>(false);

	// Derived counts & current selected photo
	const totalPhotos = $derived(photos.length);
	const selectedPhoto = $derived(photos.find((p) => p.id === selectedPhotoId) || photos[0] || null);
	const selectedIndex = $derived(
		photos.findIndex((p) => p.id === (selectedPhoto ? selectedPhoto.id : ''))
	);

	// Handle adding files
	async function handleFilesSelected(files: FileList | File[]) {
		const newPhotos: PhotoItem[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (!file.type.startsWith('image/')) continue;

			const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
			const objectUrl = URL.createObjectURL(file);

			// Extract EXIF data
			const exif = await extractExifData(file);

			// Measure dimensions
			const dims = await getImageDimensions(objectUrl);

			const photoItem: PhotoItem = {
				id,
				file,
				name: file.name,
				size: file.size,
				objectUrl,
				width: dims.width,
				height: dims.height,
				lat: exif.lat,
				lng: exif.lng,
				hasExifCoords: exif.hasExifCoords,
				hasExifDate: exif.hasExifDate,
				timestamp: exif.timestamp,
				processedBlob: null,
				processedDataUrl: null,
				isProcessing: false
			};

			newPhotos.push(photoItem);
		}

		if (newPhotos.length > 0) {
			photos = [...photos, ...newPhotos];
			if (!selectedPhotoId) {
				selectedPhotoId = newPhotos[0].id;
			}
			// Process new photos immediately
			await processBatch(newPhotos.map((p) => p.id));
		}
	}

	function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve({ width: img.naturalWidth || 1200, height: img.naturalHeight || 800 });
			};
			img.onerror = () => {
				resolve({ width: 1200, height: 800 });
			};
			img.src = url;
		});
	}

	// Process queue of photos with reactive state updates
	async function processBatch(photoIds?: string[]) {
		if (isProcessingQueue) return;
		isProcessingQueue = true;

		const targets = photoIds ? photos.filter((p) => photoIds.includes(p.id)) : [...photos];

		for (const p of targets) {
			const idx = photos.findIndex((item) => item.id === p.id);
			if (idx !== -1) {
				photos[idx] = { ...photos[idx], isProcessing: true };
			}

			try {
				const activeLat = p.lat ?? globalCoords.lat;
				const activeLng = p.lng ?? globalCoords.lng;

				let addr = p.locationAddress;
				if (!addr && activeLat && activeLng) {
					addr = (await reverseGeocode(activeLat, activeLng)) || undefined;
				}

				const result = await processPhotoWithOverlay(p, settings, globalCoords);

				// Update reactive array element directly to trigger instant UI update
				const updatedIdx = photos.findIndex((item) => item.id === p.id);
				if (updatedIdx !== -1) {
					if (photos[updatedIdx].processedDataUrl) {
						URL.revokeObjectURL(photos[updatedIdx].processedDataUrl!);
					}
					photos[updatedIdx] = {
						...photos[updatedIdx],
						locationAddress: addr,
						processedBlob: result.blob,
						processedDataUrl: result.dataUrl,
						isProcessing: false,
						error: undefined
					};
				}
			} catch (err) {
				console.error('Failed to process photo:', p.name, err);
				const errIdx = photos.findIndex((item) => item.id === p.id);
				if (errIdx !== -1) {
					photos[errIdx] = {
						...photos[errIdx],
						isProcessing: false,
						error: err instanceof Error ? err.message : 'Gagal memproses foto'
					};
				}
			}
		}

		isProcessingQueue = false;
	}

	// Remove photo
	function removePhoto(id: string) {
		const target = photos.find((p) => p.id === id);
		if (target) {
			URL.revokeObjectURL(target.objectUrl);
			if (target.processedDataUrl) URL.revokeObjectURL(target.processedDataUrl);
		}
		photos = photos.filter((p) => p.id !== id);
		if (selectedPhotoId === id) {
			selectedPhotoId = photos.length > 0 ? photos[0].id : null;
		}
	}

	// Clear all photos
	function clearAllPhotos() {
		if (confirm('Apakah Anda yakin ingin menghapus semua foto?')) {
			photos.forEach((p) => {
				URL.revokeObjectURL(p.objectUrl);
				if (p.processedDataUrl) URL.revokeObjectURL(p.processedDataUrl);
			});
			photos = [];
			selectedPhotoId = null;
		}
	}

	// Open Map Picker
	function openMapPicker(photo?: PhotoItem) {
		mapModalPhoto = photo || null;
		isMapModalOpen = true;
	}

	// Apply coordinates from Map Picker
	function handleApplyCoordinates(coords: Coordinates, applyToAll: boolean, address?: string) {
		if (mapModalPhoto && !applyToAll) {
			// Update single photo
			const idx = photos.findIndex((p) => p.id === mapModalPhoto!.id);
			if (idx !== -1) {
				photos[idx] = {
					...photos[idx],
					lat: coords.lat,
					lng: coords.lng,
					locationAddress: address || photos[idx].locationAddress
				};
				processBatch([photos[idx].id]);
			}
		} else {
			// Update global coordinates and apply to all photos
			globalCoords = coords;
			if (address) globalAddress = address;

			photos = photos.map((p) => ({
				...p,
				lat: coords.lat,
				lng: coords.lng,
				locationAddress: address || p.locationAddress
			}));

			processBatch();
		}

		isMapModalOpen = false;
		mapModalPhoto = null;
	}

	// Handle quick paste of coordinates or Google Maps link directly on main page
	async function handleQuickPasteSubmit(e?: Event) {
		if (e) e.preventDefault();
		if (!quickInputText.trim()) return;

		const direct = parseCoordinates(quickInputText);
		if (direct) {
			const addr = await reverseGeocode(direct.lat, direct.lng);
			handleApplyCoordinates(direct, true, addr || undefined);
			quickInputText = '';
			return;
		}

		if (
			quickInputText.includes('goo.gl') ||
			quickInputText.includes('maps.app') ||
			quickInputText.includes('google.com/maps')
		) {
			isQuickResolving = true;
			try {
				const res = await fetch('/api/resolve-maps-url', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: quickInputText })
				});
				const data = await res.json();
				if (data.success && data.coords) {
					const addr = await reverseGeocode(data.coords.lat, data.coords.lng);
					handleApplyCoordinates(data.coords, true, addr || undefined);
					quickInputText = '';
					return;
				} else {
					alert(data.error || 'Gagal mengekstrak koordinat dari link');
				}
			} catch {
				alert('Terjadi kesalahan saat memproses link Google Maps');
			} finally {
				isQuickResolving = false;
			}
		} else {
			alert(
				'Format tidak dikenali. Masukkan koordinat seperti "-6.2088, 106.8456" atau link Google Maps.'
			);
		}
	}

	// Update individual timestamp
	function handleUpdateTimestamp(id: string, newTimestamp: string) {
		const idx = photos.findIndex((p) => p.id === id);
		if (idx !== -1) {
			photos[idx] = { ...photos[idx], timestamp: newTimestamp };
			processBatch([id]);
		}
	}

	// Navigation for showcase view
	function selectNextPhoto() {
		if (photos.length === 0) return;
		const nextIdx = (selectedIndex + 1) % photos.length;
		selectedPhotoId = photos[nextIdx].id;
	}

	function selectPrevPhoto() {
		if (photos.length === 0) return;
		const prevIdx = (selectedIndex - 1 + photos.length) % photos.length;
		selectedPhotoId = photos[prevIdx].id;
	}

	// Download single photo
	function downloadCurrentSelectedPhoto() {
		if (selectedPhoto && selectedPhoto.processedBlob) {
			const ext = settings.outputFormat === 'image/png' ? 'png' : 'jpg';
			const baseName = selectedPhoto.name.replace(/\.[^/.]+$/, '');
			downloadBlob(selectedPhoto.processedBlob, `geo_${baseName}.${ext}`);
		}
	}

	// Download ZIP
	async function handleDownloadZip() {
		if (photos.length === 0 || isZipping) return;

		isZipping = true;
		zipProgress = { current: 0, total: photos.length, currentFileName: '' };

		try {
			await downloadAllAsZip(photos, settings, globalCoords, (progress) => {
				zipProgress = progress;
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
			alert('Gagal membuat file ZIP: ' + msg);
		} finally {
			isZipping = false;
			zipProgress = null;
		}
	}

	// Sample photos generator for immediate testing
	async function loadSamplePhotos() {
		const samples = [
			{ name: 'survey_lokasi_1.jpg', text: 'Survey Lokasi Proyek A', bg: '#1e293b' },
			{ name: 'survey_lokasi_2.jpg', text: 'Inspeksi Lapangan Konstruksi B', bg: '#0f3a40' }
		];

		const createdFiles: File[] = [];

		for (const s of samples) {
			const canvas = document.createElement('canvas');
			canvas.width = 1600;
			canvas.height = 1200;
			const ctx = canvas.getContext('2d');
			if (ctx) {
				// Gradient background
				const grad = ctx.createLinearGradient(0, 0, 1600, 1200);
				grad.addColorStop(0, s.bg);
				grad.addColorStop(1, '#020617');
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, 1600, 1200);

				// Grid lines
				ctx.strokeStyle = 'rgba(255,255,255,0.08)';
				ctx.lineWidth = 2;
				for (let x = 0; x < 1600; x += 100) {
					ctx.beginPath();
					ctx.moveTo(x, 0);
					ctx.lineTo(x, 1200);
					ctx.stroke();
				}
				for (let y = 0; y < 1200; y += 100) {
					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(1600, y);
					ctx.stroke();
				}

				// Sample text
				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 54px sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(s.text, 800, 560);

				ctx.fillStyle = '#94a3b8';
				ctx.font = '28px sans-serif';
				ctx.fillText('1600 × 1200 px • Contoh Foto Uji Coba', 800, 640);

				const blob = await new Promise<Blob>((res) =>
					canvas.toBlob((b) => res(b!), 'image/jpeg', 0.95)
				);
				const file = new File([blob], s.name, { type: 'image/jpeg', lastModified: Date.now() });
				createdFiles.push(file);
			}
		}

		await handleFilesSelected(createdFiles);
	}
</script>

<svelte:head>
	<title>
		{totalPhotos > 0
			? `(${totalPhotos}) PhotoGeo - Tempel Peta Google Maps & Waktu`
			: 'PhotoGeo - Tempel Peta Google Maps, Tanggal & Jam pada Foto'}
	</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 selection:bg-red-500 selection:text-white dark:bg-slate-950 dark:text-slate-100"
>
	<!-- Navbar Header -->
	<Navbar
		{totalPhotos}
		{globalCoords}
		{isZipping}
		onOpenGlobalMap={() => openMapPicker()}
		onDownloadZip={handleDownloadZip}
		onToggleSettings={() => (showMobileSettings = !showMobileSettings)}
	/>

	<!-- Main Content Body -->
	<main class="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
		<!-- Global Coordinates & Quick Paste Bar -->
		<div
			class="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-950/60 dark:text-red-400">
					<MapPin class="h-5 w-5" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xs font-semibold tracking-wider text-slate-400 uppercase"
							>Titik Koordinat Aktif:</span
						>
						<span class="font-mono text-sm font-bold text-slate-900 dark:text-white">
							{formatCoordinates(globalCoords.lat, globalCoords.lng, 'decimal')}
						</span>
					</div>
					<p class="mt-0.5 text-xs leading-relaxed break-words text-slate-500 dark:text-slate-400">
						{globalAddress || 'Koordinat akan otomatis ditempelkan pada semua foto'}
					</p>
				</div>
			</div>

			<!-- Quick Paste Input & Map Picker Button -->
			<div class="flex flex-wrap items-center gap-2">
				<form
					onsubmit={handleQuickPasteSubmit}
					class="relative flex min-w-[260px] items-center sm:min-w-[320px]"
				>
					<input
						type="text"
						bind:value={quickInputText}
						placeholder="Paste link Google Maps / koordinat..."
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-20 pl-3 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
					/>
					<button
						type="submit"
						disabled={isQuickResolving || !quickInputText.trim()}
						class="absolute right-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
					>
						{isQuickResolving ? 'Memuat...' : 'Terapkan'}
					</button>
				</form>

				<button
					type="button"
					onclick={() => openMapPicker()}
					class="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-xs transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
				>
					<MapPin class="h-3.5 w-3.5 text-red-400" />
					Buka Peta Interaktif
				</button>
			</div>
		</div>

		<!-- Layout: Left (Photos) & Right (Settings) -->
		<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
			<!-- Photos Column -->
			<div class="space-y-6 lg:col-span-8">
				<!-- Upload Dropzone -->
				<PhotoUploader onFilesSelected={handleFilesSelected} />

				<!-- If no photos uploaded yet: Guide & Sample Photos -->
				{#if photos.length === 0}
					<div
						class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-8 dark:border-slate-800 dark:bg-slate-900/60"
					>
						<div
							class="inline-flex items-center justify-center rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
						>
							<Sparkles class="h-6 w-6" />
						</div>

						<div class="mx-auto max-w-md">
							<h3 class="text-base font-bold text-slate-800 dark:text-slate-200">
								Belum ada foto yang diupload
							</h3>
							<p class="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
								Upload beberapa foto di atas. Gambar Google Maps, tanggal, dan jam akan <strong
									>langsung ditempelkan dan langsung terlihat</strong
								> pada foto.
							</p>
						</div>

						<div class="pt-2">
							<button
								type="button"
								onclick={loadSamplePhotos}
								class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
							>
								<Sparkles class="h-3.5 w-3.5 text-amber-500" />
								Coba dengan 2 Foto Contoh
							</button>
						</div>
					</div>
				{:else}
					<!-- 🌟 DIRECT LIVE RESULT SHOWCASE (TAMPIL LANGSUNG TANPA KLIK PRATINJAU) 🌟 -->
					{#if selectedPhoto}
						<div
							class="space-y-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900"
						>
							<!-- Showcase Header -->
							<div
								class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-800/50"
							>
								<div class="flex items-center gap-2">
									<div class="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"></div>
									<h3 class="text-sm font-bold text-slate-900 dark:text-white">
										Hasil Langsung ({selectedIndex + 1} dari {photos.length}):
										<span class="font-medium text-slate-600 dark:text-slate-300"
											>{selectedPhoto.name}</span
										>
									</h3>
								</div>

								<div class="flex items-center gap-2">
									<!-- Toggle Compare with Original -->
									<button
										type="button"
										onclick={() => (showOriginalComparison = !showOriginalComparison)}
										class="rounded-lg px-2.5 py-1 text-xs font-semibold transition {showOriginalComparison
											? 'bg-amber-600 text-white'
											: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}"
									>
										{showOriginalComparison ? 'Melihat Foto Asli' : 'Bandingkan Asli'}
									</button>

									<!-- Prev / Next navigation -->
									{#if photos.length > 1}
										<div
											class="flex items-center gap-1 rounded-lg bg-slate-200 p-0.5 dark:bg-slate-700/60"
										>
											<button
												type="button"
												onclick={selectPrevPhoto}
												class="rounded-md p-1 text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-600"
												title="Foto Sebelumnya"
											>
												<ChevronLeft class="h-4 w-4" />
											</button>
											<span class="px-1.5 font-mono text-[11px] font-bold">
												{selectedIndex + 1}/{photos.length}
											</span>
											<button
												type="button"
												onclick={selectNextPhoto}
												class="rounded-md p-1 text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-600"
												title="Foto Berikutnya"
											>
												<ChevronRight class="h-4 w-4" />
											</button>
										</div>
									{/if}

									<!-- Download this single photo -->
									{#if selectedPhoto.processedBlob}
										<button
											type="button"
											onclick={downloadCurrentSelectedPhoto}
											class="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700"
										>
											<Download class="h-3.5 w-3.5" />
											Download Foto Ini
										</button>
									{/if}
								</div>
							</div>

							<!-- Showcase Main Display Image -->
							<div
								class="relative flex min-h-[380px] items-center justify-center bg-slate-950 p-3 sm:min-h-[480px] sm:p-5"
							>
								{#if selectedPhoto.isProcessing}
									<div class="flex flex-col items-center gap-2 py-16 text-slate-400">
										<RefreshCw class="h-8 w-8 animate-spin text-red-500" />
										<p class="text-xs font-medium">
											Sedang menempel gambar Google Maps dan timestamp...
										</p>
									</div>
								{:else if showOriginalComparison}
									<img
										src={selectedPhoto.objectUrl}
										alt="Original: {selectedPhoto.name}"
										class="max-h-[580px] max-w-full rounded-xl object-contain shadow-2xl"
									/>
								{:else if selectedPhoto.processedDataUrl}
									<img
										src={selectedPhoto.processedDataUrl}
										alt="Processed: {selectedPhoto.name}"
										class="max-h-[580px] max-w-full rounded-xl object-contain shadow-2xl transition-all duration-200"
									/>
								{:else}
									<div class="flex flex-col items-center gap-2 py-16 text-slate-400">
										<p class="text-xs">Memuat foto...</p>
									</div>
								{/if}
							</div>

							<!-- Thumbnail Carousel Strip if multiple photos -->
							{#if photos.length > 1}
								<div
									class="flex items-center gap-2.5 overflow-x-auto border-t border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-800/80"
								>
									{#each photos as p, i (p.id)}
										<button
											type="button"
											onclick={() => {
												selectedPhotoId = p.id;
												showOriginalComparison = false;
											}}
											class="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 p-0 transition-all {selectedPhotoId ===
											p.id
												? 'scale-105 border-red-500 ring-2 ring-red-500/30'
												: 'border-transparent opacity-60 hover:opacity-100'}"
										>
											<img
												src={p.processedDataUrl || p.objectUrl}
												alt={p.name}
												class="h-full w-full object-cover"
											/>
											<span
												class="absolute right-1 bottom-0.5 rounded-xs bg-black/60 px-1 text-[9px] font-bold text-white"
											>
												#{i + 1}
											</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Section Header for All Photos Grid -->
					<div class="flex items-center justify-between gap-4 pt-4">
						<div class="flex items-center gap-2">
							<h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
								Semua Foto ({photos.length})
							</h3>
							{#if isProcessingQueue}
								<span
									class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"
								>
									<RefreshCw class="h-3 w-3 animate-spin" />
									Sedang memproses...
								</span>
							{:else}
								<span
									class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
								>
									<CheckCircle2 class="h-3 w-3" />
									Hasil langsung siap
								</span>
							{/if}
						</div>

						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => processBatch()}
								disabled={isProcessingQueue}
								class="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
								title="Proses ulang semua foto dengan pengaturan saat ini"
							>
								<RefreshCw class="h-3.5 w-3.5 {isProcessingQueue ? 'animate-spin' : ''}" />
								Refresh
							</button>
							<button
								type="button"
								onclick={clearAllPhotos}
								class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
							>
								<Trash2 class="h-3.5 w-3.5" />
								Hapus Semua
							</button>
						</div>
					</div>

					<!-- Photos Grid (Each card directly shows the full result) -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each photos as photo (photo.id)}
							<PhotoCard
								{photo}
								{globalCoords}
								isSelected={selectedPhotoId === photo.id}
								onSelect={(p) => {
									selectedPhotoId = p.id;
									showOriginalComparison = false;
								}}
								onEditCoords={(p) => openMapPicker(p)}
								onPreview={(p) => (selectedPhotoId = p.id)}
								onRemove={removePhoto}
								onUpdateTimestamp={handleUpdateTimestamp}
							/>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Settings Column (Desktop) -->
			<div class="sticky top-22 hidden space-y-4 lg:col-span-4 lg:block">
				<SettingsPanel
					{settings}
					onSettingsChange={(newSettings) => {
						settings = newSettings;
						processBatch();
					}}
					onApplyAll={() => processBatch()}
					onApplyGlobalTimestamp={(ts) => {
						photos = photos.map((p) => ({ ...p, timestamp: ts }));
						processBatch();
					}}
					isProcessingAll={isProcessingQueue}
				/>
			</div>
		</div>
	</main>

	<!-- Mobile Settings Drawer -->
	{#if showMobileSettings}
		<div class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs lg:hidden">
			<div class="h-full w-full max-w-sm overflow-y-auto bg-white p-4 dark:bg-slate-900">
				<div
					class="mb-3 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800"
				>
					<h3 class="text-sm font-bold">Pengaturan Watermark</h3>
					<button
						type="button"
						onclick={() => (showMobileSettings = false)}
						class="px-2 py-1 text-xs font-semibold text-slate-500"
					>
						Tutup
					</button>
				</div>
				<SettingsPanel
					{settings}
					onSettingsChange={(newSettings) => {
						settings = newSettings;
						processBatch();
					}}
					onApplyAll={() => {
						processBatch();
						showMobileSettings = false;
					}}
					onApplyGlobalTimestamp={(ts) => {
						photos = photos.map((p) => ({ ...p, timestamp: ts }));
						processBatch();
					}}
					isProcessingAll={isProcessingQueue}
				/>
			</div>
		</div>
	{/if}

	<!-- Map Picker Modal -->
	{#if isMapModalOpen}
		<MapPickerModal
			initialCoords={mapModalPhoto?.lat && mapModalPhoto?.lng
				? { lat: mapModalPhoto.lat, lng: mapModalPhoto.lng }
				: globalCoords}
			photoName={mapModalPhoto?.name}
			onApply={handleApplyCoordinates}
			onClose={() => {
				isMapModalOpen = false;
				mapModalPhoto = null;
			}}
		/>
	{/if}

	<!-- Preview Modal (if needed as fallback) -->
	{#if previewModalPhoto}
		<PreviewModal photo={previewModalPhoto} onClose={() => (previewModalPhoto = null)} />
	{/if}

	<!-- Zip Progress Toast / Overlay -->
	{#if isZipping && zipProgress}
		<div
			class="animate-in slide-in-from-bottom fixed right-6 bottom-6 z-50 flex max-w-md items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-white shadow-2xl duration-200"
		>
			<div class="rounded-xl bg-red-600/30 p-2.5 text-red-400">
				<RefreshCw class="h-5 w-5 animate-spin" />
			</div>
			<div>
				<h4 class="text-xs font-bold tracking-wider text-slate-300 uppercase">
					Membuat File ZIP...
				</h4>
				<p class="mt-0.5 text-xs text-slate-400">
					Memproses {zipProgress.current} dari {zipProgress.total} foto ({zipProgress.currentFileName})
				</p>
			</div>
		</div>
	{/if}
</div>
