<script lang="ts">
    import { fade } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex flex-col min-h-screen p-8 md:p-12 font-sans bg-white text-neutral-900" in:fade={{ duration: 500 }}>
    
    <!-- Minimal Header -->
    <header class="flex justify-between items-center mb-24">
        <div class="w-4 h-4 bg-red-600 rounded-full"></div>
        <div class="text-xs font-bold uppercase tracking-widest text-neutral-400">Exhibition 2025</div>
    </header>

    <!-- Main -->
    <main class="flex-1 grid md:grid-cols-12 gap-8 items-end pb-12">
        <div class="md:col-span-8">
            <h1 class="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85] mb-8">
                {data.name.split(' ')[0]}<span class="text-neutral-200">.</span><br/>
                {data.name.split(' ')[1]}
            </h1>
            <div class="h-px w-24 bg-neutral-200 mb-8"></div>
            <p class="text-xl md:text-2xl font-light text-neutral-500 max-w-2xl leading-relaxed">
                {data.bio}
            </p>
        </div>

        <div class="md:col-span-4 flex flex-col justify-end h-full">
            <img src={data.avatarUrl} alt={data.name} class="w-32 h-32 object-cover grayscale mb-8 ml-auto md:ml-0" />
            
            <nav class="flex flex-col items-end md:items-start gap-3">
                {#each data.links as link}
                    <a href={link.url} target="_blank" class="group flex items-center gap-2 text-lg font-medium hover:text-red-600 transition-colors">
                        <span class="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-red-600">→</span>
                        {link.label}
                    </a>
                {/each}
            </nav>
        </div>
    </main>

    <!-- Footer -->
    <footer class="flex justify-between items-end border-t border-neutral-100 pt-8">
        <div class="text-[10px] text-neutral-400 max-w-[200px]">
            PART OF THE PERMANENT COLLECTION. DO NOT TOUCH THE ARTWORK.
        </div>
        <div class="text-[10px] text-neutral-400">
            FIG. 8
        </div>
    </footer>
</div>
