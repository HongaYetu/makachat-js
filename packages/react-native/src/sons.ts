import { obterAudio } from './opcionais';

/**
 * Sons do chat (herdados do Kanda) via expo-audio (peer opcional — sem ele,
 * silêncio). Os mp3 são copiados para dist pelo build (loader copy) e o
 * Metro empacota-os como assets.
 */

export type NomeSom = 'recebida' | 'enviada' | 'vista' | 'a_chamar' | 'toque_receber';

/** a_chamar = ringback de QUEM LIGA; toque_receber = ring de quem recebe. */
export type TipoToque = 'ligar' | 'receber';

/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: (m: string) => unknown;

const FONTES: Record<NomeSom, unknown> = {
    recebida: require('../sons/mensagem_recebida.mp3'),
    enviada: require('../sons/mensagem_enviada.mp3'),
    vista: require('../sons/mensagem_vista.mp3'),
    a_chamar: require('../sons/a_chamar.mp3'),
    toque_receber: require('../sons/toque_receber.mp3'),
};

const cache = new Map<NomeSom, { seekTo(s: number): void; play(): void }>();

/** Efeito curto (recebida/enviada/vista). Falha em silêncio. */
export function tocarSom(nome: NomeSom): void {
    const audio = obterAudio();

    if (!audio?.createAudioPlayer) return;

    try {
        let p = cache.get(nome);

        if (!p) {
            p = audio.createAudioPlayer(FONTES[nome]);
            cache.set(nome, p as never);
        }

        (p as { seekTo(s: number): void }).seekTo?.(0);
        (p as { play(): void }).play();
    } catch {
        // sem áudio disponível
    }
}

let toque: { play(): void; pause(): void; remove?(): void; loop?: boolean } | null = null;

/** Toque de chamada em loop — 'ligar' (ringback de quem liga) ou 'receber' (ring). */
export function comecarToque(tipo: TipoToque = 'ligar'): void {
    const audio = obterAudio();

    if (!audio?.createAudioPlayer || toque) return;

    try {
        toque = audio.createAudioPlayer(tipo === 'receber' ? FONTES.toque_receber : FONTES.a_chamar);
        (toque as { loop?: boolean }).loop = true;
        toque!.play();
    } catch {
        toque = null;
    }
}

export function pararToque(): void {
    try {
        toque?.pause();
        toque?.remove?.();
    } catch {
        // já removido
    }

    toque = null;
}
