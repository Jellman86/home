<script lang="ts">
    import BoidBackground from '$lib/components/BoidBackground.svelte';
    import Blueprint from '$lib/components/themes/Blueprint.svelte';
    import Terminal from '$lib/components/themes/Terminal.svelte';
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
        },
        terminal: {
            component: Terminal,
            name: 'Terminal',
            bg: '#300a24', // Ubuntu Aubergine
            boids: '#E95420', // Ubuntu Orange
            predator: '#ffffff', // White
            wireframe: false,
            count: 300,
            variant: 'dark'
        }
    };

    type ThemeKey = keyof typeof themes;
    // Removed themeOrder constant as we are using direct switching logic now
    
    let currentTheme = $state<ThemeKey>('blueprint');
    let lastBlueprintTheme = $state<ThemeKey>('blueprint'); // Remembers if we were in light or dark mode
    let lastInteractionTime = $state(0);
    let typingPoint = $state<{x: number, y: number} | null>(null);
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
    let isTerminal = $derived(currentTheme === 'terminal');
    
    // Data
    const portfolioData: PortfolioData = {
        name: "Scott Powdrill (jellman86)",
        avatarUrl: "https://avatars.githubusercontent.com/u/179294116?v=4",
        bio: "I love science, nature, and technology. Fascinated by the boundary where digital systems meet the natural world.",
        links: [
            { 
                label: "YA-WAMF", 
                url: "https://github.com/Jellman86/YetAnother-WhosAtMyFeeder", 
                icon: "🚀",
                demoUrl: "https://yetanotherwhosatmyfeeder.pownet.uk"
            },
            { label: "GitHub", url: "https://github.com/jellman86", icon: "💻" },
            { label: "LinkedIn", url: "https://www.linkedin.com/in/scott-powdrill-3b727b10b/", icon: "💼" } 
        ]
    };

    // Stats colors based on variant
    let statsColors = $derived(currentTheme === 'terminal' ?
        'bg-black/80 border-green-500/50 text-green-500' :
        variant === 'dark' ? 
        'bg-slate-950/60 border-blue-500/30 text-blue-400' : 
        'bg-white/60 border-blue-600/30 text-blue-700'
    );

    function handleInteraction(point?: {x: number, y: number}) {
        lastInteractionTime = performance.now();
        if (point) typingPoint = point;
    }

    // Toggles between Light/Dark for Blueprint only
    function toggleLightDark() {
        if (currentTheme === 'blueprint') {
            currentTheme = 'blueprint_light';
            lastBlueprintTheme = 'blueprint_light';
        } else if (currentTheme === 'blueprint_light') {
            currentTheme = 'blueprint';
            lastBlueprintTheme = 'blueprint';
        }
    }

    // Switches between OS styles (Blueprint <-> Terminal)
    function switchOS() {
        if (currentTheme === 'terminal') {
            currentTheme = lastBlueprintTheme;
        } else {
            // Save current state if we are currently in a blueprint mode (though state tracks it anyway)
            if (currentTheme === 'blueprint' || currentTheme === 'blueprint_light') {
                lastBlueprintTheme = currentTheme;
            }
            currentTheme = 'terminal';
        }
    }
</script>

<svelte:head>
    <!-- Fonts now handled in app.css imports -->
</svelte:head>

<div class="relative min-h-screen w-full overflow-hidden transition-colors duration-1000" style="background-color: {backgroundColor}">
    <!-- WebGL Background Layer -->
    {#key boidCount}
        <BoidBackground 
            {boidCount} 
            color={boidColor} 
            {backgroundColor} 
            {useSkybox} 
            wireframe={isWireframe} 
            {predatorColor} 
            {showTrails} 
            bind:fps 
            {isTerminal}
            {lastInteractionTime}
            {typingPoint}
        />
    {/key}

    <!-- UI Overlay -->
    <main class="relative z-10">
        <ActiveComponent data={portfolioData} {variant} bind:showTrails={showTrails} toggleTheme={toggleLightDark} onInteraction={handleInteraction} />
    </main>

    <!-- Theme Switcher & Stats -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-auto">
        
        <!-- OS Switcher (Blueprint <-> Terminal) -->
        <button 
            class="flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md border shadow-lg transition-all active:scale-95 
            {currentTheme === 'terminal' ? 'bg-green-900/20 border-green-500 text-green-500 hover:bg-green-900/40' : 
                variant === 'dark' ? 'bg-black/10 border-white/10 text-white hover:bg-white/10' : 
                'bg-black/10 border-white/10 text-blue-900 hover:bg-black/5'}"
            onclick={switchOS}
            title={currentTheme === 'terminal' ? 'Switch to Blueprint OS' : 'Switch to Terminal OS'}
            aria-label="Switch OS"
        >
            {#if currentTheme === 'terminal'}
                <!-- Blueprint Icon (Go back to UI) -->
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            {:else}
                <!-- Terminal Icon (Go to Terminal) -->
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            {/if}
        </button>

        <div class="flex items-stretch gap-2">
            <!-- Trails Toggle -->
            <button 
                class="flex items-center justify-center px-3 border {statsColors} backdrop-blur-md transition-all active:scale-95 hover:bg-black/5"
                onclick={() => showTrails = !showTrails}
                title={showTrails ? 'Hide Trails' : 'Show Trails'}
                aria-label="Toggle Trails"
            >
                <svg class="w-4 h-4 pointer-events-none {showTrails ? 'opacity-100' : 'opacity-30'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </button>

            <!-- Stats -->
            <div class="flex flex-col items-end gap-1 px-3 py-2 border {statsColors} backdrop-blur-md text-[9px] font-mono font-bold hover:opacity-100 transition-opacity group">
                <p class="tracking-widest">
                    <span class="{currentTheme === 'terminal' ? 'text-green-400' : variant === 'dark' ? 'text-blue-400' : 'text-blue-600'}">{fps}</span>_FPS
                </p>
                <p class="opacity-50 uppercase tracking-tighter">BUILD_{gitHash}</p>
            </div>
        </div>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        overflow-x: hidden; 
    }
</style>
