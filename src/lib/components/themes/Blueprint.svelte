<script lang="ts">
    import { fade } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-mono text-blue-100" in:fade={{ duration: 300 }}>
    <!-- Grid Background -->
    <div class="fixed inset-0 pointer-events-none" 
         style="background-image: linear-gradient(#1e3a8a 1px, transparent 1px), linear-gradient(90deg, #1e3a8a 1px, transparent 1px); background-size: 40px 40px; opacity: 0.2;">
    </div>

    <div class="relative w-full max-w-5xl border-2 border-blue-500/50 bg-blue-950/80 backdrop-blur-sm p-1 shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)]">
        <!-- Corner Markers -->
        <div class="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
        <div class="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
        <div class="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
        <div class="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>

        <!-- Blueprint Header -->
        <div class="flex justify-between items-center border-b border-blue-500/30 px-6 py-4 bg-blue-900/20">
            <div class="flex gap-4 text-xs tracking-widest text-blue-300/70">
                <span>FIG 1.0</span>
                <span>//</span>
                <span>SCHEMATIC VIEW</span>
            </div>
            <div class="text-xs text-blue-300/70">REF: {data.name.toUpperCase().replace(' ', '_')}</div>
        </div>

        <div class="grid md:grid-cols-3 gap-8 p-8 md:p-12">
            <!-- Left Column: Specs -->
            <div class="space-y-8 font-mono text-sm">
                <div>
                    <h3 class="text-blue-400 mb-2 uppercase tracking-wider text-xs border-b border-blue-500/30 pb-1 w-fit">Identity</h3>
                    <h1 class="text-3xl font-bold text-white mb-1">{data.name}</h1>
                    <p class="text-blue-200/60">Architect / Engineer</p>
                </div>

                <div>
                    <h3 class="text-blue-400 mb-2 uppercase tracking-wider text-xs border-b border-blue-500/30 pb-1 w-fit">Analysis</h3>
                    <p class="text-blue-100 leading-relaxed border-l border-blue-500/30 pl-4">
                        {data.bio}
                    </p>
                </div>
            </div>

            <!-- Center: Visual -->
            <div class="relative flex items-center justify-center">
                <div class="relative w-48 h-48 rounded-full border border-blue-500/30 flex items-center justify-center group">
                    <!-- Spinning Rings -->
                    <div class="absolute inset-0 border border-dashed border-blue-400/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                    <div class="absolute inset-2 border border-blue-400/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                    
                    <img src={data.avatarUrl} alt={data.name} class="w-40 h-40 rounded-full object-cover grayscale opacity-80 mix-blend-luminosity group-hover:opacity-100 transition-opacity" />
                    
                    <!-- Crosshairs -->
                    <div class="absolute top-0 bottom-0 left-1/2 w-px bg-blue-500/20"></div>
                    <div class="absolute left-0 right-0 top-1/2 h-px bg-blue-500/20"></div>
                </div>
            </div>

            <!-- Right: Links -->
            <div class="flex flex-col justify-center gap-4">
                <h3 class="text-blue-400 mb-2 uppercase tracking-wider text-xs border-b border-blue-500/30 pb-1 w-fit">Connection Nodes</h3>
                {#each data.links as link, i}
                    <a href={link.url} target="_blank" class="flex items-center gap-3 p-3 border border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-400/50 transition-all group">
                        <span class="text-blue-400 font-bold">0{i+1}</span>
                        <span class="flex-1 text-blue-100 group-hover:text-white uppercase tracking-wider text-xs">{link.label}</span>
                        <span class="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">-></span>
                    </a>
                {/each}
            </div>
        </div>
    </div>
</div>
