/**
 * Timers do runtime RN/Hermes — a lib ES2022 (sem DOM) não os declara.
 */
declare function setTimeout(handler: (...args: unknown[]) => void, timeout?: number): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(handler: (...args: unknown[]) => void, timeout?: number): number;
declare function clearInterval(id: number | undefined): void;

/** fetch global do RN (whatwg-fetch) — tipagem mínima para compilar. */
declare function fetch(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ json(): Promise<any> }>;
