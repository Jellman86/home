<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-mono text-zinc-300" in:fly={{ y: -20, duration: 600 }}>
    <!-- Cosmic Dust (CSS) -->
    <div class="absolute top-10 right-10 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white]"></div>
    <div class="absolute bottom-20 left-20 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_15px_blue]"></div>
    
    <div class="relative z-10 text-center space-y-12">
        
        <!-- Planet/Avatar -->
        <div class="relative inline-block group cursor-pointer">
            <div class="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-400/30 transition-all duration-700"></div>
            <div class="relative w-48 h-48 rounded-full overflow-hidden border-4 border-black shadow-2xl">
                <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500" />
                <!-- Shadow overlay for planet effect -->
                <div class="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-transparent opacity-80 pointer-events-none"></div>
            </div>
            <!-- Rings -->
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[30%] border border-white/20 rounded-[100%] rotate-12 pointer-events-none"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[20%] border border-white/10 rounded-[100%] -rotate-6 pointer-events-none"></div>
        </div>

        <div class="space-y-4">
            <h1 class="text-4xl md:text-5xl font-bold tracking-[0.2em] text-white uppercase" style="text-shadow: 0 0 20px rgba(255,255,255,0.3);">
                {data.name}
            </h1>
            <div class="flex justify-center items-center gap-4 text-xs text-zinc-500 uppercase tracking-widest">
                <span>Mission Commander</span>
                <span class="w-1 h-1 bg-zinc-700 rounded-full"></span>
                <span>System Architect</span>
            </div>
        </div>

        <p class="max-w-md mx-auto leading-relaxed text-zinc-400">
            {data.bio}
        </p>

        <!-- Control Panel -->
        <div class="flex justify-center gap-2">
            {#each data.links as link}
                <a href={link.url} target="_blank" class="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm backdrop-blur-md transition-all uppercase text-xs tracking-widest hover:tracking-[0.2em]">
                    {link.label}
                </a>
            {/each}
        </div>
    </div>
</div>
