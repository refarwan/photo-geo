<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>PhotoGeo - Tempel Peta Google Maps, Tanggal & Jam pada Foto</title>
	<meta
		name="description"
		content="Aplikasi geotagging foto batch: tempel gambar peta Google Maps, koordinat GPS, alamat, serta tanggal dan jam pada foto secara otomatis, lalu download ZIP."
	/>
	<meta
		name="keywords"
		content="photogeo, geotag foto, stamp google maps, watermark gps, timestamp camera, koordinat peta"
	/>
	<meta name="theme-color" content="#ea4335" />
	<meta property="og:title" content="PhotoGeo - Tempel Peta Google Maps & Waktu pada Foto" />
	<meta
		property="og:description"
		content="Tempel peta Google Maps, koordinat GPS, dan timestamp tanggal jam pada foto lalu download ZIP."
	/>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
