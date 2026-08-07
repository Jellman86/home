<script lang="ts">
    import { fade, scale, slide } from 'svelte/transition';
    import { spring } from 'svelte/motion';
    import type { PortfolioData } from '$lib/types';

    let { 
        data, 
        variant = 'dark', 
        showTrails = $bindable(false),
        toggleTheme,
        onInteraction,
        onLinkActivate
    }: { 
        data: PortfolioData, 
        variant?: 'light' | 'dark', 
        showTrails?: boolean,
        toggleTheme?: () => void,
        onInteraction?: () => void,
        onLinkActivate?: (label: string | null) => void
    } = $props();

    let position = $state({ x: 0, y: 0 });
    let isDragging = $state(false);
    let isMinimized = $state(false);
    let dragOffset = { x: 0, y: 0 };
    
    // Spring for smooth parallax/tracking
    let mouseCoords = spring({ x: 0, y: 0 }, { stiffness: 0.1, damping: 0.4 });

    function handleMouseDown(e: MouseEvent) {
        if (e.target instanceof Element && e.target.closest('button')) return; // Don't drag if clicking buttons
        
        isDragging = true;
        dragOffset = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    }

    function handleMouseMove(e: MouseEvent) {
        mouseCoords.set({ x: e.clientX, y: e.clientY });
        
        if (!isDragging) return;
        position.x = e.clientX - dragOffset.x;
        position.y = e.clientY - dragOffset.y;
    }

    function handleMouseUp() {
        isDragging = false;
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
    }

    // Colors based on variant
    let colors = $derived(variant === 'dark' ? {
        text: 'text-blue-100',
        textMuted: 'text-blue-300',
        border: 'border-blue-500/30',
        bg: 'bg-slate-950/80',
        bgSolid: 'bg-slate-950',
        grid: 'rgba(30, 58, 138, 0.1)',
        accent: 'text-blue-400',
        highlight: 'bg-blue-500',
        shadow: 'rgba(59,130,246,0.2)'
    } : {
        text: 'text-blue-900',
        textMuted: 'text-blue-700',
        border: 'border-blue-600/40',
        bg: 'bg-white/80',
        bgSolid: 'bg-white',
        grid: 'rgba(30, 58, 138, 0.05)',
        accent: 'text-blue-600',
        highlight: 'bg-blue-600',
        shadow: 'rgba(30,58,138,0.1)'
    });
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="flex items-center justify-center min-h-screen p-4 font-mono {colors.text} overflow-hidden" in:fade={{ duration: 300 }}>
    <!-- Dynamic Grid Background (Parallax) -->
    <div class="fixed inset-0 pointer-events-none" 
        style="
            background-image: 
                linear-gradient({colors.grid} 1px, transparent 1px), 
                linear-gradient(90deg, {colors.grid} 1px, transparent 1px); 
            background-size: 40px 40px; 
            transform: translate({-$mouseCoords.x * 0.02}px, {-$mouseCoords.y * 0.02}px);
        ">
    </div>
    
    <!-- Measurement Crosshairs (Fixed to screen) -->
    <div class="fixed top-0 bottom-0 w-px bg-current opacity-10 pointer-events-none z-0" style="left: {$mouseCoords.x}px"></div>
    <div class="fixed left-0 right-0 h-px bg-current opacity-10 pointer-events-none z-0" style="top: {$mouseCoords.y}px"></div>

    <!-- Draggable Container -->
    <div 
        id="boid-target"
        class="relative w-full max-w-5xl border {colors.border} {colors.bg} backdrop-blur-md rounded-lg overflow-hidden pointer-events-auto transition-all duration-300"
        style="
            transform: translate({position.x}px, {position.y}px);
            transition: transform {isDragging ? '0s' : '0.1s'}, height 0.3s;
            box-shadow: 0 25px 50px -12px {variant === 'dark' ? 'rgba(0, 0, 0, 0.75)' : 'rgba(30, 58, 138, 0.25)'};
        "
        in:scale={{ duration: 400, start: 0.95, opacity: 0 }}
    >
        <!-- Single registration mark, inset and dimmed, reading as annotation on the
             drawing rather than a second frame. The header already carries the
             identity at the top, so a mark there only collides with its tick marks. -->
        <svg class="absolute bottom-2.5 right-2.5 w-5 h-5 {colors.accent} opacity-40 pointer-events-none rotate-180 z-10" viewBox="0 0 32 32">
            <path d="M0,0 L12,0 M0,0 L0,12" fill="none" stroke="currentColor" stroke-width="2"/>
            <rect x="4" y="4" width="2" height="2" fill="currentColor" class="animate-pulse"/>
        </svg>

        <!-- Technical Header (Drag Handle) -->
        <div 
            class="group flex justify-between items-center border-b {colors.border} px-4 py-2 {variant === 'dark' ? 'bg-gradient-to-r from-blue-900/20 to-transparent' : 'bg-gradient-to-r from-blue-100/50 to-transparent'} cursor-grab active:cursor-grabbing select-none"
            onmousedown={handleMouseDown}
            role="button"
            tabindex="0"
        >
            <div class="flex items-center gap-3">
                <div class="flex gap-0.5 opacity-70">
                    <div class="w-1 h-4 {colors.highlight}"></div>
                    <div class="w-1 h-4 {colors.highlight} opacity-60"></div>
                    <div class="w-1 h-4 {colors.highlight} opacity-30"></div>
                </div>
                <div class="flex gap-2 text-[10px] tracking-[0.2em] {colors.textMuted} font-bold uppercase">
                    <span class="{colors.accent}">POWNET</span>
                    <span class="opacity-30">//</span>
                    <span>About Me</span>
                </div>
            </div>
            
            <div class="flex items-center gap-4">
                <div class="text-[9px] {colors.textMuted} tracking-widest hidden sm:block opacity-60">
                    COORDS: [{$mouseCoords.x.toFixed(0)}, {$mouseCoords.y.toFixed(0)}]
                </div>
                
                <!-- Theme Toggle (Blueprint Only) -->
                {#if toggleTheme}
                <button 
                    onclick={toggleTheme}
                    class="w-6 h-6 flex items-center justify-center border {colors.border} rounded hover:{colors.highlight} hover:text-white transition-colors focus:outline-none"
                    title={variant === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {#if variant === 'dark'}
                        <!-- Sun Icon -->
                        <svg class="w-3 h-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    {:else}
                        <!-- Moon Icon -->
                        <svg class="w-3 h-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    {/if}
                </button>
                {/if}

                <!-- Minimize Button -->
                <button 
                    onclick={toggleMinimize}
                    class="w-6 h-6 flex items-center justify-center border {colors.border} rounded hover:{colors.highlight} hover:text-white transition-colors focus:outline-none"
                    title={isMinimized ? "Restore" : "Minimise"}
                >
                    <span class="mb-1 font-bold pointer-events-none">{isMinimized ? '+' : '_'}</span>
                </button>
            </div>
        </div>

        <!-- Content Area -->
        {#if !isMinimized}
        <div class="grid lg:grid-cols-[1.2fr_1fr] gap-0" transition:slide={{ duration: 300 }}>
            <!-- Left Column: Content -->
            <div class="p-8 md:p-10 space-y-10 border-r {colors.border} relative overflow-hidden">
                <!-- Scanline effect (subtler) -->
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-current to-transparent h-[20%] w-full animate-scan pointer-events-none opacity-[0.03]"></div>

                <div>
                    <h3 class="{colors.accent} mb-2 text-[10px] tracking-[0.3em] uppercase flex items-center gap-2 font-bold opacity-80">
                        <span class="w-2 h-px {colors.highlight}"></span> Name
                    </h3>
                    <h1 class="text-4xl md:text-5xl font-bold tracking-tight uppercase" style="text-shadow: 0 0 20px {variant === 'dark' ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.1)'}">
                        {data.name}
                    </h1>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="px-2 py-0.5 {colors.bg} border {colors.border} text-[10px] {colors.textMuted} uppercase tracking-widest font-bold">Infrastructure Engineer</span>
                    </div>
                </div>

                <div>
                    <h3 class="{colors.accent} mb-4 text-[10px] tracking-[0.3em] uppercase flex items-center gap-2 font-bold opacity-80">
                        <span class="w-2 h-px {colors.highlight}"></span> Bio
                    </h3>
                    <p class="{colors.text} opacity-90 leading-relaxed text-sm border-l-2 {colors.border} pl-4 py-1 relative">
                        <span class="absolute -left-[3px] top-0 w-[4px] h-[4px] {colors.highlight}"></span>
                        {data.bio}
                    </p>
                </div>

                <div>
                    <h3 class="{colors.accent} mb-4 text-[10px] tracking-[0.3em] uppercase flex items-center gap-2 font-bold opacity-80">
                        <span class="w-2 h-px {colors.highlight}"></span> Links
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {#each data.links as link, i}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="relative group flex border {colors.border} {variant === 'dark' ? 'bg-blue-950/30 hover:bg-blue-900/40' : 'bg-blue-50/50 hover:bg-blue-100/80'} transition-all overflow-hidden"
                                onmouseenter={() => onLinkActivate?.(link.label)}
                                onmouseleave={() => onLinkActivate?.(null)}
                                onfocusin={() => onLinkActivate?.(link.label)}
                                onfocusout={() => onLinkActivate?.(null)}
                            >
                                <!-- Main Link Area -->
                                <a href={link.url} target="_blank" rel="noopener noreferrer" class="flex-1 min-w-0 flex items-center gap-2.5 p-3 z-10 outline-none focus:bg-blue-500/10 transition-colors">
                                    <div class="absolute inset-0 {colors.highlight} opacity-0 group-hover:opacity-5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 pointer-events-none"></div>
                                    <span class="{colors.accent} font-bold text-xs">0{i+1}</span>
                                    <!-- One tile for every link so a raster favicon and an inline
                                         brand mark share a silhouette instead of competing. -->
                                    <span
                                        class="shrink-0 w-6 h-6 grid place-items-center border {colors.border} rounded-sm {variant === 'dark' ? 'bg-blue-950/60' : 'bg-white/70'} overflow-hidden"
                                        aria-hidden="true"
                                    >
                                        {#if link.iconUrl}
                                            <img
                                                src={link.iconUrl}
                                                alt=""
                                                width="16"
                                                height="16"
                                                loading="lazy"
                                                decoding="async"
                                                class="w-4 h-4 object-contain"
                                            />
                                        {:else if link.iconGlyph === 'github'}
                                            <svg class="w-4 h-4 {colors.text}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                                            </svg>
                                        {:else if link.iconGlyph === 'linkedin'}
                                            <svg class="w-4 h-4 {colors.text}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                                <path d="M3.6 5.7H1.1V15h2.5V5.7ZM2.35 1A1.45 1.45 0 1 0 2.35 3.9 1.45 1.45 0 0 0 2.35 1ZM15 9.7c0-2.6-1.4-3.8-3.26-3.8-1.5 0-2.17.82-2.55 1.4V5.7H6.7c.03.7 0 9.3 0 9.3h2.49V9.8c0-.22.02-.45.08-.61.18-.45.59-.91 1.28-.91.9 0 1.26.69 1.26 1.7V15H15V9.7Z" />
                                            </svg>
                                        {/if}
                                    </span>
                                    <span class="flex-1 min-w-0 truncate uppercase tracking-wider text-xs font-bold {colors.text}">{link.label}</span>
                                    <!-- Arrow Icon -->
                                    <svg class="w-3 h-3 {colors.accent} transform -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </a>

                                <!-- Demo Button (if exists) -->
                                {#if link.demoUrl}
                                    <a 
                                        href={link.demoUrl} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center justify-center px-3 border-l {colors.border} hover:{colors.highlight} hover:text-white transition-colors z-20"
                                        title="View Live Demo"
                                    >
                                        <span class="text-[10px] font-bold uppercase tracking-widest mr-1">DEMO</span>
                                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </a>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Right Column: Visual Diagnostics -->
            <!-- pb-32 lg:pb-10: on narrow screens the columns stack, so this block sits
                 under the fixed diagnostics toolbar without extra bottom clearance. -->
            <div class="relative p-8 md:p-10 pb-32 lg:pb-10 flex flex-col items-center justify-center {variant === 'dark' ? 'bg-blue-950/20' : 'bg-blue-50/50'} overflow-hidden">
                
                <!-- Space Background (Dark Mode) -->
                {#if variant === 'dark'}
                    <div class="absolute inset-0 pointer-events-none">
                        <!-- Nebula -->
                        <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(79,70,229,0.2)_0%,_transparent_60%)]"></div>
                        <div class="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.1)_0%,_transparent_40%)]"></div>
                        
                        <!-- Stars -->
                        <div class="absolute top-[15%] left-[25%] w-[2px] h-[2px] bg-white rounded-full animate-twinkle shadow-[0_0_2px_white]"></div>
                        <div class="absolute top-[35%] right-[15%] w-[1.5px] h-[1.5px] bg-blue-200 rounded-full animate-twinkle" style="animation-delay: 0.7s"></div>
                        <div class="absolute bottom-[20%] left-[15%] w-[2px] h-[2px] bg-indigo-300 rounded-full animate-twinkle shadow-[0_0_2px_indigo-300]" style="animation-delay: 1.5s"></div>
                        <div class="absolute bottom-[40%] right-[30%] w-[1.5px] h-[1.5px] bg-white rounded-full animate-twinkle" style="animation-delay: 2.3s"></div>
                        <div class="absolute top-[10%] right-[40%] w-[1px] h-[1px] bg-violet-200 rounded-full animate-twinkle" style="animation-delay: 0.2s"></div>
                        <div class="absolute top-[50%] left-[5%] w-[1px] h-[1px] bg-white/80 rounded-full animate-twinkle" style="animation-delay: 3s"></div>
                        <div class="absolute bottom-[10%] right-[5%] w-[2px] h-[2px] bg-cyan-200 rounded-full animate-twinkle" style="animation-delay: 1.1s"></div>
                    </div>
                {/if}

                <!-- Radial Dial Background -->
                <div class="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                    <div class="w-64 h-64 rounded-full border {colors.border} border-dashed animate-[spin_60s_linear_infinite]"></div>
                    <div class="absolute w-56 h-56 rounded-full border {colors.border} animate-[spin_40s_linear_infinite_reverse]"></div>
                </div>

                <div class="relative w-48 h-48 group cursor-help">
                    <!-- Planetary Rings (Jupiter Belt) -->
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[40%] border-2 {colors.border} rounded-[100%] rotate-12 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity"></div>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[30%] border {colors.border} rounded-[100%] -rotate-6 pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity"></div>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[50%] border border-dashed {colors.border} rounded-[100%] rotate-[20deg] pointer-events-none opacity-30 animate-[spin_20s_linear_infinite]"></div>

                    <!-- Animated Rings (Scanning) -->
                    <div class="absolute -inset-4 border {colors.border} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-90 group-hover:scale-100"></div>
                    <div class="absolute -inset-1 border-t border-b {colors.border} rounded-full animate-[spin_4s_linear_infinite]"></div>
                    
                    <div class="relative w-full h-full rounded-full overflow-hidden border-2 {colors.border} group-hover:border-blue-400 transition-colors {colors.bgSolid}">
                        <img 
                            src={data.avatarUrl} 
                            alt={data.name} 
                            class="w-full h-full object-cover grayscale opacity-60 mix-blend-luminosity hover:opacity-100 hover:mix-blend-normal transition-all duration-500 scale-110" 
                        />
                        <!-- Digital Noise Overlay -->
                        <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none"></div>
                    </div>
                </div>
            </div>
        </div>
        {/if}
    </div>
</div>

<style>
    @keyframes scan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(500%); }
    }
    .animate-scan {
        animation: scan 4s linear infinite;
    }
    @keyframes twinkle {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.3; transform: scale(0.8); }
    }
    .animate-twinkle {
        animation: twinkle 3s ease-in-out infinite;
    }
</style>
