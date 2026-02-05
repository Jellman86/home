<script lang="ts">
    import BoidBackground from '$lib/components/BoidBackground.svelte';
    import Blueprint from '$lib/components/themes/Blueprint.svelte';
    import type { PortfolioData } from '$lib/types';
    
    // --- Configuration ---
    const themes = {
        blueprint: { 
            component: Blueprint, 
            name: 'Blueprint Dark', 
            bg: '#172554', // blue-950
            boids: '#60a5fa', // blue-400
            predator: '#cfd8e3', // light grey
            wireframe: true, 
            count: 400,
            variant: 'dark'
        }, 
        blueprint_light: { 
            component: Blueprint, 
            name: 'Blueprint Light', 
            bg: '#eff6ff', // blue-50
            boids: '#1e3a8a', // blue-900
            predator: '#f87171', // red-400 (pastel red)
            wireframe: true, 
            count: 400,
            variant: 'light'
        }
    };

    type ThemeKey = keyof typeof themes;
    let currentTheme = $state<ThemeKey>('blueprint');
    let showTrails = $state(false);
    
    let fps = $state(0);
    const gitHash = 'f4783c9'; 

    // Derived theme properties
    let ActiveComponent = $derived(themes[currentTheme].component);
    let backgroundColor = $derived(themes[currentTheme].bg);
    let boidColor = $derived(themes[currentTheme].boids);
    let predatorColor = $derived(themes[currentTheme].predator);
    let useSkybox = $derived(false); 
    let isWireframe = $derived(themes[currentTheme].wireframe);
    let boidCount = $derived(themes[currentTheme].count);
    let variant = $derived(themes[currentTheme].variant);
    
    // Data
    const portfolioData: PortfolioData = {
        name: "Scott Powdrill (jellman86)",
        avatarUrl: "https://avatars.githubusercontent.com/u/179294116?v=4",
        bio: "I love science, nature, and technology. Fascinated by the boundary where digital systems meet the natural world.",
        links: [
            { label: "YA-WAMF", url: "https://github.com/Jellman86/YA-WAMF", icon: "🚀" },
            { label: "GitHub", url: "https://github.com/jellman86", icon: "💻" },
            { label: "LinkedIn", url: "https://www.linkedin.com/in/scott-powdrill-3b727b10b/", icon: "💼" } 
        ]
    };

    // Stats colors based on variant
    let statsColors = $derived(variant === 'dark' ? 
        'bg-slate-950/40 border-blue-500/20 text-blue-300/40' : 
        'bg-white/40 border-blue-600/20 text-blue-800/40'
    );

    function toggleTheme() {
        currentTheme = currentTheme === 'blueprint' ? 'blueprint_light' : 'blueprint';
    }
</script>

<svelte:head>
    <!-- Fonts now handled in app.css imports -->
</svelte:head>

<div class="relative min-h-screen w-full overflow-hidden transition-colors duration-1000" style="background-color: {backgroundColor}">
    <!-- WebGL Background Layer -->
    <BoidBackground {boidCount} color={boidColor} {backgroundColor} {useSkybox} wireframe={isWireframe} {predatorColor} {showTrails} bind:fps />

    <!-- UI Overlay -->
    <div class="relative z-10">
        <ActiveComponent data={portfolioData} {variant} bind:showTrails={showTrails} />
    </div>

    <!-- Theme Switcher & Stats -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-auto">
        
        <!-- Controls Row -->
        <div class="flex gap-2">
            <!-- Trails Toggle -->
            <button 
                class="flex items-center justify-center w-10 h-10 rounded-full bg-black/10 backdrop-blur-md border border-white/10 shadow-lg {variant === 'dark' ? 'text-white hover:bg-white/10' : 'text-blue-900 hover:bg-black/5'} transition-all active:scale-95"
                onclick={() => showTrails = !showTrails}
                title={showTrails ? 'Hide Trails' : 'Show Trails'}
                aria-label="Toggle Trails"
            >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </button>

            <!-- Light/Dark Toggle -->
            <button 
                class="flex items-center justify-center w-10 h-10 rounded-full bg-black/10 backdrop-blur-md border border-white/10 shadow-lg {variant === 'dark' ? 'text-white hover:bg-white/10' : 'text-blue-900 hover:bg-black/5'} transition-all active:scale-95"
                onclick={toggleTheme}
                title={currentTheme === 'blueprint' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle Theme"
            >
                {#if currentTheme === 'blueprint'}
                    <!-- Sun Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                {:else}
                    <!-- Moon Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                {/if}
            </button>
        </div>

        <!-- Stats -->
        <div class="flex flex-col items-end gap-1 px-3 py-2 border {statsColors} backdrop-blur-md text-[9px] font-mono font-bold hover:opacity-100 transition-opacity group">
            <p class="tracking-widest">
                <span class="{variant === 'dark' ? 'text-blue-400' : 'text-blue-600'}">{fps}</span>_FPS
            </p>
            <p class="opacity-50 uppercase tracking-tighter">BUILD_{gitHash}</p>
        </div>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        overflow-x: hidden; 
    }
</style>
