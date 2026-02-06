<script lang="ts">
    import { fade, slide } from 'svelte/transition';
    import { tick } from 'svelte';
    import type { PortfolioData } from '$lib/types';

    let { data }: { data: PortfolioData } = $props();

    let position = $state({ x: 0, y: 0 });
    let isDragging = $state(false);
    let isMinimized = $state(false);
    let dragOffset = { x: 0, y: 0 };

    // Terminal Logic
    let commandInput = $state("");
    let inputRef: HTMLInputElement;
    let terminalContentRef: HTMLDivElement;
    
    // Start with empty history or just a welcome message
    let history = $state<{cmd: string, output: string | any, type?: 'text'|'component'}[]>([
        { cmd: '', output: 'Welcome to Pownet OS. Type "help" for a list of commands.', type: 'text' }
    ]);

    function handleMouseDown(e: MouseEvent) {
        if (e.target instanceof Element && (e.target.closest('button') || e.target.closest('input') || e.target.closest('a'))) return; 
        
        isDragging = true;
        dragOffset = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging) return;
        position.x = e.clientX - dragOffset.x;
        position.y = e.clientY - dragOffset.y;
    }

    function handleMouseUp() {
        isDragging = false;
        if (!isMinimized && inputRef) inputRef.focus();
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
    }

    async function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            const cmd = commandInput.trim();
            if (!cmd) {
                history = [...history, { cmd: "", output: "", type: 'text' }];
                commandInput = "";
                return;
            }

            const args = cmd.split(' ');
            const mainCmd = args[0].toLowerCase();
            
            let output: string | any = "";
            let type: 'text' | 'component' = 'text';

            switch (mainCmd) {
                case 'help':
                    output = "Available commands:\n  help     Show this help message\n  clear    Clear terminal history\n  ls       List links/files\n  cat      Read file content\n  whoami   Display current user\n  date     Show current system time\n  sudo     Execute a command as another user\n  exit     Close the terminal session\n  neofetch System info\n  pownet   Display branding";
                    break;
                case 'clear':
                    history = [];
                    commandInput = "";
                    return;
                case 'whoami':
                    output = "scott (uid=1000)";
                    break;
                case 'ls':
                case 'll':
                    output = data.links;
                    type = 'component';
                    break;
                case 'cat':
                    if (args[1] === 'bio.txt') {
                        output = data.bio;
                    } else {
                        output = `cat: ${args[1] || ''}: No such file or directory`;
                    }
                    break;
                case 'sudo':
                    output = `[sudo] password for scott: \nSorry, user scott is not allowed to execute '${args.slice(1).join(' ') || ''}' as root on pownet.`;
                    break;
                case 'date':
                    output = new Date().toString();
                    break;
                case 'exit':
                    isMinimized = true;
                    output = "Session closed.";
                    break;
                case 'pownet':
                    output = `
 ██████╗  ██████╗ ██╗    ██╗███╗   ██╗███████╗████████╗
 ██╔══██╗██╔═══██╗██║    ██║████╗  ██║██╔════╝╚══██╔══╝
 ██████╔╝██║   ██║██║ █╗ ██║██╔██╗ ██║█████╗     ██║   
 ██╔═══╝ ██║   ██║██║███╗██║██║╚██╗██║██╔══╝     ██║   
 ██║     ╚██████╔╝╚███╔███╔╝██║ ╚████║███████╗   ██║   
 ╚═╝      ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   
                                UK INFRASTRUCTURE ENGINE
`;
                    break;
                case 'neofetch':
                    output = `       .---.
      /     \      OS: Pownet OS x86_64
      |  o  |      Kernel: 5.15.0-boids
      \     /      Uptime: Forever
       '-_-'       Shell: zsh 5.8
                   Theme: Terminal Dark
                   CPU: Neural Engine
                   Memory: 128TB
`;
                    break;
                case 'cowsay':
                    const msg = args.slice(1).join(' ') || "Moo";
                    output = `
 ___________________
< ${msg} >
 -------------------
        \   ^__^
         \  (oo)\\_______
            (__)\\       )\/\ 
                ||----w |
                ||     ||
`;
                    break;
                case 'sl':
                    output = "🚂 CHOO CHOO! (ASCII Train would go here)";
                    break;
                default:
                    output = `zsh: command not found: ${mainCmd}`;
            }

            history = [...history, { cmd, output, type }];
            commandInput = "";
            
            await tick();
            if (terminalContentRef) {
                terminalContentRef.scrollTop = terminalContentRef.scrollHeight;
            }
        }
    }
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="flex items-center justify-center min-h-screen p-4 font-mono text-gray-300 overflow-hidden" in:fade={{ duration: 200 }}>
    <div 
        class="relative w-full max-w-4xl bg-[#300a24]/85 backdrop-blur-md rounded-lg shadow-2xl overflow-hidden border border-black/60 pointer-events-auto flex flex-col"
        style="transform: translate({position.x}px, {position.y}px); transition: transform {isDragging ? '0s' : '0.1s'}, height 0.3s; min-height: {isMinimized ? 'auto' : '500px'};"
    >
        <!-- Title Bar -->
        <div 
            class="bg-[#3e3e3e] px-4 py-2 flex justify-between items-center cursor-grab active:cursor-grabbing select-none border-b border-black/40 h-10"
            onmousedown={handleMouseDown}
            role="button"
            tabindex="0"
        >
            <div class="w-16"></div>
            <div class="text-sm text-gray-400 font-bold tracking-wide">scott@pownet: ~</div>
            <div class="flex gap-3 w-16 justify-end">
                <button 
                    onclick={toggleMinimize}
                    class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none"
                    title="Minimize"
                >
                    <div class="w-2.5 h-0.5 bg-current rounded-full"></div>
                </button>
            </div>
        </div>

        {#if !isMinimized}
        <div 
            bind:this={terminalContentRef}
            class="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" 
            transition:slide={{ duration: 200 }}
            onclick={() => inputRef && inputRef.focus()}
            role="button"
            tabindex="0"
            onkeydown={() => {}}
        >
            {#each history as item}
                <div class="mb-2">
                    {#if item.cmd !== null && item.cmd !== undefined && (item.cmd !== '' || item.output === '')}
                    <div class="flex gap-2">
                        <span class="text-[#8ae234] font-bold">scott@pownet</span><span class="text-white">:</span><span class="text-[#729fcf] font-bold">~</span><span class="text-white">$</span>
                        <span>{item.cmd}</span>
                    </div>
                    {/if}
                    {#if item.output}
                        <div class="pl-0 mt-1 text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {#if item.type === 'component'}
                                <div class="flex flex-col gap-1">
                                    {#each item.output as link}
                                        <a href={link.url} target="_blank" class="text-[#729fcf] hover:underline w-fit flex items-center gap-2">
                                            {link.label} <span class="text-gray-500 text-xs">-> {link.url}</span>
                                        </a>
                                    {/each}
                                </div>
                            {:else}
                                {item.output}
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}

            <!-- Input Line -->
            <div class="flex gap-2 items-center">
                <span class="text-[#8ae234] font-bold">scott@pownet</span><span class="text-white">:</span><span class="text-[#729fcf] font-bold">~</span><span class="text-white">$</span>
                <div class="relative flex-1">
                    <input 
                        bind:this={inputRef}
                        bind:value={commandInput}
                        onkeydown={handleKeydown}
                        type="text" 
                        class="w-full bg-transparent border-none outline-none text-white font-mono p-0 m-0 cursor-text"
                        autocomplete="off" 
                        spellcheck="false"
                        autofocus
                    />
                </div>
            </div>
        </div>
        {/if}
    </div>
</div>

<style>
    .scrollbar-thin::-webkit-scrollbar { width: 8px; }
    .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; border: 2px solid #300a24; }
</style>
