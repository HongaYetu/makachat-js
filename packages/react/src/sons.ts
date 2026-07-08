/**
 * Sons do chat (herdados do Kanda): mensagem recebida/enviada/vista e toque
 * de chamada. Os ficheiros são publicados em dist/sons e resolvidos via
 * import.meta.url (bundlers ESM tratam o asset).
 */

export type NomeSom = 'recebida' | 'enviada' | 'vista' | 'a_chamar';

const FICHEIROS: Record<NomeSom, string> = {
    recebida: 'mensagem_recebida.mp3',
    enviada: 'mensagem_enviada.mp3',
    vista: 'mensagem_vista.mp3',
    a_chamar: 'a_chamar.mp3',
};

const cache = new Map<NomeSom, HTMLAudioElement>();

function urlDe(nome: NomeSom): string | null {
    try {
        return new URL(`../sons/${FICHEIROS[nome]}`, import.meta.url).href;
    } catch {
        return null;
    }
}

/** Efeito curto (recebida/enviada/vista). Falha em silêncio (autoplay/ambiente). */
export function tocarSom(nome: NomeSom): void {
    if (typeof Audio === 'undefined') return;

    try {
        let el = cache.get(nome);

        if (!el) {
            const url = urlDe(nome);

            if (!url) return;

            el = new Audio(url);
            el.volume = 0.6;
            cache.set(nome, el);
        }

        el.currentTime = 0;
        void el.play().catch(() => undefined);
    } catch {
        // sem áudio disponível
    }
}

let toque: HTMLAudioElement | null = null;

/** Toque de chamada em loop (a ligar / a receber). */
export function comecarToque(): void {
    if (typeof Audio === 'undefined' || toque) return;

    try {
        const url = urlDe('a_chamar');

        if (!url) return;

        toque = new Audio(url);
        toque.loop = true;
        toque.volume = 0.7;
        void toque.play().catch(() => undefined);
    } catch {
        toque = null;
    }
}

export function pararToque(): void {
    toque?.pause();
    toque = null;
}
