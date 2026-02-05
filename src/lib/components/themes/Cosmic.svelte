<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-6 font-sans text-indigo-100" in:fade={{ duration: 800 }}>
    <!-- Nebula Atmosphere (Static for performance, moving parts in Boid background) -->
    <div class="fixed inset-0 pointer-events-none opacity-40">
        <div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/30 rounded-full blur-[100px] mix-blend-screen"></div>
        <div class="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-900/20 rounded-full blur-[120px] mix-blend-screen"></div>
    </div>
    
    <div class="relative z-10 w-full max-w-6xl grid lg:grid-cols-2 gap-16 items-center">
        
        <!-- Left: The Star/Avatar -->
        <div class="order-2 lg:order-1 relative flex justify-center lg:justify-end">
            <div class="relative w-64 h-64 lg:w-80 lg:h-80 group cursor-pointer perspective-1000">
                
                <!-- Accretion Disk (Glow) -->
                <div class="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-400/30 transition-all duration-1000 animate-pulse-slow"></div>
                
                <!-- Orbiting Rings -->
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] border border-indigo-500/10 rounded-full animate-[spin_20s_linear_infinite]"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-[180%] border border-indigo-500/5 rounded-full animate-[spin_30s_linear_infinite_reverse] border-dashed"></div>

                <!-- The Planet -->
                <div class="relative w-full h-full rounded-full overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] border border-indigo-500/20 group-hover:border-indigo-400/50 transition-colors z-10">
                    <img 
                        src={data.avatarUrl} 
                        alt={data.name} 
                        class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-1000 ease-out" 
                    />
                    <!-- Atmosphere Shader Overlay -->
                    <div class="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-indigo-500/20 opacity-80"></div>
                    <!-- Terminator Line -->
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent opacity-60"></div>
                </div>

                <!-- Floating Label -->
                <div class="absolute -bottom-12 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] text-indigo-300/50 uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    Class M Planetoid
                </div>
            </div>
        </div>

        <!-- Right: The Signal/Content -->
        <div class="order-1 lg:order-2 space-y-10 text-center lg:text-left">
            <div class="space-y-4">
                <div class="flex items-center justify-center lg:justify-start gap-3 mb-6">
                    <span class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></span>
                    <span class="text-xs tracking-[0.3em] uppercase text-indigo-400/80 font-medium">Incoming Transmission</span>
                </div>
                
                <h1 class="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[0.9]">
                    <span class="block text-indigo-200 font-light tracking-wide text-3xl md:text-4xl mb-2">Hello, I am</span>
                    {data.name}
                </h1>
                
                <div class="w-24 h-px bg-gradient-to-r from-indigo-500 to-transparent mx-auto lg:mx-0 my-6"></div>
            </div>

            <p class="text-lg md:text-xl text-indigo-200/70 font-light leading-relaxed max-w-lg mx-auto lg:mx-0">
                {data.bio}
            </p>

            <div class="flex flex-wrap justify-center lg:justify-start gap-4 pt-4">
                {#each data.links as link}
                    <a 
                        href={link.url} 
                        target="_blank" 
                        class="relative px-8 py-4 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/20 hover:border-indigo-400/60 rounded-full transition-all duration-300 group overflow-hidden"
                    >
                        <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span class="relative z-10 text-sm tracking-[0.2em] uppercase text-indigo-300 group-hover:text-white font-medium flex items-center gap-2">
                            {link.label}
                            <svg class="w-3 h-3 transform translate-x-0 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </span>
                    </a>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .perspective-1000 {
        perspective: 1000px;
    }
    .animate-pulse-slow {
        animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
</style>
