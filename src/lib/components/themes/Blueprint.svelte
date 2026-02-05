<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    import { spring } from 'svelte/motion';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();

    let position = $state({ x: 0, y: 0 });
    let isDragging = $state(false);
    let dragOffset = { x: 0, y: 0 };
    
    // Spring for smooth parallax/tracking
    let mouseCoords = spring({ x: 0, y: 0 }, { stiffness: 0.1, damping: 0.4 });

    function handleMouseDown(e: MouseEvent) {
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
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="flex items-center justify-center min-h-screen p-4 font-mono text-blue-100 overflow-hidden" in:fade={{ duration: 300 }}>
    <!-- Dynamic Grid Background (Parallax) -->
    <div class="fixed inset-0 pointer-events-none" 
         style="
            background-image: 
                linear-gradient(rgba(30, 58, 138, 0.1) 1px, transparent 1px), 
                linear-gradient(90deg, rgba(30, 58, 138, 0.1) 1px, transparent 1px); 
            background-size: 40px 40px; 
            transform: translate({-$mouseCoords.x * 0.02}px, {-$mouseCoords.y * 0.02}px);
         ">
    </div>
    
    <!-- Measurement Crosshairs (Fixed to screen) -->
    <div class="fixed top-0 bottom-0 w-px bg-blue-500/10 pointer-events-none z-0" style="left: {$mouseCoords.x}px"></div>
    <div class="fixed left-0 right-0 h-px bg-blue-500/10 pointer-events-none z-0" style="top: {$mouseCoords.y}px"></div>

    <!-- Draggable Container -->
    <div 
        class="relative w-full max-w-5xl border border-blue-500/30 bg-slate-950/80 backdrop-blur-md shadow-[0_0_100px_-20px_rgba(59,130,246,0.2)] pointer-events-auto"
        style="transform: translate({position.x}px, {position.y}px); transition: transform {isDragging ? '0s' : '0.1s'}; box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1), 0 20px 50px -10px rgba(0, 0, 0, 0.5);"
        in:scale={{ duration: 400, start: 0.95, opacity: 0 }}
    >
        <!-- Complex Corner Markers -->
        <svg class="absolute -top-2 -left-2 w-8 h-8 text-blue-400 pointer-events-none" viewBox="0 0 32 32">
            <path d="M0,0 L12,0 M0,0 L0,12" fill="none" stroke="currentColor" stroke-width="2"/>
            <rect x="4" y="4" width="2" height="2" fill="currentColor" class="animate-pulse"/>
        </svg>
        <svg class="absolute -top-2 -right-2 w-8 h-8 text-blue-400 pointer-events-none rotate-90" viewBox="0 0 32 32">
            <path d="M0,0 L12,0 M0,0 L0,12" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <svg class="absolute -bottom-2 -left-2 w-8 h-8 text-blue-400 pointer-events-none -rotate-90" viewBox="0 0 32 32">
            <path d="M0,0 L12,0 M0,0 L0,12" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <svg class="absolute -bottom-2 -right-2 w-8 h-8 text-blue-400 pointer-events-none rotate-180" viewBox="0 0 32 32">
            <path d="M0,0 L12,0 M0,0 L0,12" fill="none" stroke="currentColor" stroke-width="2"/>
            <rect x="4" y="4" width="2" height="2" fill="currentColor" class="animate-pulse"/>
        </svg>

        <!-- Technical Header (Drag Handle) -->
        <div 
            class="group flex justify-between items-center border-b border-blue-500/20 px-4 py-2 bg-gradient-to-r from-blue-900/20 to-transparent cursor-grab active:cursor-grabbing select-none"
            onmousedown={handleMouseDown}
            role="button"
            tabindex="0"
        >
            <div class="flex items-center gap-3">
                <div class="flex gap-0.5">
                    <div class="w-1 h-4 bg-blue-500/50"></div>
                    <div class="w-1 h-4 bg-blue-500/30"></div>
                    <div class="w-1 h-4 bg-blue-500/10"></div>
                </div>
                <div class="flex gap-2 text-[10px] tracking-[0.2em] text-blue-300/80 font-bold">
                    <span>SCHEMATIC_VIEW</span>
                    <span class="text-blue-500">//</span>
                    <span>V.2.5</span>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="text-[9px] text-blue-400/50 tracking-widest hidden sm:block">
                    COORDS: [{$mouseCoords.x.toFixed(0)}, {$mouseCoords.y.toFixed(0)}]
                </div>
                <div class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
            </div>
        </div>

        <div class="grid lg:grid-cols-[1.2fr_1fr] gap-0">
            <!-- Left Column: Content -->
            <div class="p-8 md:p-10 space-y-10 border-r border-blue-500/20 relative overflow-hidden">
                <!-- Scanline effect -->
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/5 to-transparent h-[20%] w-full animate-scan pointer-events-none"></div>

                <div>
                    <h3 class="text-blue-500/70 mb-2 text-[10px] tracking-[0.3em] uppercase flex items-center gap-2">
                        <span class="w-2 h-px bg-blue-500"></span> Subject_ID
                    </h3>
                    <h1 class="text-4xl md:text-5xl font-bold text-white tracking-tight uppercase" style="text-shadow: 0 0 20px rgba(59,130,246,0.3)">
                        {data.name}
                    </h1>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-300 uppercase tracking-widest">Architect</span>
                        <span class="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-300 uppercase tracking-widest">Engineer</span>
                    </div>
                </div>

                <div>
                    <h3 class="text-blue-500/70 mb-4 text-[10px] tracking-[0.3em] uppercase flex items-center gap-2">
                        <span class="w-2 h-px bg-blue-500"></span> Data_Stream
                    </h3>
                    <p class="text-blue-100/80 leading-relaxed text-sm border-l-2 border-blue-500/20 pl-4 py-1 relative">
                        <span class="absolute -left-[3px] top-0 w-[4px] h-[4px] bg-blue-500"></span>
                        {data.bio}
                        <span class="inline-block w-1.5 h-3 bg-blue-500/50 ml-1 animate-pulse align-middle"></span>
                    </p>
                </div>

                <div>
                    <h3 class="text-blue-500/70 mb-4 text-[10px] tracking-[0.3em] uppercase flex items-center gap-2">
                        <span class="w-2 h-px bg-blue-500"></span> Uplink_Nodes
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {#each data.links as link, i}
                            <a href={link.url} target="_blank" class="group relative flex items-center gap-3 p-3 border border-blue-500/20 hover:border-blue-400/60 bg-blue-950/30 hover:bg-blue-900/40 transition-all overflow-hidden">
                                <div class="absolute inset-0 bg-blue-400/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                                <span class="text-blue-500 font-bold text-xs">0{i+1}</span>
                                <span class="flex-1 text-blue-100 group-hover:text-white uppercase tracking-wider text-xs relative z-10">{link.label}</span>
                                <svg class="w-3 h-3 text-blue-500 transform -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </a>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Right Column: Visual Diagnostics -->
            <div class="relative p-8 md:p-10 flex flex-col items-center justify-center bg-blue-950/20">
                <!-- Radial Dial Background -->
                <div class="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                    <div class="w-64 h-64 rounded-full border border-blue-500/30 border-dashed animate-[spin_60s_linear_infinite]"></div>
                    <div class="absolute w-56 h-56 rounded-full border border-blue-500/20 animate-[spin_40s_linear_infinite_reverse]"></div>
                </div>

                <div class="relative w-48 h-48 group cursor-crosshair">
                    <!-- Animated Rings -->
                    <div class="absolute -inset-4 border border-blue-500/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-90 group-hover:scale-100"></div>
                    <div class="absolute -inset-1 border-t border-b border-blue-400/50 rounded-full animate-[spin_4s_linear_infinite]"></div>
                    
                    <div class="relative w-full h-full rounded-full overflow-hidden border-2 border-blue-500/30 group-hover:border-blue-400 transition-colors bg-blue-950">
                        <img 
                            src={data.avatarUrl} 
                            alt={data.name} 
                            class="w-full h-full object-cover grayscale opacity-60 mix-blend-luminosity hover:opacity-100 hover:mix-blend-normal transition-all duration-500 scale-110" 
                        />
                        <!-- Digital Noise Overlay -->
                        <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none"></div>
                    </div>

                    <!-- Target Reticle -->
                    <div class="absolute top-0 bottom-0 left-1/2 w-px bg-blue-500/30 group-hover:bg-blue-400/80 transition-colors"></div>
                    <div class="absolute left-0 right-0 top-1/2 h-px bg-blue-500/30 group-hover:bg-blue-400/80 transition-colors"></div>
                </div>

                <!-- Diagnostics Text -->
                <div class="mt-8 grid grid-cols-2 gap-x-8 gap-y-2 text-[9px] text-blue-400/60 uppercase tracking-widest font-mono">
                    <div>Status:</div><div class="text-blue-300">Online</div>
                    <div>Latency:</div><div class="text-blue-300">12ms</div>
                    <div>Security:</div><div class="text-blue-300">Encrypted</div>
                </div>
            </div>
        </div>
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
</style>
