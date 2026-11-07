<script lang="ts">
	import { UploadCloud, Sparkles } from 'lucide-svelte';

	interface Props {
		onFilesSelected: (files: FileList | File[]) => void;
	}

	let { onFilesSelected }: Props = $props();

	let isDragging = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			onFilesSelected(e.dataTransfer.files);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleFileInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			onFilesSelected(target.files);
			target.value = ''; // Reset for re-selection
		}
	}
</script>

<div
	role="region"
	aria-label="Upload Foto"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class="relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 sm:p-12 {isDragging
		? 'scale-[1.01] border-red-500 bg-red-50/50 dark:bg-red-950/20'
		: 'border-slate-300 bg-white hover:border-red-400 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-red-500'}"
>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple
		onchange={handleFileInputChange}
		class="hidden"
	/>

	<button
		type="button"
		onclick={() => fileInput?.click()}
		class="flex w-full cursor-pointer flex-col items-center justify-center gap-3 border-0 bg-transparent p-0"
	>
		<div
			class="rounded-2xl bg-red-50 p-4 text-red-600 shadow-sm dark:bg-red-950/60 dark:text-red-400"
		>
			<UploadCloud class="h-10 w-10" />
		</div>

		<div>
			<h3 class="text-base font-bold text-slate-800 sm:text-lg dark:text-slate-100">
				Tarik & Lepas Foto di Sini, atau <span
					class="text-red-600 underline underline-offset-2 dark:text-red-400">Pilih File</span
				>
			</h3>
			<p class="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
				Mendukung banyak foto sekaligus (JPG, PNG, WEBP).
			</p>
		</div>

		<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>
				<Sparkles class="h-3.5 w-3.5 text-amber-500" />
				Otomatis deteksi GPS & Waktu dari EXIF
			</span>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>
				⚡ Tempel Google Maps & Timestamp
			</span>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>
				📦 Download ZIP 1-Klik
			</span>
		</div>
	</button>
</div>
