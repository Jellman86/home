// Minimal shims so `svelte-check` can typecheck config files without requiring `@types/node`.
// Keep this small and expand only as needed.
declare module 'child_process' {
  export function execSync(command: string, options?: any): any;
  export function execFileSync(file: string, args?: readonly string[], options?: any): any;
}

declare const process: {
  env: Record<string, string | undefined>;
};
