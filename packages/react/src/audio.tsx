import { Icon } from '@iconify/react';
import React, { useEffect, useRef, useState } from 'react';

const VELOCIDADES = [1, 1.5, 2] as const;

/** RMS de voz confortável (~-18 dBFS) — alvo da normalização. */
const GANHO_ALVO = 0.12;
/** cache do gain calculado por URL — re-tocar/re-montar não re-decodifica */
const ganhosCalculados = new Map<string, number | null>();

/**
 * Gain calculado da própria gravação: mediana do RMS (janelas de ~50ms, sem
 * silêncio) → alvo/mediana, limitado a [1, 4]. null = usa o gain por omissão
 * (CORS/decode falhou ou gravação toda em silêncio).
 */
async function calcularGanho(url: string): Promise<number | null> {
    if (ganhosCalculados.has(url)) return ganhosCalculados.get(url) ?? null;

    let ganho: number | null = null;

    try {
        const dados = await (await fetch(url, { mode: 'cors' })).arrayBuffer();
        // OfflineAudioContext: só para decodificar — não toca nem pede gesto
        const ctx = new OfflineAudioContext(1, 1, 44100);
        const buffer = await ctx.decodeAudioData(dados);
        const canal = buffer.getChannelData(0);
        const janela = Math.floor(buffer.sampleRate * 0.05);
        const ativas: number[] = [];

        for (let i = 0; i + janela <= canal.length; i += janela) {
            let soma = 0;

            for (let j = i; j < i + janela; j++) soma += canal[j] * canal[j];

            const rms = Math.sqrt(soma / janela);

            if (rms > 0.005) ativas.push(rms);
        }

        if (ativas.length) {
            ativas.sort((a, b) => a - b);
            const mediana = ativas[Math.floor(ativas.length / 2)];
            ganho = Math.min(4, Math.max(1, GANHO_ALVO / mediana));
        }
    } catch {
        ganho = null;
    }

    ganhosCalculados.set(url, ganho);

    return ganho;
}

/**
 * Reprodutor de áudio customizado: play/pause, progresso clicável, velocidade
 * 1x/1.5x/2x e ganho CALCULADO da gravação (Web Audio: gain normaliza para o
 * alvo de voz + compressor como limitador de segurança).
 */
export function ReprodutorAudio({ url }: { url: string }) {
    const audio = useRef<HTMLAudioElement | null>(null);
    const grafo = useRef<{ ctx: AudioContext; ganho: GainNode } | null>(null);
    const [aTocar, setATocar] = useState(false);
    const [progresso, setProgresso] = useState(0);
    const [duracao, setDuracao] = useState(0);
    const [velocidade, setVelocidade] = useState<(typeof VELOCIDADES)[number]>(1);

    useEffect(() => {
        const el = new Audio(url);
        el.preload = 'metadata';
        el.crossOrigin = 'anonymous';
        audio.current = el;

        const aoTempo = () => setProgresso(el.currentTime);
        const aoDuracao = () => Number.isFinite(el.duration) && setDuracao(el.duration);
        const aoFim = () => setATocar(false);

        el.addEventListener('timeupdate', aoTempo);
        el.addEventListener('loadedmetadata', aoDuracao);
        el.addEventListener('durationchange', aoDuracao);
        el.addEventListener('ended', aoFim);

        return () => {
            el.pause();
            el.removeEventListener('timeupdate', aoTempo);
            el.removeEventListener('loadedmetadata', aoDuracao);
            el.removeEventListener('durationchange', aoDuracao);
            el.removeEventListener('ended', aoFim);
            void grafo.current?.ctx.close().catch(() => undefined);
        };
    }, [url]);

    /** Ganho automático ligado na primeira reprodução: arranca com um boost
     *  por omissão (o play não espera) e refina para o gain CALCULADO da
     *  gravação assim que o decode termina. */
    const ligarGanho = () => {
        const el = audio.current;

        if (!el || grafo.current || typeof AudioContext === 'undefined') return;

        try {
            const ctx = new AudioContext();
            const fonte = ctx.createMediaElementSource(el);
            const ganho = ctx.createGain();
            ganho.gain.value = 1.8;
            // gain ANTES do compressor — o compressor é o limitador que segura
            // os picos dos boosts altos (ao contrário clipava)
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -40;
            compressor.knee.value = 30;
            compressor.ratio.value = 8;

            fonte.connect(ganho).connect(compressor).connect(ctx.destination);
            grafo.current = { ctx, ganho };

            void calcularGanho(url).then((calculado) => {
                if (calculado && grafo.current) grafo.current.ganho.gain.value = calculado;
            });
        } catch {
            // CORS sem cabeçalhos → toca sem normalização
        }
    };

    const alternar = () => {
        const el = audio.current;

        if (!el) return;

        if (aTocar) {
            el.pause();
            setATocar(false);
        } else {
            ligarGanho();
            void grafo.current?.ctx.resume();
            el.playbackRate = velocidade;
            void el.play();
            setATocar(true);
        }
    };

    const mudarVelocidade = () => {
        const proxima = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
        setVelocidade(proxima);

        if (audio.current) audio.current.playbackRate = proxima;
    };

    const saltar = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = audio.current;

        if (!el || !duracao) return;

        const alvo = e.currentTarget.getBoundingClientRect();
        el.currentTime = ((e.clientX - alvo.left) / alvo.width) * duracao;
    };

    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const pct = duracao ? (progresso / duracao) * 100 : 0;

    return (
        <div className="flex w-[240px] items-center gap-2 py-1">
            <button
                onClick={alternar}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-black/15 text-inherit transition-transform hover:scale-105"
            >
                <Icon icon={aTocar ? 'tabler:player-pause-filled' : 'tabler:player-play-filled'} className="text-lg" />
            </button>
            <div className="min-w-0 flex-1">
                <div className="h-1.5 w-full cursor-pointer rounded-full bg-black/15" onClick={saltar}>
                    <div className="h-full rounded-full bg-current transition-[width]" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-[10px] opacity-70">
                    {fmt(progresso)}{duracao ? ` / ${fmt(duracao)}` : ''}
                </div>
            </div>
            <button
                onClick={mudarVelocidade}
                className="shrink-0 cursor-pointer rounded-full border-0 bg-black/15 px-2 py-0.5 text-[11px] font-bold text-inherit"
            >
                {velocidade}x
            </button>
        </div>
    );
}
