/**
 * UUID v4 sem depender de crypto.randomUUID (indisponível em alguns runtimes
 * React Native). Usa getRandomValues quando existe; caso contrário Math.random
 * (suficiente para refs de idempotência de cliente).
 */
interface CriptoDisponivel {
    randomUUID?: () => string;
    getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export function uuid(): string {
    const cripto = (globalThis as { crypto?: CriptoDisponivel }).crypto;

    if (cripto?.randomUUID) {
        return cripto.randomUUID();
    }

    const bytes = new Uint8Array(16);

    if (cripto?.getRandomValues) {
        cripto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return formatar(bytes);
}

/**
 * UUID v7 (mesmo formato do hub): 48 bits de timestamp em ms + versão 7 +
 * aleatório. Ordenável lexicograficamente no tempo — o id otimista local ordena
 * corretamente entre os ids v7 do servidor, em vez de ficar preso no fim.
 */
export function uuidv7(): string {
    const cripto = (globalThis as { crypto?: CriptoDisponivel }).crypto;
    const bytes = new Uint8Array(16);

    if (cripto?.getRandomValues) {
        cripto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    // 48 bits de timestamp (big-endian) nos primeiros 6 bytes
    const ms = Date.now();
    bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
    bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
    bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
    bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
    bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
    bytes[5] = ms & 0xff;

    bytes[6] = (bytes[6] & 0x0f) | 0x70; // versão 7
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante

    return formatar(bytes);
}

function formatar(bytes: Uint8Array): string {
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
