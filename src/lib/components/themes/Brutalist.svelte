<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-mono" in:fly={{ y: 50, duration: 300 }}>
    <div class="relative w-full max-w-3xl bg-[#0a0a0a] border-2 border-[#00ff41] p-2 shadow-[8px_8px_0px_0px_#00ff41]">
        <!-- Header Strip -->
        <div class="flex justify-between items-center border-b-2 border-[#00ff41] pb-2 mb-8 bg-[#00ff41] text-black px-2">
            <span class="font-bold uppercase tracking-widest">SYSTEM_READY</span>
            <span class="text-sm">V.2.0.24</span>
        </div>

        <div class="grid md:grid-cols-[200px_1fr] gap-8 p-4">
            <!-- Sidebar / Avatar -->
            <div class="flex flex-col gap-4">
                <div class="relative aspect-square border-2 border-[#00ff41] overflow-hidden grayscale contrast-125 hover:grayscale-0 transition-all duration-300">
                    <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-[#00ff41]/20 pointer-events-none scanline"></div>
                </div>
                <div class="border border-[#00ff41] p-2 text-xs text-[#00ff41]">
                    <p>> ID: USER_ADMIN</p>
                    <p>> LOC: UK_REGION</p>
                    <p>> STATUS: ONLINE</p>
                </div>
            </div>

            <!-- Content -->
            <div class="flex flex-col justify-between">
                <div>
                    <h1 class="text-4xl md:text-6xl font-black text-white uppercase mb-4 tracking-tighter leading-[0.8]">
                        {data.name.split(' ')[0]}<br/>
                        <span class="text-[#00ff41]">{data.name.split(' ')[1]}</span>
                    </h1>
                    <p class="text-[#00ff41] text-lg mb-8 leading-relaxed border-l-4 border-[#00ff41] pl-4">
                        {data.bio}
                    </p>
                </div>

                <!-- Links -->
                <div class="flex flex-col gap-3">
                    {#each data.links as link}
                        <a 
                            href={link.url}
                            target="_blank"
                            class="group flex items-center justify-between border border-[#00ff41] p-3 text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition-colors duration-0"
                        >
                            <span class="font-bold uppercase tracking-wider group-hover:before:content-['>_'] group-hover:before:mr-2">
                                {link.label}
                            </span>
                            <span>↗</span>
                        </a>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .scanline {
        background: linear-gradient(to bottom, transparent 50%, rgba(0, 255, 65, 0.1) 50%);
        background-size: 100% 4px;
    }
</style>
