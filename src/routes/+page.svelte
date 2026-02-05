<script lang="ts">
    import BoidBackground from '$lib/components/BoidBackground.svelte';
    import Obsidian from '$lib/components/themes/Obsidian.svelte';
    import Brutalist from '$lib/components/themes/Brutalist.svelte';
    import Swiss from '$lib/components/themes/Swiss.svelte';
    import Paper from '$lib/components/themes/Paper.svelte';
    import Vapor from '$lib/components/themes/Vapor.svelte';
    import Blueprint from '$lib/components/themes/Blueprint.svelte';
    import Terminal from '$lib/components/themes/Terminal.svelte';
    import Biolum from '$lib/components/themes/Biolum.svelte';
    import Gallery from '$lib/components/themes/Gallery.svelte';
    import Cosmic from '$lib/components/themes/Cosmic.svelte';
    import type { PortfolioData } from '$lib/types';
    
    // --- Configuration ---
    const themes = {
        obsidian: { component: Obsidian, name: 'Obsidian', bg: '#0f172a', boids: '#1a212d', wireframe: false, count: 300 },
        paper: { component: Paper, name: 'Paper', bg: '#f3f0eb', boids: '#e6e2dd', wireframe: false, count: 200 },
        blueprint: { component: Blueprint, name: 'Blueprint', bg: '#172554', boids: '#60a5fa', wireframe: true, count: 400 }, // Blue-950 bg, blue-400 boids
        biolum: { component: Biolum, name: 'Biolum', bg: '#042f2e', boids: '#2dd4bf', wireframe: false, count: 500 }, // Teal-950 bg, Teal-400 boids
        terminal: { component: Terminal, name: 'Terminal', bg: '#000000', boids: '#78350f', wireframe: true, count: 150 }, // Amber-900 boids
        gallery: { component: Gallery, name: 'Gallery', bg: '#ffffff', boids: '#000000', wireframe: true, count: 50 }, // Very sparse, black wireframe
        cosmic: { component: Cosmic, name: 'Cosmic', bg: '#09090b', boids: '#6366f1', wireframe: false, count: 600 }, // Zinc-950 bg, Indigo-500 boids
        brutalist: { component: Brutalist, name: 'Brutalist', bg: '#000000', boids: '#003300', wireframe: true, count: 500 },
        swiss: { component: Swiss, name: 'Swiss', bg: '#ffffff', boids: '#e5e5e5', wireframe: false, count: 300 },
        vapor: { component: Vapor, name: 'Vapor', bg: '#1a0033', boids: '#330066', wireframe: true, count: 300 }
    };

    type ThemeKey = keyof typeof themes;
    let currentTheme = $state<ThemeKey>('obsidian');
    
    let fps = $state(0);
    const gitHash = 'f4783c9'; 

    // Derived theme properties
    let ActiveComponent = $derived(themes[currentTheme].component);
    let backgroundColor = $derived(themes[currentTheme].bg);
    let boidColor = $derived(themes[currentTheme].boids);
    let useSkybox = $derived(currentTheme === 'obsidian' || currentTheme === 'cosmic'); // Cosmic also uses skybox
    let isWireframe = $derived(themes[currentTheme].wireframe);
    let boidCount = $derived(themes[currentTheme].count);

    // Data
    const portfolioData: PortfolioData = {
        name: "Scott Powdrill (jellman86)",
        avatarUrl: "https://avatars.githubusercontent.com/u/179294116?v=4",
        bio: "Building intelligent systems and digital experiences. Focused on AI agents, visual computing, and modern web architecture.",
        links: [
            { label: "YA-WAMF", url: "https://github.com/Jellman86/YA-WAMF", icon: "🚀" },
            { label: "GitHub", url: "https://github.com/jellman86", icon: "💻" },
            { label: "LinkedIn", url: "https://www.linkedin.com/in/scott-powdrill-3b727b10b/", icon: "💼" } 
        ]
    };

    function switchTheme(theme: ThemeKey) {
        currentTheme = theme;
    }
</script>

<svelte:head>
    <!-- Fonts now handled in app.css imports -->
</svelte:head>

<div class="relative min-h-screen w-full overflow-hidden transition-colors duration-1000" style="background-color: {backgroundColor}">
    <!-- WebGL Background Layer -->
    <BoidBackground {boidCount} color={boidColor} {backgroundColor} {useSkybox} wireframe={isWireframe} bind:fps />

    <!-- UI Overlay -->
    <div class="relative z-10">
        <ActiveComponent data={portfolioData} />
    </div>

    <!-- Theme Switcher & Stats -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-auto">
        
        <!-- Theme Dock -->
        <div class="flex flex-wrap justify-end gap-2 p-2 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 shadow-lg max-w-[200px] md:max-w-none">
            {#each Object.entries(themes) as [key, theme]}
                <button 
                    class="w-8 h-8 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50 overflow-hidden relative"
                    style="background-color: {theme.bg};"
                    class:ring-2={currentTheme === key}
                    class:ring-white={currentTheme === key}
                    onclick={() => switchTheme(key as ThemeKey)}
                    title={theme.name}
                    aria-label={`Switch to ${theme.name} theme`}
                >
                    {#if key === 'blueprint'}<span class="text-[8px] text-blue-400 font-bold flex items-center justify-center w-full h-full">BP</span>{/if}
                    {#if key === 'biolum'}<span class="text-[8px] text-teal-400 font-bold flex items-center justify-center w-full h-full">BIO</span>{/if}
                    {#if key === 'terminal'}<span class="text-[8px] text-amber-500 font-bold flex items-center justify-center w-full h-full">TERM</span>{/if}
                    {#if key === 'gallery'}<span class="text-[8px] text-black font-bold flex items-center justify-center w-full h-full">GAL</span>{/if}
                    {#if key === 'cosmic'}<span class="text-[8px] text-indigo-400 font-bold flex items-center justify-center w-full h-full">COS</span>{/if}
                    {#if key === 'brutalist'}<span class="block w-full h-full text-[8px] text-[#00ff41] flex items-center justify-center font-bold">B</span>{/if}
                    {#if key === 'swiss'}<span class="block w-full h-full text-[8px] text-black flex items-center justify-center font-bold">S</span>{/if}
                </button>
            {/each}
        </div>

        <!-- Stats -->
        <div class="flex flex-col items-end gap-1 px-3 py-2 rounded-xl bg-black/10 backdrop-blur-sm border border-white/5 text-[10px] font-mono font-bold text-slate-500/50 hover:opacity-100 transition-opacity">
            <p><span class="text-sky-400/80">{fps}</span> FPS</p>
            <p>{gitHash}</p>
        </div>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        overflow-x: hidden; 
    }
</style>
