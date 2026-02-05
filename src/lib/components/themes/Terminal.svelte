<script lang="ts">
    import { fade } from 'svelte/transition';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();
</script>

<div class="flex items-center justify-center min-h-screen p-4 font-sans text-amber-500 selection:bg-amber-500/30" in:fade={{ duration: 100 }}>
    <!-- CRT Overlay -->
    <div class="fixed inset-0 bg-[radial-gradient(circle,rgba(18,16,16,0)_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none z-10"></div>
    <div class="fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-10 bg-[length:100%_4px,6px_100%] pointer-events-none opacity-20"></div>

    <div class="relative z-0 w-full max-w-3xl p-8 border-2 border-amber-900/50 bg-black/80 shadow-[0_0_20px_rgba(180,83,9,0.2)]">
        
        <!-- Header -->
        <header class="mb-12 border-b border-amber-900/50 pb-4 flex justify-between items-end">
            <div>
                <h1 class="text-4xl font-bold tracking-tight text-amber-500 mb-1" style="text-shadow: 0 0 10px rgba(245,158,11,0.5);">
                    {data.name}
                </h1>
                <p class="text-amber-700 font-mono text-sm">USER_HANDLE: jellman86</p>
            </div>
            <div class="hidden md:block text-amber-800 font-mono text-xs">
                SYS.UPTIME: 99.9%
            </div>
        </header>

        <div class="grid md:grid-cols-[1fr_200px] gap-12">
            <!-- Content -->
            <div class="space-y-8">
                <section>
                    <h2 class="text-amber-700 font-mono text-xs mb-2 uppercase">>> Bio_Data_Load</h2>
                    <p class="text-lg leading-relaxed text-amber-400/90 font-medium font-mono">
                        {data.bio}
                    </p>
                </section>

                <section>
                    <h2 class="text-amber-700 font-mono text-xs mb-4 uppercase">>> External_Links</h2>
                    <div class="flex flex-wrap gap-4">
                        {#each data.links as link}
                            <a href={link.url} target="_blank" class="px-4 py-2 border border-amber-700/50 text-amber-500 hover:bg-amber-900/20 hover:text-amber-300 hover:border-amber-500 transition-colors font-mono text-sm uppercase flex items-center gap-2">
                                <span>[{link.label}]</span>
                            </a>
                        {/each}
                    </div>
                </section>
            </div>

            <!-- Avatar -->
            <div class="flex flex-col gap-4">
                <div class="aspect-square border border-amber-900/50 p-1 bg-amber-950/30">
                    <img src={data.avatarUrl} alt={data.name} class="w-full h-full object-cover grayscale sepia contrast-125 brightness-75" />
                </div>
                <div class="text-xs text-amber-800 font-mono text-center">
                    IMG_REF_001.JPG
                </div>
            </div>
        </div>
        
        <!-- Blinking Cursor Footer -->
        <div class="mt-12 pt-4 border-t border-amber-900/50 text-amber-700 font-mono text-xs animate-pulse">
            _WAITING_FOR_INPUT...
        </div>
    </div>
</div>
