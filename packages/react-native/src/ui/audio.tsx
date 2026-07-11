import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { obterAudio } from '../opcionais';
import { useTema } from '../provider';
import { duracaoMmSs } from './comum';

const VELOCIDADES = [1, 1.5, 2] as const;

/** Waveform determinística a partir do URL (padrão Kanda) — 28 barras estáveis. */
function barrasDe(seed: string): number[] {
    let h = 2166136261;

    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }

    const barras: number[] = [];

    for (let i = 0; i < 28; i++) {
        h ^= h << 13;
        h ^= h >>> 17;
        h ^= h << 5;
        barras.push(6 + (Math.abs(h) % 18));
    }

    return barras;
}

/**
 * Player de mensagens de voz estilo WhatsApp: waveform, tempo, velocidade
 * 1x/1.5x/2x. Usa expo-audio (peer opcional) — sem ele mostra aviso.
 */
export function ReprodutorAudio({ url, mimha, duracaoSegundos }: { url: string; mimha: boolean; duracaoSegundos?: number | null }) {
    const tema = useTema();
    const audio = useMemo(() => obterAudio(), []);
    const corTexto = mimha ? tema.bolhaMinhaTexto : tema.texto;

    if (!audio) {
        return <Text style={{ color: corTexto, fontSize: 13 }}>🎤 Mensagem de voz (instala expo-audio para ouvir)</Text>;
    }

    return <PlayerInterno audio={audio} url={url} mimha={mimha} duracaoSegundos={duracaoSegundos} />;
}

