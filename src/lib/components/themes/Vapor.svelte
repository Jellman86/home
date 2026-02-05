<script lang="ts">
    import { scale } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-mono overflow-hidden" in:scale={{ duration: 400 }}>
    <!-- Retro Grid Background (Simulated) -->
    <div class="absolute inset-0 bg-gradient-to-b from-[#1a0033] to-[#330066] -z-10"></div>
    <div class="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-0 bg-[length:100%_4px,6px_100%] pointer-events-none"></div>
    
    <!-- Sun -->
    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-t from-[#ff00cc] to-[#ffff00] rounded-full blur-xl opacity-60 -z-5 mask-image"></div>

    <div class="relative z-10 w-full max-w-lg bg-black/60 border-2 border-[#ff00cc] shadow-[0_0_20px_#ff00cc] rounded-lg p-1 backdrop-blur-sm transform rotate-1 hover:rotate-0 transition-transform duration-300">
        <div class="border border-[#00ffff] p-6 rounded relative overflow-hidden">
            
            <!-- Title -->
            <h1 class="text-center text-4xl md:text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#00ffff] to-[#ff00cc] mb-6 drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)]" style="font-family: 'system-ui'; text-shadow: 3px 3px 0px #330066;">
                {data.name}
            </h1>

            <!-- Image -->
            <div class="w-32 h-32 mx-auto rounded-full border-4 border-[#ffff00] shadow-[0_0_15px_#ffff00] overflow-hidden mb-6 relative">
                 <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover" />
                 <div class="absolute inset-0 bg-gradient-to-tr from-[#ff00cc]/30 to-transparent mix-blend-overlay"></div>
            </div>

            <p class="text-center text-[#00ffff] text-lg mb-8 shadow-black drop-shadow-md">
                {data.bio}
            </p>

            <!-- Buttons -->
            <div class="space-y-4">
                {#each data.links as link}
                    <a href={link.url} target="_blank" class="block w-full text-center py-3 bg-gradient-to-r from-[#330066] to-[#ff00cc] text-white font-bold tracking-widest uppercase hover:brightness-125 transition-all skew-x-[-10deg] border border-[#00ffff]">
                        <span class="block skew-x-[10deg]">{link.label}</span>
                    </a>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .mask-image {
        -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
        mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
    }
</style>
