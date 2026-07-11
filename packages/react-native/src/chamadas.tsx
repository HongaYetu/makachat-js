import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chamada, Conversa, EventoChamada } from '@hongayetu/makachat-core';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { obterLiveKit, obterLiveKitClient, obterNotifee, obterPushMakaChat } from './opcionais';
import { useFuncionalidadeAtiva } from './hooks';
import { useMakaChat, useTema } from './provider';
import { comecarToque, pararToque } from './sons';
import { Avatar, duracaoMmSs, Pulso } from './ui/comum';

interface EstadoChamada {
    chamada: Chamada;
    fase: 'a_receber' | 'a_ligar' | 'em_curso' | 'falhada';
    iniciador?: { nome: string; foto_url: string | null };
}

interface Tile {
    chave: string;
    local: boolean;
    nome: string;
    trackRef: unknown | null;
    /** largura/altura real do vídeo — dimensiona o PiP sem crop nem esticar */
    proporcao: number | null;
    /** remoto com câmara publicada mas MUTADA (em background/desligada) —
     *  mostramos "Câmara em pausa" em vez do último frame congelado */
    pausado?: boolean;
}

export interface ChamadasApi {
    iniciar(conversaId: string, tipo: 'audio' | 'video'): Promise<void>;
    entrar(chamadaId: string, tipo: 'audio' | 'video'): Promise<void>;
    /** retoma uma chamada vinda de push com a app fechada (atender/rejeitar/tocar) */
    retomarPendente(): Promise<void>;
    ativa: EstadoChamada | null;
    /** false quando a app não instalou @livekit/react-native */
    suportado: boolean;
}

const Ctx = createContext<ChamadasApi | null>(null);

export function useChamadas(): ChamadasApi {
    const ctx = useContext(Ctx);

    if (!ctx) throw new Error('useChamadas requer <ChamadasProvider>');

    return ctx;
}

export function useChamadasOpcional(): ChamadasApi | null {
    return useContext(Ctx);
}

let globalsRegistados = false;

/** Foreground service Android: mantém o áudio da chamada vivo em background. */
async function iniciarServicoChamada(titulo: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    // com o serviço NATIVO de chamada ativa ligado (config plugin), a
    // notificação CallStyle com avatar+cronómetro cobre isto — sem duplicar
    try {
        if (obterPushMakaChat()?.configChamadas?.()?.servicoChamadaAtiva) return;
    } catch {
        // módulo antigo — segue para o fallback notifee
    }

    const notifee = obterNotifee();

    if (!notifee?.displayNotification) return;

    try {
        await notifee.createChannel({ id: 'makachat_chamada_ativa', name: 'Chamada em curso', importance: 3 });
        await notifee.displayNotification({
            id: 'makachat_chamada_ativa',
            title: 'Chamada em curso',
            body: titulo,
            android: {
                channelId: 'makachat_chamada_ativa',
                asForegroundService: true,
                ongoing: true,
                smallIcon: 'ic_launcher',
                pressAction: { id: 'default' },
            },
        });
    } catch {
        // sem serviço registado na app — a chamada funciona, só não sobrevive tanto em background
    }
}

async function pararServicoChamada(): Promise<void> {
    if (Platform.OS !== 'android') return;

    const notifee = obterNotifee();

    await notifee?.stopForegroundService?.().catch?.(() => undefined);
    await notifee?.cancelNotification?.('makachat_chamada_ativa').catch?.(() => undefined);
}

/**
 * Chamadas LiveKit no mobile (padrão EiConnect): registerGlobals à primeira
 * utilização, AudioSession communication, Room adaptiveStream/dynacast com
 * reconexão progressiva (90s), câmara pausa em background. Mesmas regras da
 * web: sem permissões a chamada não avança; falha → "Chamada falhada".
 */