/** Componente interno: só monta com expo-audio presente (hooks incondicionais). */
function PlayerInterno({ audio, url, mimha, duracaoSegundos }: { audio: any; url: string; mimha: boolean; duracaoSegundos?: number | null }) {
    const tema = useTema();
    const player = useRef<any>(null);
    const [aTocar, setATocar] = useState(false);
    const [posicao, setPosicao] = useState(0);
    // duração conhecida do servidor (metadados do upload) — mostra o tempo real
    // ANTES de tocar; o player refina quando reportar uma duração válida
    const [duracao, setDuracao] = useState(duracaoSegundos && duracaoSegundos > 0 ? duracaoSegundos : 0);
    const [velocidade, setVelocidade] = useState<(typeof VELOCIDADES)[number]>(1);
    const barras = useMemo(() => barrasDe(url), [url]);
    const corTexto = mimha ? tema.bolhaMinhaTexto : tema.texto;

    useEffect(
        () => () => {
            player.current?.remove?.();
            player.current = null;
        },
        [],
    );

    const alternar = async () => {
        if (!player.current) {
            await audio.setAudioModeAsync?.({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
            const p = audio.createAudioPlayer({ uri: url });
            player.current = p;
            p.addListener?.('playbackStatusUpdate', (s: { currentTime?: number; duration?: number; playing?: boolean; didJustFinish?: boolean }) => {
                setPosicao(Number.isFinite(s.currentTime) ? (s.currentTime as number) : 0);

                // o Android reporta 0/NaN por instantes — só aceitar durações válidas
                if (Number.isFinite(s.duration) && (s.duration as number) > 0) setDuracao(s.duration as number);

                if (s.didJustFinish) {
                    setATocar(false);
                    setPosicao(0);
                    p.seekTo?.(0);
                    p.pause?.();
                }
            });
            p.setPlaybackRate?.(velocidade, 'high');
            p.play();
            setATocar(true);

            return;
        }

        if (aTocar) {
            player.current.pause();
            setATocar(false);
        } else {
            player.current.play();
            setATocar(true);
        }
    };

    const mudarVelocidade = () => {
        const proxima = VELOCIDADES[(VELOCIDADES.indexOf(velocidade) + 1) % VELOCIDADES.length];
        setVelocidade(proxima);
        player.current?.setPlaybackRate?.(proxima, 'high');
    };

    const progresso = duracao > 0 ? Math.min(1, Math.max(0, posicao / duracao)) : 0;

    return (
        <View style={estilos.linha}>
            <Pressable onPress={() => void alternar()} style={[estilos.play, { backgroundColor: mimha ? 'rgba(255,255,255,0.25)' : tema.primaria }]}>
                <Ionicons name={aTocar ? 'pause' : 'play'} size={18} color={mimha ? tema.bolhaMinhaTexto : tema.primariaContraste} />
            </Pressable>
            <View style={{ flex: 1 }}>
                <View style={estilos.onda}>
                    {barras.map((altura, i) => (
                        <View
                            key={i}
                            style={{
                                width: 3,
                                height: altura,
                                borderRadius: 2,
                                backgroundColor:
                                    i / barras.length <= progresso
                                        ? mimha
                                            ? tema.bolhaMinhaTexto
                                            : tema.primaria
                                        : mimha
                                          ? 'rgba(255,255,255,0.4)'
                                          : 'rgba(100,116,139,0.35)',
                            }}
                        />
                    ))}
                </View>
                <Text style={{ fontSize: 11, color: corTexto, opacity: 0.7, marginTop: 3 }}>
                    {duracaoMmSs(Math.floor(aTocar || posicao > 0 ? posicao : duracao))}
                </Text>
            </View>
            <Pressable onPress={mudarVelocidade} style={[estilos.velocidade, { backgroundColor: mimha ? 'rgba(255,255,255,0.25)' : 'rgba(100,116,139,0.15)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: corTexto }}>{velocidade}x</Text>
            </Pressable>
        </View>
    );
}

/**
 * Gravador estilo WhatsApp (expo-audio): timer a andar, cancelar ou enviar.
 * Devolve o URI local + duração ao terminar.
 */
export function GravadorAudio({ aoTerminar, aoCancelar, padFundo }: {
    aoTerminar(uri: string, duracaoSegundos: number): void;
    aoCancelar(): void;
    /** folga inferior (insets da nav bar Android) — o gravador substitui o input e precisa da mesma */
    padFundo?: number;
}) {
    const audio = useMemo(() => obterAudio(), []);

    if (!audio?.useAudioRecorder) {
        return <GravadorErro aoCancelar={aoCancelar} texto="Instala expo-audio para gravar mensagens de voz." padFundo={padFundo} />;
    }

    return <GravadorInterno audio={audio} aoTerminar={aoTerminar} aoCancelar={aoCancelar} padFundo={padFundo} />;
}

function GravadorInterno({ audio, aoTerminar, aoCancelar, padFundo }: {
    audio: any;
    aoTerminar(uri: string, duracaoSegundos: number): void;
    aoCancelar(): void;
    padFundo?: number;
}) {
    const tema = useTema();
    // hook do expo-audio — este componente só monta quando o módulo existe
    const recorder = audio.useAudioRecorder(audio.RecordingPresets.HIGH_QUALITY);
    const inicio = useRef(Date.now());
    const pronto = useRef(false);
    const [segundos, setSegundos] = useState(0);
    const [erro, setErro] = useState(false);

    useEffect(() => {
        let cancelado = false;

        void (async () => {
            try {
                const permissao = await audio.AudioModule.requestRecordingPermissionsAsync();

                if (!permissao.granted) throw new Error('sem permissão');

                await audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

                if (cancelado) return;

                await recorder.prepareToRecordAsync();
                recorder.record();
                pronto.current = true;
                inicio.current = Date.now();
            } catch {
                if (!cancelado) setErro(true);
            }
        })();

        const timer = setInterval(() => setSegundos(Math.floor((Date.now() - inicio.current) / 1000)), 500);

        return () => {
            cancelado = true;
            clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const parar = async (enviar: boolean) => {
        if (!pronto.current) {
            aoCancelar();

            return;
        }

        pronto.current = false;
        await recorder.stop().catch(() => undefined);
        await audio.setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

        const uri: string | null = recorder.uri ?? null;

        if (enviar && uri && segundos >= 1) aoTerminar(uri, Math.max(1, segundos));
        else aoCancelar();
    };

    if (erro) {
        return <GravadorErro aoCancelar={aoCancelar} texto="Sem acesso ao microfone." padFundo={padFundo} />;
    }

    return (
        <View style={[estilos.gravador, { backgroundColor: tema.superficie, paddingBottom: Math.max(padFundo ?? 0, 8) }]}>
            <View style={estilos.pontoVermelho} />
            <Text style={{ fontVariant: ['tabular-nums'], fontSize: 15, color: tema.texto, fontWeight: '600' }}>
                {duracaoMmSs(segundos)}
            </Text>
            <Text style={{ flex: 1, textAlign: 'center', color: tema.textoSuave, fontSize: 13 }}>A gravar…</Text>
            <Pressable onPress={() => void parar(false)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
            </Pressable>
            <Pressable onPress={() => void parar(true)} style={[estilos.enviarGravacao, { backgroundColor: tema.primaria }]}>
                <Ionicons name="send" size={19} color={tema.primariaContraste} />
            </Pressable>
        </View>
    );
}

function GravadorErro({ texto, aoCancelar, padFundo }: { texto: string; aoCancelar(): void; padFundo?: number }) {
    const tema = useTema();

    return (
        <View style={[estilos.gravador, { backgroundColor: tema.superficie, paddingBottom: Math.max(padFundo ?? 0, 8) }]}>
            <Text style={{ flex: 1, color: '#ef4444', fontSize: 13 }}>{texto}</Text>
            <Pressable onPress={aoCancelar}>
                <Ionicons name="close-circle" size={26} color={tema.textoSuave} />
            </Pressable>
        </View>
    );
}

const estilos = StyleSheet.create({
    linha: { flexDirection: 'row', alignItems: 'center', gap: 9, width: 230, paddingVertical: 2 },
    play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    onda: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 26 },
    velocidade: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
    gravador: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
    pontoVermelho: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
    enviarGravacao: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
