<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-sans text-teal-50" in:fly={{ y: 20, duration: 800 }}>
    <!-- Organic blobs background blur done via CSS in main layout or parent -->
    
    <div class="relative w-full max-w-4xl grid md:grid-cols-2 gap-16 items-center">
        
        <!-- Text -->
        <div class="order-2 md:order-1 space-y-8 relative">
            <div class="absolute -left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-teal-500/30 to-transparent"></div>
            
            <div>
                <span class="text-teal-400 tracking-[0.2em] text-xs uppercase font-bold mb-4 block">Bioluminescent Entity</span>
                <h1 class="text-5xl md:text-6xl font-thin tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-br from-teal-100 to-teal-600">
                    {data.name}
                </h1>
            </div>

            <p class="text-teal-200/80 leading-loose text-lg font-light">
                {data.bio}
            </p>

            <div class="flex gap-6 pt-4">
                {#each data.links as link}
                    <a href={link.url} target="_blank" class="text-teal-300 hover:text-white transition-colors text-sm uppercase tracking-widest relative group py-2">
                        {link.label}
                        <span class="absolute bottom-0 left-0 w-full h-px bg-teal-500/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></span>
                    </a>
                {/each}
            </div>
        </div>

        <!-- Image -->
        <div class="order-1 md:order-2 relative group">
            <div class="relative aspect-[3/4] rounded-full overflow-hidden border border-teal-500/20 shadow-[0_0_100px_-20px_rgba(20,184,166,0.3)]">
                <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" />
                <div class="absolute inset-0 bg-teal-900/40 mix-blend-color"></div>
            </div>
            
            <!-- Orbiting particles (CSS only) -->
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full border border-teal-500/10 animate-[spin_20s_linear_infinite]"></div>
        </div>
    </div>
</div>
