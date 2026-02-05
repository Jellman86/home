<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-sans text-[#2c1810]" in:fade={{ duration: 1000 }}>
    <!-- Paper Texture Overlay -->
    <div class="fixed inset-0 pointer-events-none opacity-40 mix-blend-multiply z-0" 
         style="background-image: url('https://www.transparenttextures.com/patterns/cream-paper.png'); background-color: #f3f0eb;">
    </div>

    <div class="relative z-10 w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center p-8 border-y border-[#2c1810]/10">
        
        <!-- Portrait -->
        <div class="order-2 md:order-1 relative group">
            <div class="absolute inset-0 border border-[#2c1810] translate-x-3 translate-y-3 transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-2"></div>
            <div class="relative aspect-[4/5] overflow-hidden grayscale sepia-[.3]">
                <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover" />
            </div>
        </div>

        <!-- Content -->
        <div class="order-1 md:order-2 text-center md:text-left">
            <h6 class="font-serif italic text-lg text-[#8a7e72] mb-4 tracking-widest">The Portfolio of</h6>
            <h1 class="font-serif text-5xl md:text-6xl text-[#2c1810] mb-6 leading-tight">
                {data.name}
            </h1>
            <div class="h-px w-16 bg-[#2c1810] my-6 mx-auto md:mx-0"></div>
            <p class="font-serif text-lg leading-loose text-[#594a42] mb-10">
                {data.bio}
            </p>

            <nav class="flex flex-col gap-4">
                {#each data.links as link}
                    <a href={link.url} target="_blank" class="group flex items-center gap-4 text-[#2c1810] hover:text-[#8a7e72] transition-colors">
                        <span class="font-serif italic text-xl border-b border-transparent group-hover:border-[#8a7e72] transition-all">
                            {link.label}
                        </span>
                        <span class="text-xs tracking-widest opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                            — VIEW
                        </span>
                    </a>
                {/each}
            </nav>
        </div>
    </div>
</div>
