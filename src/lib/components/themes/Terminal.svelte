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
    
    // Decryption Logic
    let isDragOver = $state(false);
    let decryptionStatus = $state<'idle' | 'analyzing' | 'decrypting' | 'success' | 'fail'>('idle');
    let decryptedLink = $state("");
    let logBuffer = $state<string[]>([]);

    // Encrypted CV Data (AES-256-GCM)
    // Generated offline. Contains URL to OneDrive.
    const ENC_IV = "f1b639dfa5614a52973f8bdf";
    const ENC_DATA = "debdb8a12d355a9dbece5d6b2bef4ad7426c2f284793309b063ad60eac30d6d82256721b8e992a318a1f21afd34ea47c9fd75865d8f64021546b43d0056de0f83a4464aad070b248ce1556be95551338f462ed7148834f7e6bebd7031dab9a263bf23b89";

    function hexToBytes(hex: string) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }

    async function processFile(file: File) {
        decryptionStatus = 'analyzing';
        logBuffer = ["Mounting file system...", "Reading sector 0...", " Analyzing file structure..."];
        
        await new Promise(r => setTimeout(r, 800));
        
        const text = await file.text();
        const keyHex = text.trim();

        if (keyHex.length !== 64) {
            logBuffer = [...logBuffer, "ERROR: Invalid key length.", "Integrity check failed."];
            decryptionStatus = 'fail';
            setTimeout(() => decryptionStatus = 'idle', 3000);
            return;
        }

        logBuffer = [...logBuffer, "Key format detected: AES-256-GCM", "Initiating decryption sequence..."];
        decryptionStatus = 'decrypting';

        // Fake "Fuss" Animation
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 100));
            logBuffer = [...logBuffer, `Decrypting block ${i}... [${Math.random().toString(16).slice(2, 10)}] OK`];
            // keep buffer small
            if (logBuffer.length > 8) logBuffer.shift();
        }

        try {
            const keyBytes = hexToBytes(keyHex);
            const ivBytes = hexToBytes(ENC_IV);
            const dataBytes = hexToBytes(ENC_DATA);

            const key = await window.crypto.subtle.importKey(
                "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
            );

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivBytes },
                key,
                dataBytes
            );

            const decoder = new TextDecoder();
            decryptedLink = decoder.decode(decrypted);
            
            logBuffer = [...logBuffer, "Decryption successful.", "Payload extracted."];
            decryptionStatus = 'success';
            
            // Add to history
            history = [...history, { 
                cmd: './access_token.pem', 
                output: 'Access Granted: Encrypted payload decrypted successfully.', 
                type: 'text' 
            }];

        } catch (e) {
            console.error(e);
            logBuffer = [...logBuffer, "CRITICAL ERROR: Decryption failed.", "Invalid key or corrupted data."];
            decryptionStatus = 'fail';
            setTimeout(() => decryptionStatus = 'idle', 3000);
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragOver = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragOver = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragOver = false;
        
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    }

    // Initial history mimics the static view
    let history = $state<{cmd: string, output: string | any, type?: 'text'|'component'}[]>([
        { cmd: '', output: 'Welcome to Pownet OS. Type "help" for a list of commands.', type: 'text' }
    ]);

    let fileInputRef: HTMLInputElement;

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            processFile(target.files[0]);
        }
        // Reset input so same file can be selected again
        target.value = '';
    }

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
                    output = "Available commands:\n  help     Show this help message\n  clear    Clear terminal history\n  ls       List links/files\n  cat      Read file content\n  whoami   Display current user\n  date     Show current system time\n  sudo     Execute a command as another user\n  ./upload-file.sh Upload decryption key (.pem, .key)\n  exit     Close the terminal session\n  neofetch System info\n  pownet   Display branding";
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
                case './upload-file.sh':
                case '.\\upload-file.sh':
                case 'upload-file.sh':
                    fileInputRef.click();
                    output = "Opening secure file picker...";
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
        class="relative w-full max-w-4xl bg-black/90 backdrop-blur-md rounded-lg shadow-2xl overflow-hidden border border-white/10 pointer-events-auto flex flex-col"
        style="transform: translate({position.x}px, {position.y}px); transition: transform {isDragging ? '0s' : '0.1s'}, height 0.3s; height: {isMinimized ? 'auto' : '600px'}; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);"
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        role="application"
        tabindex="-1"
    >
        <!-- Drag & Drop Overlay -->
        {#if isDragOver}
            <div class="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center border-4 border-green-500/50 border-dashed m-2 rounded" transition:fade={{ duration: 100 }}>
                <svg class="w-16 h-16 text-green-500 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" />
                </svg>
                <div class="text-2xl font-bold text-green-500 tracking-widest">DROP ACCESS TOKEN</div>
                <div class="text-green-500/70 mt-2 font-mono text-sm">Initiate Secure Handshake</div>
            </div>
        {/if}

        <!-- Decryption "Fuss" Overlay -->
        {#if decryptionStatus !== 'idle'}
            <div class="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center font-mono p-8" transition:fade={{ duration: 200 }}>
                {#if decryptionStatus === 'success'}
                    <div class="text-center space-y-6">
                        <div class="w-20 h-20 border-4 border-green-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <svg class="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 class="text-3xl font-bold text-green-500 tracking-widest">ACCESS GRANTED</h2>
                        <div class="p-4 border border-green-500/30 bg-green-500/10 rounded">
                            <p class="text-xs text-green-400 mb-2 uppercase">Secure Payload:</p>
                            <a href={decryptedLink} target="_blank" class="text-xl font-bold text-white underline decoration-green-500 underline-offset-4 hover:text-green-400 transition-colors">
                                View Curriculum Vitae
                            </a>
                        </div>
                        <button onclick={() => decryptionStatus = 'idle'} class="text-xs text-gray-500 hover:text-white underline">Close</button>
                    </div>
                {:else if decryptionStatus === 'fail'}
                    <div class="text-center space-y-4">
                        <div class="text-4xl text-red-500 font-bold mb-4">ACCESS DENIED</div>
                        <div class="text-red-400 font-mono">
                            Error: Invalid Token<br>
                            Incident Reported to Sysadmin
                        </div>
                    </div>
                {:else}
                    <!-- Analyzing / Decrypting -->
                    <div class="w-full max-w-md space-y-4">
                        <div class="text-green-500 font-bold text-lg border-b border-green-500/30 pb-2 mb-4 flex justify-between">
                            <span>SECURE DECRYPTION MODULE</span>
                            <span class="animate-pulse">RUNNING...</span>
                        </div>
                        <div class="h-48 bg-black border border-green-900/50 p-2 overflow-hidden text-xs text-green-400/80 font-mono flex flex-col justify-end">
                            {#each logBuffer as log}
                                <div>> {log}</div>
                            {/each}
                        </div>
                        <div class="w-full bg-green-900/20 h-1 mt-4 rounded-full overflow-hidden">
                            <div class="h-full bg-green-500 animate-[progress_2s_ease-in-out_infinite] w-1/3"></div>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Title Bar -->
        <div 
            class="bg-[#222] px-4 py-2 flex justify-between items-center cursor-grab active:cursor-grabbing select-none border-b border-white/5 h-10"
            onmousedown={handleMouseDown}
            role="button"
            tabindex="0"
        >
            <div class="w-16"></div>
            <div class="text-sm text-gray-500 font-bold tracking-wide uppercase opacity-80">Terminal</div>
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
            class="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent" 
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
                                        <div class="flex flex-col">
                                            <a href={link.url} target="_blank" class="text-[#729fcf] hover:underline w-fit flex items-center gap-2">
                                                {link.label} <span class="text-gray-500 text-xs">-> {link.url}</span>
                                            </a>
                                            {#if link.demoUrl}
                                                <a href={link.demoUrl} target="_blank" class="text-[#8ae234] hover:underline w-fit flex items-center gap-2 ml-4">
                                                    ↳ {link.label}_Demo <span class="text-gray-500 text-xs">-> {link.demoUrl}</span>
                                                </a>
                                            {/if}
                                        </div>
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
                    <!-- Hidden File Input for ./upload-file.sh -->
                    <input 
                        bind:this={fileInputRef}
                        type="file" 
                        class="hidden" 
                        onchange={handleFileSelect}
                        accept=".pem,.txt,.key"
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
    .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #444; border-radius: 4px; border: 2px solid #000; }
    .animate-twinkle {
        animation: twinkle 3s ease-in-out infinite;
    }
    @keyframes progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
    }
</style>
