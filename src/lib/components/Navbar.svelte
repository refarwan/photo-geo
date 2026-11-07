<script lang="ts">
	import { Camera, MapPin, Archive, RefreshCw, SlidersHorizontal } from 'lucide-svelte';
	import type { Coordinates } from '#lib/types';
	import { formatCoordinates } from '#lib/utils/geo';

	interface Props {
		totalPhotos: number;
		globalCoords: Coordinates | null;
		onOpenGlobalMap: () => void;
		onDownloadZip: () => void;
		isZipping?: boolean;
		onToggleSettings?: () => void;
	}

	let {
		totalPhotos,
		globalCoords,
		onOpenGlobalMap,
		onDownloadZip,
		isZipping = false,
		onToggleSettings
	}: Props = $props();
</script>

<header
	class="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md transition dark:border-slate-800 dark:bg-slate-900/80"
>
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
		<!-- Brand Logo -->
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-md shadow-red-500/20"
			>
				<Camera class="h-5 w-5" />
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-base font-black tracking-tight text-slate-900 sm:text-lg dark:text-white">
						Photo<span class="text-red-600">Geo</span>
					</h1>
					<span
						class="hidden rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 sm:inline-flex dark:bg-red-950/60 dark:text-red-400"
					>
						GPS Stamping
					</span>
				</div>
				<p class="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
					Tempel Peta Google Maps & Waktu pada Foto
				</p>
			</div>
		</div>

		<!-- Action Bar in Header -->
		<div class="flex items-center gap-2 sm:gap-3">
			<!-- Global Coordinates Indicator / Picker Button -->
			<button
				type="button"
				onclick={onOpenGlobalMap}
				class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
			>
				<MapPin class="h-3.5 w-3.5 shrink-0 text-red-500" />
				{#if globalCoords}
					<span class="hidden font-mono text-[11px] md:inline">
						{formatCoordinates(globalCoords.lat, globalCoords.lng, 'decimal')}
					</span>
					<span class="md:hidden">Koordinat</span>
				{:else}
					<span>Atur Koordinat</span>
				{/if}
			</button>

			<!-- Toggle Settings Mobile button -->
			{#if onToggleSettings}
				<button
					type="button"
					onclick={onToggleSettings}
					class="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
					title="Pengaturan"
				>
					<SlidersHorizontal class="h-4 w-4" />
				</button>
			{/if}

			<!-- Download ZIP Button -->
			<button
				type="button"
				disabled={totalPhotos === 0 || isZipping}
				onclick={onDownloadZip}
				class="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:text-sm"
			>
				{#if isZipping}
					<RefreshCw class="h-4 w-4 animate-spin" />
					<span>Membuat ZIP...</span>
				{:else}
					<Archive class="h-4 w-4" />
					<span>Download ZIP</span>
					{#if totalPhotos > 0}
						<span class="py-0.2 ml-1 rounded-full bg-white/20 px-1.5 font-mono text-[10px]">
							{totalPhotos}
						</span>
					{/if}
				{/if}
			</button>
		</div>
	</div>
</header>