export function ChamadasProvider({ children }: { children: React.ReactNode }) {
    const { api, engine, subscreverChamadas } = useMakaChat();
    const tema = useTema();
    const livekit = useMemo(() => obterLiveKit(), []);
    const lkClient = useMemo(() => obterLiveKitClient(), []);
    const suportado = !!livekit && !!lkClient;
    const podePartilhaEcra = useFuncionalidadeAtiva('chamadas.partilha_ecra');

    const [ativa, setAtiva] = useState<EstadoChamada | null>(null);
    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [inicioEm, setInicioEm] = useState<number | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [mudo, setMudo] = useState(false);
    const [camara, setCamara] = useState(false);
    const [altifalante, setAltifalante] = useState(true);
    const [ecra, setEcra] = useState(false);
    const [minimizada, setMinimizada] = useState(false);

    const room = useRef<any>(null);
    const falhada = useRef(false);
    const faseRef = useRef<EstadoChamada['fase'] | null>(null);
    const facing = useRef<'user' | 'environment'>('user');
    // 1:1: se o outro desaparecer (rede/app morta) sem desligar, terminamos após
    // um período de graça (dá tempo à reconexão do LiveKit)
    const conversaRef = useRef<Conversa | null>(null);
    const desligarRef = useRef<() => Promise<void>>(async () => undefined);
    const sozinhoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chamadaIdRef = useRef<string | null>(null);
    /** id da chamada que EU estou a atender AGORA — o push 'parar' do próprio
     *  atender (pararToque a todos) não pode matar a chamada a meio do connect */
    const atendendoRef = useRef<string | null>(null);
    /** lock: mount + AppState 'active' podem disparar retomarPendente quase juntos */
    const retomandoRef = useRef(false);

    useEffect(() => {
        chamadaIdRef.current = ativa?.chamada.id ?? null;
    }, [ativa]);

    useEffect(() => {
        faseRef.current = ativa?.fase ?? null;

        // toque em loop enquanto liga/recebe; para ao entrar em curso ou fechar
        if (ativa?.fase === 'a_ligar') comecarToque('ligar');
        else if (ativa?.fase === 'a_receber') comecarToque('receber');
        else pararToque();

        return pararToque;
    }, [ativa?.fase]);

    // serviço nativo da chamada em curso (opt-in do config plugin): mantém
    // mic/LiveKit vivos em background + notificação persistente com cronómetro
    useEffect(() => {
        const push = obterPushMakaChat();

        if (!push?.configChamadas) return;

        try {
            if (!push.configChamadas()?.servicoChamadaAtiva) return;

            if (ativa?.fase === 'em_curso') {
                const nome = ativa.iniciador?.nome ?? conversa?.titulo ?? 'Chamada';
                const foto = ativa.iniciador?.foto_url ?? conversa?.foto_url ?? null;

                push.iniciarChamadaAtiva({ nome, foto, tipo: ativa.chamada.tipo });
            } else {
                push.pararChamadaAtiva();
            }
        } catch {
            // versão antiga do módulo sem estas funções
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ativa?.fase]);

    const limpar = useCallback(() => {
        if (sozinhoTimer.current) {
            clearTimeout(sozinhoTimer.current);
            sozinhoTimer.current = null;
        }

        void room.current?.disconnect?.();
        room.current = null;
        falhada.current = false;
        atendendoRef.current = null;

        if (livekit?.AudioSession) void livekit.AudioSession.stopAudioSession?.();

        setAtiva(null);
        setConversa(null);
        setTiles([]);
        setInicioEm(null);
        setErro(null);
        setMudo(false);
        setCamara(false);
        setEcra(false);
        setMinimizada(false);
        void pararServicoChamada();
    }, [livekit]);

    const comecarTimer = useCallback(() => {
        setInicioEm((atual) => atual ?? Date.now());
        void iniciarServicoChamada(conversa?.titulo ?? 'MakaChat');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversa?.titulo]);

    // título/avatar do ecrã de chamada mesmo sem a conversa no storage local
    // (ligar a partir de fora do chat, ex.: detalhe da encomenda)
    const carregarConversa = useCallback(
        async (conversaId: string) => {
            const local = await engine.storage.obterConversa(conversaId);
            setConversa(local); // null limpa a anterior enquanto o servidor responde

            if (local) return;

            const remota = await api.obterConversa(conversaId).catch(() => null);

            if (remota?.conversa) setConversa(remota.conversa);
        },
        [engine, api],
    );

    const sincronizarTiles = useCallback(() => {
        const r = room.current;

        if (!r || !lkClient) return;

        const Track = lkClient.Track;
        const novos: Tile[] = [];

        // proporção real (largura/altura) do vídeo publicado — dimensions do
        // LiveKit ou, para o local antes do ack, os settings do próprio track
        const proporcaoDe = (pub: any): number | null => {
            const dim = pub?.dimensions ?? pub?.track?.mediaStreamTrack?.getSettings?.();

            return dim?.width && dim?.height ? dim.width / dim.height : null;
        };

        const localCam = r.localParticipant?.getTrackPublication?.(Track.Source.Camera);
        novos.push({
            chave: 'local',
            local: true,
            nome: 'Tu',
            trackRef: localCam?.track
                ? { participant: r.localParticipant, publication: localCam, source: Track.Source.Camera }
                : null,
            proporcao: proporcaoDe(localCam),
        });

        for (const participante of r.remoteParticipants?.values?.() ?? []) {
            const cam = participante.getTrackPublication?.(Track.Source.Camera);
            const ecra = participante.getTrackPublication?.(Track.Source.ScreenShare);
            // um vídeo por participante: ecrã > câmara; track MUTADO não conta —
            // renderizá-lo mostraria o último frame congelado (câmara pausada
            // em background no telefone do outro lado)
            const ecraVivo = ecra?.isSubscribed && ecra.track && !ecra.isMuted ? ecra : null;
            const camViva = cam?.track && !cam.isMuted ? cam : null;
            const pub = ecraVivo ?? camViva;
            novos.push({
                chave: participante.identity,
                local: false,
                nome: participante.name || 'Participante',
                trackRef: pub
                    ? { participant: participante, publication: pub, source: pub === ecraVivo ? Track.Source.ScreenShare : Track.Source.Camera }
                    : null,
                proporcao: proporcaoDe(pub),
                pausado: !pub && !!cam?.track && !!cam.isMuted,
            });
        }

        setTiles(novos);
    }, [lkClient]);

    const ligarSala = useCallback(
        async (token: string, wsUrl: string, video: boolean): Promise<boolean> => {
            if (!suportado) {
                setErro('Chamadas indisponíveis — a app não inclui o módulo LiveKit.');

                return false;
            }

            if (!globalsRegistados) {
                livekit.registerGlobals();
                globalsRegistados = true;
            }

            await livekit.AudioSession.configureAudio?.({
                android: { audioTypeOptions: livekit.AndroidAudioTypePresets?.communication },
            }).catch(() => undefined);
            await livekit.AudioSession.startAudioSession?.().catch(() => undefined);

            const r = new lkClient.Room({
                adaptiveStream: true,
                dynacast: true,
                reconnectPolicy: {
                    nextRetryDelayInMs: (contexto: { elapsedMs: number; retryCount: number }) =>
                        contexto.elapsedMs > 90_000 ? null : Math.min(500 * 2 ** contexto.retryCount, 10_000),
                },
            });
            room.current = r;

            const RoomEvent = lkClient.RoomEvent;
            r.on(RoomEvent.TrackSubscribed, sincronizarTiles);
            r.on(RoomEvent.TrackUnsubscribed, sincronizarTiles);
            r.on(RoomEvent.LocalTrackPublished, sincronizarTiles);
            r.on(RoomEvent.LocalTrackUnpublished, sincronizarTiles);
            // mute/unmute não (des)publica — refresca proporção/trackRef na mesma
            r.on(RoomEvent.TrackMuted, sincronizarTiles);
            r.on(RoomEvent.TrackUnmuted, sincronizarTiles);
            r.on(RoomEvent.ParticipantConnected, sincronizarTiles);
            r.on(RoomEvent.ParticipantDisconnected, sincronizarTiles);

            // 1:1: ficar SOZINHO em curso = o outro desapareceu (app morta/rede) —
            // termina após 15s de graça (a reconexão do LiveKit cancela o timer)
            const verificarSozinho = () => {
                if (conversaRef.current?.tipo === 'grupo' || faseRef.current !== 'em_curso') return;

                const remotosLigados = r.remoteParticipants?.size ?? r.participants?.size ?? 0;

                if (remotosLigados === 0) {
                    if (!sozinhoTimer.current) {
                        sozinhoTimer.current = setTimeout(() => {
                            sozinhoTimer.current = null;

                            if (faseRef.current === 'em_curso') void desligarRef.current();
                        }, 15_000);
                    }
                } else if (sozinhoTimer.current) {
                    clearTimeout(sozinhoTimer.current);
                    sozinhoTimer.current = null;
                }
            };

            r.on(RoomEvent.ParticipantConnected, verificarSozinho);
            r.on(RoomEvent.ParticipantDisconnected, verificarSozinho);

            try {
                await r.connect(wsUrl, token);
            } catch (e) {
                console.error('[makachat] ligação LiveKit falhou:', e);
                setErro('Não foi possível ligar ao servidor de chamadas.');

                return false;
            }

            try {
                await r.localParticipant.setMicrophoneEnabled(true);

                if (video) {
                    await r.localParticipant.setCameraEnabled(true);
                    setCamara(true);
                }
            } catch (e) {
                console.error('[makachat] media falhou:', e);
                setErro(video ? 'Sem acesso à câmara/microfone — verifica as permissões.' : 'Sem acesso ao microfone — verifica as permissões.');

                return false;
            }

            sincronizarTiles();
            // cobre entrar JÁ sozinho (o outro saiu antes de ligarmos): sem isto o
            // timer só armava em ParticipantConnected/Disconnected e ficava pendurado
            verificarSozinho();

            return true;
        },
        [suportado, livekit, lkClient, sincronizarTiles],
    );

    // câmara pausa em background, micro continua (padrão EiConnect/WhatsApp)
    useEffect(() => {
        const sub = AppState.addEventListener('change', (estado) => {
            const r = room.current;

            if (!r || !lkClient) return;

            if (estado !== 'active' && camara) {
                void r.localParticipant?.setCameraEnabled?.(false);
            } else if (estado === 'active' && camara) {
                void r.localParticipant?.setCameraEnabled?.(true);
            }
        });

        return () => sub.remove();
    }, [camara, lkClient]);

    // eventos do servidor
    useEffect(
        () =>
            subscreverChamadas((evento: EventoChamada) => {
                if (evento.evento === 'iniciada') {
                    // o push chegou primeiro (esqueleto): enriquece SEM regredir a fase
                    if (chamadaIdRef.current === evento.chamada.id) {
                        setAtiva((a) => (a?.fase === 'a_receber' ? { ...a, chamada: evento.chamada, iniciador: evento.iniciador } : a));

                        return;
                    }

                    // eco da PRÓPRIA chamada (outra sessão/dispositivo desta identidade)
                    // nunca vira UI de receção nem toque
                    void engine.minhaIdentidadeId(evento.chamada.conversa_id).then((minha) => {
                        if (minha && evento.chamada.iniciador_identidade_id === minha) return;

                        setAtiva({ chamada: evento.chamada, fase: 'a_receber', iniciador: evento.iniciador });
                        void carregarConversa(evento.chamada.conversa_id);
                    });
                } else if (evento.evento === 'atendida') {
                    if (faseRef.current === 'a_ligar' || faseRef.current === 'em_curso') {
                        setAtiva((a) => (a ? { ...a, fase: 'em_curso', chamada: evento.chamada } : a));
                        comecarTimer();
                    }
                } else if (evento.evento === 'participante_saiu') {
                    // chamada continua para os restantes
                } else if (!falhada.current) {
                    limpar();
                }
            }),
        [subscreverChamadas, engine, limpar, comecarTimer, carregarConversa],
    );

    const falhar = useCallback(
        async (chamadaId: string) => {
            falhada.current = true;
            await api.terminarChamada(chamadaId).catch(() => undefined);
            setAtiva((a) => (a ? { ...a, fase: 'falhada' } : a));
        },
        [api],
    );

    const iniciar = useCallback(
        async (conversaId: string, tipo: 'audio' | 'video') => {
            if (!suportado) return;

            const r = await api.iniciarChamada(conversaId, tipo);
            setAtiva({ chamada: r.chamada, fase: 'a_ligar' });
            void carregarConversa(conversaId);

            if (r.livekit_token && r.ws_url) {
                const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === 'video');

                if (!ok) await falhar(r.chamada.id);
            }
        },
        [suportado, api, ligarSala, falhar, carregarConversa],
    );

    const entrar = useCallback(
        async (chamadaId: string, tipo: 'audio' | 'video') => {
            if (!suportado) return;

            atendendoRef.current = chamadaId;
            const r = await api.atenderChamada(chamadaId);
            setAtiva({ chamada: r.chamada, fase: 'em_curso' });
            void carregarConversa(r.chamada.conversa_id);

            if (r.livekit_token && r.ws_url) {
                const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === 'video');

                // a chamada foi limpa/terminada durante o connect — não ressuscitar
                if (atendendoRef.current !== chamadaId) {
                    void room.current?.disconnect?.();
                    room.current = null;

                    return;
                }

                if (!ok) {
                    await falhar(chamadaId);

                    return;
                }
            }

            comecarTimer();
        },
        [suportado, api, ligarSala, falhar, comecarTimer, carregarConversa],
    );

    // ringing em-app com esqueleto local (arranque frio ou push em foreground);
    // o evento `iniciada` do socket enriquece depois com o iniciador
    const tocarEmApp = useCallback(
        async (chamadaId: string, chamadaTipo: 'audio' | 'video', conversaId: string) => {
            // já está a tocar/em curso (o socket chegou primeiro) — não sobrepor
            if (chamadaIdRef.current === chamadaId) return;

            void carregarConversa(conversaId);
            setAtiva({
                chamada: {
                    id: chamadaId,
                    conversa_id: conversaId,
                    iniciador_identidade_id: '',
                    tipo: chamadaTipo,
                    estado: 'a_tocar',
                    iniciada_em: new Date().toISOString(),
                    atendida_em: null,
                    terminada_em: null,
                    duracao_segundos: null,
                },
                fase: 'a_receber',
            });
        },
        [carregarConversa],
    );

    const retomarPendente = useCallback(async () => {
        const push = obterPushMakaChat();

        if (!push?.obterChamadaPendente || retomandoRef.current) return;

        retomandoRef.current = true;

        try {
            const pendente = await push.obterChamadaPendente().catch(() => null);

            if (!pendente) return;

            push.cancelarNotificacaoChamada?.(pendente.chamada_id);

            if (pendente.acao === 'rejeitar') {
                await api.rejeitarChamada(pendente.chamada_id).catch(() => undefined);

                return;
            }

            if (pendente.acao === 'atender') {
                await entrar(pendente.chamada_id, pendente.chamada_tipo).catch(() => undefined);

                return;
            }

            // 'tocar': mostra o ringing normal com os dados que temos
            await tocarEmApp(pendente.chamada_id, pendente.chamada_tipo, pendente.conversa_id);
        } finally {
            retomandoRef.current = false;
        }
    }, [api, entrar, tocarEmApp]);

    // app aberta por uma notificação de chamada (arranque frio ou background)
    useEffect(() => {
        void retomarPendente();

        const sub = AppState.addEventListener('change', (estado) => {
            if (estado === 'active') void retomarPendente();
        });

        return () => sub.remove();
    }, [retomarPendente]);

    // push de chamada com a app em FOREGROUND (Android): o nativo só emite este
    // evento com a app visível e este handler marcado como pronto — em qualquer
    // outro estado apresenta ele próprio a notificação CallStyle completa
    useEffect(() => {
        const push = obterPushMakaChat();

        if (!push?.aoChamadaPush) return;

        const sub = push.aoChamadaPush((chamada: { acao: string; chamada_id: string; chamada_tipo: 'audio' | 'video'; conversa_id: string; chave_servico: string; titulo?: string; foto?: string }) => {
            if (chamada.acao === 'parar') {
                // sou EU a atender (o pararToque do atender vai a todos, incluindo
                // este dispositivo) — nunca matar a chamada a meio do connect
                if (atendendoRef.current === chamada.chamada_id) return;

                // atenderam/terminou noutro lado — cala o ringing em-app
                if (chamadaIdRef.current === chamada.chamada_id && faseRef.current === 'a_receber') limpar();

                return;
            }

            if (chamada.acao !== 'tocar') return;

            // o socket chegou primeiro — já está a tocar
            if (chamadaIdRef.current === chamada.chamada_id) return;

            // defensivo: se alguma apresentação nativa ficou de uma corrida
            // (serviço de toque incluído), morre antes do toque em-app começar
            push.cancelarNotificacaoChamada?.(chamada.chamada_id);
            void tocarEmApp(chamada.chamada_id, chamada.chamada_tipo, chamada.conversa_id);
        });

        push.ouvinteChamadasPronto?.(true);

        return () => {
            push.ouvinteChamadasPronto?.(false);
            sub.remove();
        };
    }, [limpar, tocarEmApp]);

    const atender = async () => {
        if (!ativa) return;

        const r = await api.atenderChamada(ativa.chamada.id);

        if (r.livekit_token && r.ws_url) {
            const ok = await ligarSala(r.livekit_token, r.ws_url, ativa.chamada.tipo === 'video');

            if (!ok) {
                await falhar(ativa.chamada.id);

                return;
            }
        }

        setAtiva({ ...ativa, fase: 'em_curso', chamada: r.chamada });
        comecarTimer();
    };

    const desligar = async () => {
        if (ativa && ativa.fase !== 'falhada') {
            await (ativa.fase === 'a_receber'
                ? api.rejeitarChamada(ativa.chamada.id)
                : api.terminarChamada(ativa.chamada.id)
            ).catch(() => undefined);
        }

        limpar();
    };

    // refs sempre atuais para os handlers da sala (registados uma vez no connect)
    conversaRef.current = conversa;
    desligarRef.current = desligar;

    const alternarCamara = async () => {
        const novo = !camara;

        // no telemóvel câmara e partilha de ecrã são exclusivas: partilhar
        // implica sair da app e a câmara pausa em background (frame congelado)
        if (novo && ecra) {
            setEcra(false);
            await room.current?.localParticipant?.setScreenShareEnabled?.(false).catch?.(() => undefined);
        }

        setCamara(novo);
        await room.current?.localParticipant?.setCameraEnabled?.(novo).catch(() => undefined);
    };

    const trocarCamara = async () => {
        const Track = lkClient?.Track;
        const pub = room.current?.localParticipant?.getTrackPublication?.(Track?.Source?.Camera);
        const track = pub?.track;

        if (!track?.restartTrack) return;

        facing.current = facing.current === 'user' ? 'environment' : 'user';
        await track.restartTrack({ facingMode: facing.current }).catch(() => undefined);
    };

    const alternarEcra = async () => {
        const novo = !ecra;

        // exclusivo com a câmara (ver alternarCamara)
        if (novo && camara) {
            setCamara(false);
            await room.current?.localParticipant?.setCameraEnabled?.(false).catch(() => undefined);
        }

        setEcra(novo);
        await room.current?.localParticipant?.setScreenShareEnabled?.(novo).catch?.(() => {
            setEcra(!novo);
        });
    };

    const alternarAltifalante = async () => {
        const novo = !altifalante;
        setAltifalante(novo);
        await livekit?.AudioSession?.selectAudioOutput?.(novo ? 'speaker' : 'earpiece').catch(() => undefined);
    };

    const valor = useMemo<ChamadasApi>(
        () => ({ iniciar, entrar, retomarPendente, ativa, suportado }),
        [iniciar, entrar, retomarPendente, ativa, suportado],
    );

    return (
        <Ctx.Provider value={valor}>
            {children}
            {ativa && !minimizada && (
                <EcraChamada
                    ativa={ativa}
                    conversa={conversa}
                    tiles={tiles}
                    inicioEm={inicioEm}
                    erro={erro}
                    mudo={mudo}
                    camara={camara}
                    altifalante={altifalante}
                    ecra={ecra}
                    livekit={livekit}
                    aoAtender={() => void atender()}
                    aoDesligar={() => void desligar()}
                    aoMudo={() => {
                        const m = !mudo;
                        setMudo(m);
                        void room.current?.localParticipant?.setMicrophoneEnabled?.(!m).catch(() => undefined);
                    }}
                    aoCamara={() => void alternarCamara()}
                    aoTrocarCamara={() => void trocarCamara()}
                    aoAltifalante={() => void alternarAltifalante()}
                    aoEcra={Platform.OS === 'android' && podePartilhaEcra ? () => void alternarEcra() : undefined}
                    aoMinimizar={() => setMinimizada(true)}
                    tema={tema}
                />
            )}
            {ativa && minimizada && (
                <Pressable onPress={() => setMinimizada(false)} style={estilos.pill}>
                    <Avatar nome={conversa?.titulo ?? '?'} url={conversa?.foto_url} tamanho={28} />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {ativa.fase === 'em_curso' && inicioEm ? <Duracao desde={inicioEm} /> : 'Chamada…'}
                    </Text>
                    <Ionicons name="expand-outline" size={16} color="rgba(255,255,255,0.8)" />
                </Pressable>
            )}
        </Ctx.Provider>
    );
}

