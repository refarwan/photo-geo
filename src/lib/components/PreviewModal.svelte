<script lang="ts">
	import { X, Download, ZoomIn, ZoomOut, RotateCcw, Eye } from 'lucide-svelte';
	import type { PhotoItem } from '#lib/types';
	import { downloadBlob } from '#lib/utils/zip';

	interface Props {
		photo: PhotoItem;
		onClose: () => void;
	}

	let { photo, onClose }: Props = $props();

	let showOriginal = $state(false);
	let zoom = $state(1);

	function zoomIn() {
		zoom = Math.min(zoom + 0.25, 3);
	}

	function zoomOut() {
		zoom = Math.max(zoom - 0.25, 0.5);
	}

	function resetZoom() {
		zoom = 1;
	}

	function handleDownloadSingle() {
		if (photo.processedBlob) {
			downloadBlob(photo.processedBlob, `geo_${photo.name}`);
		}
	}
</script>

<!-- Preview Modal Backdrop -->
<div
	class="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md duration-200 sm:p-6"
>
	<div
		class="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl"
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-3.5"
		>
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-red-600/20 p-2 text-red-400">
					<Eye class="h-5 w-5" />
				</div>
				<div>
					<h3 class="max-w-sm truncate text-base font-semibold text-slate-100 sm:max-w-md">
						{photo.name}
					</h3>
					<p class="text-xs text-slate-400">
						{photo.width} × {photo.height} px
						{#if photo.lat && photo.lng}
							• {photo.lat.toFixed(4)}°, {photo.lng.toFixed(4)}°
						{/if}
					</p>
				</div>
			</div>

			<!-- Right tools -->
			<div class="flex items-center gap-2">
				<!-- Toggle Original / Watermark -->
				<button
					type="button"
					onclick={() => (showOriginal = !showOriginal)}
					class="rounded-lg px-3 py-1.5 text-xs font-medium transition {showOriginal
						? 'bg-amber-600 text-white'
						: 'bg-slate-800 text-slate-300 hover:bg-slate-700'}"
				>
					{showOriginal ? 'Melihat Original' : 'Lihat Foto Asli'}
				</button>

				<!-- Zoom Controls -->
				<div
					class="hidden items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1 sm:flex"
				>
					<button
						type="button"
						onclick={zoomOut}
						class="rounded p-1 text-slate-400 transition hover:text-white"
						title="Perkecil"
					>
						<ZoomOut class="h-4 w-4" />
					</button>
					<span class="px-1.5 font-mono text-xs text-slate-300">{Math.round(zoom * 100)}%</span>
					<button
						type="button"
						onclick={zoomIn}
						class="rounded p-1 text-slate-400 transition hover:text-white"
						title="Perbesar"
					>
						<ZoomIn class="h-4 w-4" />
					</button>
					<button
						type="button"
						onclick={resetZoom}
						class="rounded p-1 text-slate-400 transition hover:text-white"
						title="Reset zoom"
					>
						<RotateCcw class="h-3.5 w-3.5" />
					</button>
				</div>

				<!-- Download Single -->
				{#if photo.processedBlob}
					<button
						type="button"
						onclick={handleDownloadSingle}
						class="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700"
					>
						<Download class="h-3.5 w-3.5" />
						Download
					</button>
				{/if}

				<button
					type="button"
					onclick={onClose}
					class="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
				>
					<X class="h-5 w-5" />
				</button>
			</div>
		</div>

		<!-- Main Image Preview Canvas Area -->
		<div
			class="relative flex flex-1 items-center justify-center overflow-auto bg-slate-950/60 p-4 select-none"
		>
			<div
				class="flex max-h-full max-w-full origin-center items-center justify-center transition-transform duration-150 ease-out"
				style="transform: scale({zoom});"
			>
				{#if showOriginal}
					<img
						src={photo.objectUrl}
						alt="Original preview"
						class="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
					/>
				{:else if photo.processedDataUrl}
					<img
						src={photo.processedDataUrl}
						alt="Watermarked preview"
						class="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
					/>
				{:else}
					<div class="flex flex-col items-center gap-2 text-sm text-slate-400">
						<p>Sedang memproses foto atau belum diproses...</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
