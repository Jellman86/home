<script lang="ts">
    import { fade } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex flex-col justify-between min-h-screen p-8 md:p-16 bg-[#f0f0f0] text-black font-sans" in:fade={{ duration: 800 }}>
    <!-- Top Bar -->
    <div class="flex justify-between items-start border-t-4 border-black pt-4">
        <span class="text-sm font-bold tracking-widest uppercase">Portfolio</span>
        <span class="text-sm font-bold tracking-widest uppercase">2025</span>
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-8 my-auto items-center">
        <!-- Text -->
        <div class="md:col-span-7 z-10 mix-blend-multiply">
            <h1 class="text-7xl md:text-9xl font-bold tracking-tighter leading-none mb-8">
                {data.name.split(' ')[0]}
                <span class="block text-[#ff3300] indent-24">{data.name.split(' ')[1]}</span>
            </h1>
            <p class="text-xl md:text-2xl font-medium leading-tight max-w-md ml-auto mr-12">
                {data.bio}
            </p>
        </div>

        <!-- Image -->
        <div class="md:col-span-5 relative">
            <div class="aspect-[3/4] bg-black overflow-hidden relative grayscale hover:grayscale-0 transition-all duration-700 ease-out">
                 <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover opacity-90" />
            </div>
            <!-- Floating Circle -->
            <div class="absolute -bottom-12 -left-12 w-24 h-24 bg-[#ff3300] rounded-full mix-blend-multiply animate-bounce duration-[3000ms]"></div>
        </div>
    </div>

    <!-- Links -->
    <div class="grid grid-cols-1 md:grid-cols-3 border-b-4 border-black pb-4 gap-8">
        {#each data.links as link}
            <a href={link.url} target="_blank" class="text-2xl font-bold hover:text-[#ff3300] transition-colors flex items-center gap-2 group">
                <span class="w-3 h-3 bg-black group-hover:bg-[#ff3300] rounded-full"></span>
                {link.label}
            </a>
        {/each}
    </div>
</div>
