<script lang="ts">
    import BoidBackground from '$lib/components/BoidBackground.svelte';
    import Obsidian from '$lib/components/themes/Obsidian.svelte';
    import Brutalist from '$lib/components/themes/Brutalist.svelte';
    import Swiss from '$lib/components/themes/Swiss.svelte';
    import Paper from '$lib/components/themes/Paper.svelte';
    import Vapor from '$lib/components/themes/Vapor.svelte';
    import type { PortfolioData } from '$lib/types';
    
    // --- Configuration ---
    const themes = {
        obsidian: { component: Obsidian, name: 'Obsidian', bg: '#0f172a', boids: '#1a212d' },
        brutalist: { component: Brutalist, name: 'Brutalist', bg: '#000000', boids: '#003300' }, // Dark green boids for Matrix vibe
        swiss: { component: Swiss, name: 'Swiss', bg: '#ffffff', boids: '#e5e5e5' }, // Very subtle grey boids
        paper: { component: Paper, name: 'Paper', bg: '#f3f0eb', boids: '#e6e2dd' }, // Cream boids
        vapor: { component: Vapor, name: 'Vapor', bg: '#1a0033', boids: '#330066' } // Deep purple boids
    };

    type ThemeKey = keyof typeof themes;
    let currentTheme = $state<ThemeKey>('obsidian');
    
    let fps = $state(0);
    const gitHash = 'f4783c9'; // This would ideally come from build env

    // Derived theme properties
    let ActiveComponent = $derived(themes[currentTheme].component);
    let backgroundColor = $derived(themes[currentTheme].bg);
    let boidColor = $derived(themes[currentTheme].boids);
    let useSkybox = $derived(currentTheme === 'obsidian'); // Only Obsidian uses the 3D Skybox

    // Data
    const portfolioData: PortfolioData = {
        name: "Justin Ellman",
        avatarUrl: "https://avatars.githubusercontent.com/u/179294116?v=4",
        bio: "Building intelligent systems and digital experiences. Focused on AI agents, visual computing, and modern web architecture.",
        links: [
            { label: "YA-WAMF", url: "https://yawamf.pownet.uk", icon: "🚀" },
            { label: "GitHub", url: "https://github.com/jellman86", icon: "💻" },
            { label: "LinkedIn", url: "#", icon: "💼" } // Placeholder
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
    <!-- Opacity adjustments based on theme could happen here, but color shift handles most of it -->
    <BoidBackground boidCount={currentTheme === 'brutalist' ? 500 : 300} color={boidColor} {backgroundColor} {useSkybox} bind:fps />

    <!-- UI Overlay -->
    <div class="relative z-10">
        <ActiveComponent data={portfolioData} />
    </div>

    <!-- Theme Switcher & Stats -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-auto">
        
        <!-- Theme Dock -->
        <div class="flex gap-2 p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 shadow-lg">
            {#each Object.entries(themes) as [key, theme]}
                <button 
                    class="w-8 h-8 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
                    style="background-color: {theme.bg};"
                    class:ring-2={currentTheme === key}
                    class:ring-white={currentTheme === key}
                    onclick={() => switchTheme(key as ThemeKey)}
                    title={theme.name}
                    aria-label={`Switch to ${theme.name} theme`}
                >
                    <!-- Mini visual indicator if colors are similar -->
                    {#if key === 'brutalist'}
                        <span class="block w-full h-full text-[8px] text-[#00ff41] flex items-center justify-center font-bold">B</span>
                    {/if}
                    {#if key === 'swiss'}
                        <span class="block w-full h-full text-[8px] text-black flex items-center justify-center font-bold">S</span>
                    {/if}
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
        overflow-x: hidden; /* Prevent horizontal scroll from fly animations */
    }
</style>
