<script lang="ts">
	import type { PhotoItem, Coordinates } from '#lib/types';
	import { MapPin, Calendar, Download, Trash2, Loader2, CheckCircle2, Edit3 } from 'lucide-svelte';
	import { formatCoordinates, formatDateTime } from '#lib/utils/geo';
	import { downloadBlob } from '#lib/utils/zip';

	interface Props {
		photo: PhotoItem;
		globalCoords?: Coordinates | null;
		isSelected?: boolean;
		onSelect?: (photo: PhotoItem) => void;
		onEditCoords: (photo: PhotoItem) => void;
		onPreview: (photo: PhotoItem) => void;
		onRemove: (id: string) => void;
		onUpdateTimestamp: (id: string, newTimestamp: string) => void;
	}

	let {
		photo,
		globalCoords = null,
		isSelected = false,
		onSelect,
		onEditCoords,
		onPreview,
		onRemove,
		onUpdateTimestamp
	}: Props = $props();

	let isEditingDate = $state(false);
	let editDateValue = $state('');

	function startEditDate() {
		// Convert ISO to datetime-local string YYYY-MM-DDTHH:mm
		try {
			const d = new Date(photo.timestamp);
			const pad = (n: number) => n.toString().padStart(2, '0');
			editDateValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
			isEditingDate = true;
		} catch {
			isEditingDate = false;
		}
	}

	function saveDate() {
		if (editDateValue) {
			const d = new Date(editDateValue);
			if (!isNaN(d.getTime())) {
				onUpdateTimestamp(photo.id, d.toISOString());
			}
		}
		isEditingDate = false;
	}

	function handleDownloadSingle() {
		if (photo.processedBlob) {
			downloadBlob(photo.processedBlob, `geo_${photo.name}`);
		}
	}

	const activeLat = $derived(photo.lat ?? globalCoords?.lat ?? null);
	const activeLng = $derived(photo.lng ?? globalCoords?.lng ?? null);
</script>

<div
	class="group rounded-2xl border bg-white dark:bg-slate-900 {isSelected
		? 'border-red-500 shadow-md ring-2 ring-red-500/20'
		: 'border-slate-200 shadow-sm hover:shadow-md dark:border-slate-800'} flex flex-col overflow-hidden transition-all duration-200"
>
	<!-- Thumbnail / Result Area (Full uncropped view) -->
	<button
		type="button"
		class="relative flex aspect-16/10 w-full cursor-pointer items-center justify-center overflow-hidden border-0 bg-slate-950 p-0 text-left"
		onclick={() => (onSelect ? onSelect(photo) : onPreview(photo))}
	>
		{#if photo.processedDataUrl}
			<img src={photo.processedDataUrl} alt={photo.name} class="h-full w-full object-contain" />
		{:else}
			<img src={photo.objectUrl} alt={photo.name} class="h-full w-full object-contain opacity-70" />
		{/if}

		<!-- Status Badge overlay -->
		<div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
			{#if photo.isProcessing}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs"
				>
					<Loader2 class="h-3 w-3 animate-spin" />
					Memproses...
				</span>
			{:else if photo.processedBlob}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs"
				>
					<CheckCircle2 class="h-3 w-3" />
					Hasil Siap
				</span>
			{/if}

			{#if photo.hasExifCoords}
				<span
					class="inline-flex items-center gap-1 rounded-md bg-blue-600/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs"
					title="GPS diambil dari EXIF kamera"
				>
					EXIF GPS
				</span>
			{/if}
		</div>
	</button>

	<!-- Content Details -->
	<div class="flex flex-1 flex-col justify-between gap-3 p-3.5 text-xs">
		<div class="space-y-2">
			<!-- Filename -->
			<div class="flex items-start justify-between gap-2">
				<h4
					class="flex-1 truncate font-semibold text-slate-800 dark:text-slate-200"
					title={photo.name}
				>
					{photo.name}
				</h4>
				<span class="font-mono text-[11px] text-slate-400">
					{photo.width}×{photo.height}
				</span>
			</div>

			<!-- Date & Time Row -->
			<div
				class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
			>
				{#if isEditingDate}
					<div class="flex w-full items-center gap-1">
						<input
							type="datetime-local"
							bind:value={editDateValue}
							class="w-full rounded-md border border-slate-300 bg-white p-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
						/>
						<button
							type="button"
							onclick={saveDate}
							class="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white"
						>
							OK
						</button>
					</div>
				{:else}
					<div class="flex items-center gap-1.5 truncate">
						<Calendar class="h-3.5 w-3.5 shrink-0 text-slate-400" />
						<span class="truncate font-medium text-slate-700 dark:text-slate-300">
							{formatDateTime(photo.timestamp, 'DD/MM/YYYY HH:mm:ss')}
						</span>
					</div>
					<button
						type="button"
						onclick={startEditDate}
						class="rounded-md p-1 text-slate-400 transition hover:text-red-600 dark:hover:text-red-400"
						title="Ubah Tanggal/Jam"
					>
						<Edit3 class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>

			<!-- Coordinates Row -->
			<div
				class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
			>
				<div class="flex items-center gap-1.5 truncate">
					<MapPin
						class="h-3.5 w-3.5 {activeLat !== null ? 'text-red-500' : 'text-slate-400'} shrink-0"
					/>
					{#if activeLat !== null && activeLng !== null}
						<span class="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">
							{formatCoordinates(activeLat, activeLng, 'decimal')}
						</span>
					{:else}
						<span class="font-medium text-amber-600 dark:text-amber-400">Belum ada koordinat</span>
					{/if}
				</div>

				<button
					type="button"
					onclick={() => onEditCoords(photo)}
					class="rounded-md px-2 py-0.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
				>
					Ubah
				</button>
			</div>

			<!-- Full Address Row without truncation -->
			{#if photo.locationAddress}
				<div
					class="rounded-xl border border-slate-100 bg-slate-50 p-2 text-[11px] leading-snug break-words text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
				>
					<span class="font-semibold text-slate-700 dark:text-slate-300">Alamat:</span>
					{photo.locationAddress}
				</div>
			{/if}
		</div>

		<!-- Card Actions -->
		<div
			class="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800"
		>
			<button
				type="button"
				onclick={() => onRemove(photo.id)}
				class="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
				title="Hapus foto ini"
			>
				<Trash2 class="h-4 w-4" />
			</button>

			<div class="flex items-center gap-1.5">
				<button
					type="button"
					onclick={() => onPreview(photo)}
					class="rounded-lg px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
				>
					Pratinjau
				</button>

				{#if photo.processedBlob}
					<button
						type="button"
						onclick={handleDownloadSingle}
						class="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white shadow-xs transition hover:bg-red-700"
						title="Download foto ini"
					>
						<Download class="h-3.5 w-3.5" />
						Download
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