// ---------------------------------------------------------------- ecrã da chamada

function EcraChamada({ ativa, conversa, tiles, inicioEm, erro, mudo, camara, altifalante, ecra, livekit, aoAtender, aoDesligar, aoMudo, aoCamara, aoTrocarCamara, aoAltifalante, aoEcra, aoMinimizar, tema }: {
    ativa: EstadoChamada;
    conversa: Conversa | null;
    tiles: Tile[];
    inicioEm: number | null;
    erro: string | null;
    mudo: boolean;
    camara: boolean;
    altifalante: boolean;
    ecra: boolean;
    livekit: any;
    aoAtender(): void;
    aoDesligar(): void;
    aoMudo(): void;
    aoCamara(): void;
    aoTrocarCamara(): void;
    aoAltifalante(): void;
    aoEcra?(): void;
    aoMinimizar(): void;
    tema: { primaria: string };
}) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    // a bandeja quebra em 2 linhas quando há muitos botões (vídeo+partilha) —
    // medir a altura real para o PiP/erro ficarem SEMPRE acima dos controlos
    const [alturaBandeja, setAlturaBandeja] = useState(0);
    const acimaControlos = insets.bottom + 24 + (alturaBandeja || 84) + 14;
    const video = ativa.chamada.tipo === 'video';
    // incoming: nome do iniciador; fallback à contraparte da conversa — nunca o próprio
    const titulo = ativa.fase === 'a_receber' ? (ativa.iniciador?.nome ?? conversa?.titulo ?? 'Alguém') : (conversa?.titulo ?? 'Chamada');
    const foto = ativa.fase === 'a_receber' ? (ativa.iniciador?.foto_url ?? null) : (conversa?.foto_url ?? null);
    const VideoTrack = livekit?.VideoTrack;
    const remotos = tiles.filter((t) => !t.local && t.trackRef);
    const local = tiles.find((t) => t.local && t.trackRef);
    const remotoPausado = tiles.some((t) => !t.local && t.pausado);
    // caixa do PiP na proporção real da câmara → cover/contain coincidem (sem crop)
    const alturaPip = local?.proporcao ? Math.min(200, Math.max(84, Math.round(112 / local.proporcao))) : 168;
    const emCurso = ativa.fase === 'em_curso';

    const subtitulo =
        ativa.fase === 'falhada'
            ? 'Chamada falhada'
            : ativa.fase === 'a_ligar'
              ? 'A chamar…'
              : ativa.fase === 'a_receber'
                ? `Chamada de ${video ? 'vídeo' : 'voz'}`
                : inicioEm
                  ? undefined
                  : 'A ligar…';

    return (
        <Modal visible animationType="slide" onRequestClose={aoMinimizar}>
            {/* ecrã sempre escuro → ícones claros enquanto a chamada está visível */}
            <StatusBar animated barStyle="light-content" />
            <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
                {/* vídeos remotos */}
                {emCurso && video && VideoTrack && remotos.length > 0 && (
                    <View style={{ ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap' }}>
                        {remotos.map((t) => (
                            <View key={t.chave} style={{ width: remotos.length === 1 ? width : width / 2, height: remotos.length <= 2 ? height : height / Math.ceil(remotos.length / 2) }}>
                                {/* contain: o vídeo inteiro na proporção real (letterbox escuro), sem cortar */}
                                <VideoTrack trackRef={t.trackRef} style={{ flex: 1 }} objectFit="contain" zOrder={0} />
                                <Text style={estilos.nomeTile}>{t.nome}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* preview local — SEMPRE montado durante o vídeo: desmontar a
                    SurfaceView perde o TrackEvent.Restarted do unmute e o remount
                    agarra o stream morto (PiP preto). Câmara off = overlay. */}
                {emCurso && video && VideoTrack && local && (
                    <View style={[estilos.pip, { bottom: acimaControlos, height: alturaPip }]}>
                        {/* zOrder: SurfaceViews Android ignoram a ordem do layout — sem isto o
                            PiP renderiza ATRÁS do vídeo remoto fullscreen e fica invisível */}
                        <VideoTrack trackRef={local.trackRef} style={{ flex: 1 }} objectFit="contain" mirror zOrder={1} />
                        {!camara && (
                            <View style={estilos.pipOff}>
                                <Ionicons name="videocam-off" size={22} color="rgba(255,255,255,0.8)" />
                            </View>
                        )}
                    </View>
                )}

                {/* avatar central (áudio / a receber / a ligar) */}
                {(!emCurso || !video || remotos.length === 0) && (
                    <View style={estilos.centro}>
                        {ativa.fase === 'a_receber' || ativa.fase === 'a_ligar' ? (
                            <Pulso>
                                <Avatar nome={titulo} url={foto} tamanho={132} />
                            </Pulso>
                        ) : (
                            <Avatar nome={titulo} url={foto} tamanho={132} />
                        )}
                        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 20, textAlign: 'center', paddingHorizontal: 32 }}>{titulo}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 8, textAlign: 'center' }}>
                            {subtitulo ?? (inicioEm ? <Duracao desde={inicioEm} /> : null)}
                        </Text>
                        {emCurso && remotoPausado && (
                            <View style={estilos.pausaPill}>
                                <Ionicons name="videocam-off" size={14} color="rgba(255,255,255,0.75)" />
                                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' }}>Câmara em pausa</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* topo */}
                <View style={[estilos.topo, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={aoMinimizar} style={{ padding: 8 }}>
                        <Ionicons name="chevron-down" size={26} color="#fff" />
                    </Pressable>
                    {emCurso && inicioEm && video && remotos.length > 0 && (
                        <Text style={{ color: '#fff', fontWeight: '700' }}>
                            <Duracao desde={inicioEm} />
                        </Text>
                    )}
                    <View style={{ width: 42 }} />
                </View>

                {erro && (
                    <View style={[estilos.erro, { bottom: acimaControlos }]}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>{erro}</Text>
                    </View>
                )}

                {/* controlos (estilo WhatsApp) */}
                {ativa.fase === 'a_receber' ? (
                    // incoming: dois botões grandes com rótulo, afastados
                    <View style={[estilos.controlosReceber, { bottom: insets.bottom + 36 }]}>
                        <Botao icone="call" cor="#ef4444" aoTocar={aoDesligar} grande rodado rotulo="Recusar" />
                        <Pulso>
                            <Botao icone="call" cor="#10b981" aoTocar={aoAtender} grande rotulo="Atender" />
                        </Pulso>
                    </View>
                ) : ativa.fase === 'falhada' ? (
                    <View style={[estilos.controlosReceber, { bottom: insets.bottom + 36 }]}>
                        <Botao icone="close" aoTocar={aoDesligar} rotulo="Fechar" />
                    </View>
                ) : (
                    // em curso: bandeja arredondada com o desligar integrado
                    <View
                        style={[estilos.bandeja, { bottom: insets.bottom + 24 }]}
                        onLayout={(e: { nativeEvent: { layout: { height: number } } }) => setAlturaBandeja(e.nativeEvent.layout.height)}
                    >
                        <Botao icone={mudo ? 'mic-off' : 'mic'} ativo={mudo} aoTocar={aoMudo} />
                        {video && <Botao icone={camara ? 'videocam' : 'videocam-off'} ativo={!camara} aoTocar={aoCamara} />}
                        {video && camara && <Botao icone="camera-reverse-outline" aoTocar={aoTrocarCamara} />}
                        <Botao icone={altifalante ? 'volume-high' : 'volume-low'} ativo={altifalante} aoTocar={aoAltifalante} />
                        {aoEcra && <Botao icone={ecra ? 'stop-circle-outline' : 'share-outline'} ativo={ecra} aoTocar={aoEcra} />}
                        <Botao icone="call" cor="#ef4444" aoTocar={aoDesligar} rodado />
                    </View>
                )}
            </View>
        </Modal>
    );
}

/**
 * Botão de controlo estilo WhatsApp: 60px (76px `grande`), toggle `ativo`
 * (fundo branco + ícone escuro quando a função está ligada) e `rotulo`
 * opcional por baixo (ecrã a receber).
 */
function Botao({ icone, cor, aoTocar, grande, rodado, ativo, rotulo }: {
    icone: string;
    cor?: string;
    aoTocar(): void;
    grande?: boolean;
    rodado?: boolean;
    ativo?: boolean;
    rotulo?: string;
}) {
    const lado = grande ? 76 : 60;
    const fundo = cor ?? (ativo ? '#ffffff' : 'rgba(255,255,255,0.18)');
    const corIcone = ativo && !cor ? '#0f172a' : '#fff';

    const circulo = (
        <Pressable
            onPress={aoTocar}
            style={({ pressed }: { pressed: boolean }) => ({
                width: lado,
                height: lado,
                borderRadius: lado / 2,
                backgroundColor: fundo,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
            })}
        >
            <Ionicons
                name={icone as never}
                size={grande ? 34 : 26}
                color={corIcone}
                style={rodado ? { transform: [{ rotate: '135deg' }] } : undefined}
            />
        </Pressable>
    );

    if (!rotulo) return circulo;

    return (
        <View style={{ alignItems: 'center', gap: 10 }}>
            {circulo}
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{rotulo}</Text>
        </View>
    );
}

/** Relógio isolado — só este componente re-renderiza a cada segundo. */
function Duracao({ desde }: { desde: number }) {
    const [, forcar] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => forcar((n) => n + 1), 1000);

        return () => clearInterval(timer);
    }, []);

    return <>{duracaoMmSs(Math.max(0, Math.floor((Date.now() - desde) / 1000)))}</>;
}

const estilos = StyleSheet.create({
    centro: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    topo: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 10 },
    pip: { position: 'absolute', right: 14, width: 112, height: 168, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
    // câmara desligada: tapa o último frame SEM desmontar a SurfaceView
    pipOff: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
    pausaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
    nomeTile: { position: 'absolute', left: 10, bottom: 10, color: '#fff', fontWeight: '700', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
    erro: { position: 'absolute', left: 20, right: 20, backgroundColor: 'rgba(239,68,68,0.92)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
    // bandeja de controlos em curso (pill escura, estilo WhatsApp)
    bandeja: {
        position: 'absolute',
        alignSelf: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        backgroundColor: 'rgba(30,41,59,0.92)',
        borderRadius: 40,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 16,
    },
    // incoming: botões grandes com rótulo, afastados na largura toda
    controlosReceber: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly' },
    pill: { position: 'absolute', top: 58, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', borderRadius: 22, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
