<script lang="ts">
	import type { OverlaySettings, OverlayPosition, DateTimeFormatOption } from '#lib/types';
	import { Settings2, Map, Clock, RefreshCw } from 'lucide-svelte';

	interface Props {
		settings: OverlaySettings;
		onSettingsChange: (newSettings: OverlaySettings) => void;
		onApplyAll: () => void;
		onApplyGlobalTimestamp?: (timestamp: string) => void;
		isProcessingAll?: boolean;
	}

	let {
		settings,
		onSettingsChange,
		onApplyAll,
		onApplyGlobalTimestamp,
		isProcessingAll = false
	}: Props = $props();

	let globalDateInput = $state('');

	function applyGlobalDate() {
		if (globalDateInput && onApplyGlobalTimestamp) {
			const d = new Date(globalDateInput);
			if (!isNaN(d.getTime())) {
				onApplyGlobalTimestamp(d.toISOString());
			}
		}
	}

	function update<K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) {
		const updated = { ...settings, [key]: value };
		onSettingsChange(updated);
	}
</script>

<div
	class="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
>
	<!-- Panel Title -->
	<div
		class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800"
	>
		<div class="flex items-center gap-2">
			<div class="rounded-lg bg-red-100 p-1.5 text-red-600 dark:bg-red-950/60 dark:text-red-400">
				<Settings2 class="h-4 w-4" />
			</div>
			<h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">
				Pengaturan Tampilan Watermark
			</h3>
		</div>

		<button
			type="button"
			disabled={isProcessingAll}
			onclick={onApplyAll}
			class="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50"
		>
			<RefreshCw class="h-3.5 w-3.5 {isProcessingAll ? 'animate-spin' : ''}" />
			Terapkan Ulang
		</button>
	</div>

	<!-- Section 1: Peta Google Maps -->
	<div class="space-y-3">
		<label
			class="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
		>
			<span class="flex items-center gap-1.5">
				<Map class="h-3.5 w-3.5 text-red-500" />
				Tipe Peta Google
			</span>
			<input
				type="checkbox"
				checked={settings.showMap}
				onchange={(e) => update('showMap', e.currentTarget.checked)}
				class="h-4 w-4 rounded text-red-600 focus:ring-red-500"
			/>
		</label>

		{#if settings.showMap}
			<div class="grid grid-cols-3 gap-1.5">
				<button
					type="button"
					onclick={() => update('mapProvider', 'google_roadmap')}
					class="rounded-xl border px-2.5 py-2 text-center text-xs font-medium transition {settings.mapProvider ===
					'google_roadmap'
						? 'border-red-500 bg-red-50 font-semibold text-red-600 shadow-xs dark:bg-red-950/50 dark:text-red-400'
						: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
				>
					Jalan (Roadmap)
				</button>
				<button
					type="button"
					onclick={() => update('mapProvider', 'google_satellite')}
					class="rounded-xl border px-2.5 py-2 text-center text-xs font-medium transition {settings.mapProvider ===
					'google_satellite'
						? 'border-red-500 bg-red-50 font-semibold text-red-600 shadow-xs dark:bg-red-950/50 dark:text-red-400'
						: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
				>
					Satelit Asli
				</button>
				<button
					type="button"
					onclick={() => update('mapProvider', 'google_hybrid')}
					class="rounded-xl border px-2.5 py-2 text-center text-xs font-medium transition {settings.mapProvider ===
					'google_hybrid'
						? 'border-red-500 bg-red-50 font-semibold text-red-600 shadow-xs dark:bg-red-950/50 dark:text-red-400'
						: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
				>
					Hybrid
				</button>
			</div>

			<!-- Zoom & Map Size Sliders -->
			<div class="grid grid-cols-2 gap-3 pt-1">
				<div>
					<div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
						<span>Zoom Peta:</span>
						<span class="font-mono font-bold text-slate-700 dark:text-slate-300"
							>{settings.zoom}</span
						>
					</div>
					<input
						type="range"
						min="12"
						max="19"
						step="1"
						value={settings.zoom}
						oninput={(e) => update('zoom', parseInt(e.currentTarget.value))}
						class="w-full accent-red-600"
					/>
				</div>

				<div>
					<div class="mb-1 flex items-center justify-between text-[11px] text-slate-500">
						<span>Ukuran Peta:</span>
						<span class="font-mono font-bold text-slate-700 dark:text-slate-300"
							>{settings.mapSizePercent}%</span
						>
					</div>
					<input
						type="range"
						min="18"
						max="38"
						step="1"
						value={settings.mapSizePercent}
						oninput={(e) => update('mapSizePercent', parseInt(e.currentTarget.value))}
						class="w-full accent-red-600"
					/>
				</div>
			</div>
		{/if}
	</div>

	<!-- Section 2: Tata Letak & Posisi -->
	<div class="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
		<span class="block text-xs font-semibold text-slate-700 dark:text-slate-300">
			Gaya Tata Letak
		</span>
		<div class="grid grid-cols-3 gap-1.5 text-xs">
			<button
				type="button"
				onclick={() => update('layoutStyle', 'gps_badge')}
				class="rounded-xl border px-2.5 py-2 text-center transition {settings.layoutStyle ===
				'gps_badge'
					? 'border-red-500 bg-red-50 font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400'
					: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
			>
				Badge GPS
			</button>
			<button
				type="button"
				onclick={() => update('layoutStyle', 'split')}
				class="rounded-xl border px-2.5 py-2 text-center transition {settings.layoutStyle ===
				'split'
					? 'border-red-500 bg-red-50 font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400'
					: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
			>
				Terpisah
			</button>
			<button
				type="button"
				onclick={() => update('layoutStyle', 'bottom_banner')}
				class="rounded-xl border px-2.5 py-2 text-center transition {settings.layoutStyle ===
				'bottom_banner'
					? 'border-red-500 bg-red-50 font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400'
					: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
			>
				Banner Bawah
			</button>
		</div>

		{#if settings.layoutStyle !== 'bottom_banner'}
			<div class="space-y-1.5 pt-1">
				<span class="text-[11px] font-medium text-slate-500">Posisi Sudut:</span>
				<div class="grid grid-cols-2 gap-1.5 text-xs">
					{#each [{ id: 'bottom-left', label: 'Bawah Kiri' }, { id: 'bottom-right', label: 'Bawah Kanan' }, { id: 'top-left', label: 'Atas Kiri' }, { id: 'top-right', label: 'Atas Kanan' }] as pos (pos.id)}
						<button
							type="button"
							onclick={() => update('position', pos.id as OverlayPosition)}
							class="rounded-lg border px-2 py-1.5 text-xs transition {settings.position === pos.id
								? 'bg-slate-800 font-medium text-white dark:bg-slate-100 dark:text-slate-900'
								: 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'}"
						>
							{pos.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Section 3: Tanggal & Waktu -->
	<div class="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
		<label
			class="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
		>
			<span class="flex items-center gap-1.5">
				<Clock class="h-3.5 w-3.5 text-blue-500" />
				Tanggal & Jam
			</span>
			<input
				type="checkbox"
				checked={settings.showDateTime}
				onchange={(e) => update('showDateTime', e.currentTarget.checked)}
				class="h-4 w-4 rounded text-red-600 focus:ring-red-500"
			/>
		</label>

		{#if settings.showDateTime}
			<div class="space-y-2">
				<div>
					<span class="mb-1 block text-[11px] font-medium text-slate-500">Format Teks:</span>
					<select
						value={settings.dateTimeFormat}
						onchange={(e) =>
							update('dateTimeFormat', e.currentTarget.value as DateTimeFormatOption)}
						class="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
					>
						<option value="DD/MM/YYYY HH:mm:ss">DD/MM/YYYY HH:mm:ss (07/11/2026 17:45:00)</option>
						<option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss (2026-11-07 17:45:00)</option>
						<option value="DD MMMM YYYY, HH:mm"
							>DD MMMM YYYY, HH:mm (07 November 2026, 17:45)</option
						>
						<option value="DD MMM YYYY, HH:mm:ss WIB"
							>DD MMM YYYY WIB (07 Nov 2026 17:45 WIB)</option
						>
						<option value="ISO">ISO Standard</option>
					</select>
				</div>

				{#if onApplyGlobalTimestamp}
					<div class="border-t border-slate-100 pt-1.5 dark:border-slate-800/80">
						<span class="mb-1 block text-[11px] font-medium text-slate-500"
							>Set Tanggal/Jam Semua Foto:</span
						>
						<div class="flex items-center gap-1.5">
							<input
								type="datetime-local"
								bind:value={globalDateInput}
								class="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
							/>
							<button
								type="button"
								onclick={applyGlobalDate}
								disabled={!globalDateInput}
								class="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap text-white transition hover:bg-slate-900 disabled:opacity-40 dark:bg-slate-700"
							>
								Terapkan
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Section 4: Elemen Lain & Catatan -->
	<div class="space-y-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
		<span class="block font-semibold text-slate-700 dark:text-slate-300">
			Elemen Teks Tambahan
		</span>

		<div class="space-y-2">
			<label class="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
				<input
					type="checkbox"
					checked={settings.showCoordinates}
					onchange={(e) => update('showCoordinates', e.currentTarget.checked)}
					class="h-4 w-4 rounded text-red-600 focus:ring-red-500"
				/>
				<span>Tampilkan Angka Koordinat (Lat, Lng)</span>
			</label>

			<label class="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
				<input
					type="checkbox"
					checked={settings.showAddress}
					onchange={(e) => update('showAddress', e.currentTarget.checked)}
					class="h-4 w-4 rounded text-red-600 focus:ring-red-500"
				/>
				<span>Tampilkan Nama Alamat / Tempat</span>
			</label>
		</div>

		<!-- Custom Project / Note -->
		<div class="pt-1">
			<span class="mb-1 block text-[11px] font-medium text-slate-500">
				Catatan Tambahan / Proyek (opsional):
			</span>
			<input
				type="text"
				placeholder="contoh: Proyek Survei Lapangan A"
				value={settings.customProjectNote}
				oninput={(e) => update('customProjectNote', e.currentTarget.value)}
				class="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
			/>
		</div>
	</div>
</div>
