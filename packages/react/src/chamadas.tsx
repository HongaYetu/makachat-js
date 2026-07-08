import { Icon } from '@iconify/react';
import { Chamada, Conversa, EventoChamada } from '@hongayetu/makachat-core';
import { LocalTrackPublication, RemoteTrack, Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mostrarNotificacao } from './notificacoes';
import { useMakaChat } from './provider';
import { AvatarWeb } from './ui';

interface EstadoChamada {
    chamada: Chamada;
    fase: 'a_receber' | 'a_ligar' | 'em_curso' | 'falhada';
    iniciador?: { nome: string; foto_url: string | null };
}

interface ChamadasApi {
    iniciar(conversaId: string, tipo: 'audio' | 'video'): Promise<void>;
    ativa: EstadoChamada | null;
}

const Ctx = createContext<ChamadasApi | null>(null);

export function useChamadasOpcional(): ChamadasApi | null {
    return useContext(Ctx);
}

export function useChamadas(): ChamadasApi {
    const ctx = useContext(Ctx);

    if (!ctx) throw new Error('useChamadas requer <ChamadasProvider>');

    return ctx;
}

/**
 * Janela de chamada flutuante e arrastável (estilo Messenger): não bloqueia o
 * site; expande para ecrã inteiro ou minimiza para uma pill com a duração.
 */
export function ChamadasProvider({ children }: { children: React.ReactNode }) {
    const { api, engine, subscreverChamadas } = useMakaChat();
    const [ativa, setAtiva] = useState<EstadoChamada | null>(null);
    const [conversa, setConversa] = useState<Conversa | null>(null);
    const [modo, setModo] = useState<'janela' | 'cheio' | 'pill'>('janela');
    /** timestamp de quando a chamada entrou em curso — o relógio vive num componente-folha */
    const [inicioEm, setInicioEm] = useState<number | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [mudo, setMudo] = useState(false);
    const [camara, setCamara] = useState(false);
    const [ecra, setEcra] = useState(false);
    const [pos, setPos] = useState({ x: 24, y: 24 });

    const room = useRef<Room | null>(null);
    const midia = useRef<HTMLDivElement>(null);
    /** elementos de media vivos (por sid) — sobrevivem a desmontagens do contentor (pill ↔ janela) */
    const elementos = useRef(new Map<string, HTMLElement>());
    /** true enquanto mostramos o ecrã de falha — os eventos rejeitada/terminada não podem fechá-lo */
    const falhada = useRef(false);
    const [erroSolto, setErroSolto] = useState<string | null>(null);
    const arrasto = useRef<{ ativo: boolean; dx: number; dy: number }>({ ativo: false, dx: 0, dy: 0 });

    const limpar = useCallback(() => {
        void room.current?.disconnect();
        room.current = null;
        falhada.current = false;
        elementos.current.clear();

        setAtiva(null);
        setConversa(null);
        setModo('janela');
        setInicioEm(null);
        setErro(null);
        setMudo(false);
        setCamara(false);
        setEcra(false);
    }, []);

    const comecarTimer = useCallback(() => {
        setInicioEm((atual) => atual ?? Date.now());
    }, []);

    /** (Re)anexa todos os elementos de media ao contentor atual — o contentor
     *  desmonta/remonta ao minimizar para pill e no arranque pode ainda não existir. */
    const anexarTodos = useCallback(() => {
        const alvo = midia.current;

        if (!alvo) return;

        for (const el of elementos.current.values()) {
            if (el.parentElement !== alvo) alvo.appendChild(el);
        }
    }, []);

    /** Pede as permissões ANTES de tocar/atender — sem elas a chamada não avança. */
    const verificarMedia = useCallback(async (video: boolean): Promise<string | null> => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            return 'O browser bloqueou a câmara/microfone — esta página precisa de HTTPS.';
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
            stream.getTracks().forEach((tr) => tr.stop());

            return null;
        } catch {
            return video
                ? 'Sem acesso à câmara/microfone — permite o acesso nas definições do browser.'
                : 'Sem acesso ao microfone — permite o acesso nas definições do browser.';
        }
    }, []);

    const ligarSala = useCallback(async (token: string, wsUrl: string, video: boolean): Promise<boolean> => {
        // padrão EiConnect: qualidade adapta-se ao tamanho em que o vídeo é
        // visualizado (adaptiveStream) e camadas não usadas pausam (dynacast)
        const r = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
            reconnectPolicy: {
                nextRetryDelayInMs: (contexto) =>
                    contexto.elapsedMs > 90_000 ? null : Math.min(500 * 2 ** contexto.retryCount, 10_000),
            },
        });
        room.current = r;
        elementos.current.clear();

        // remotos: vídeo e ÁUDIO (o attach do áudio cria o <audio> que toca a voz)
        r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            const el = track.attach();

            if (track.kind === Track.Kind.Video) el.className = 'maka-video-remoto';
            elementos.current.set(track.sid ?? String(elementos.current.size), el);
            anexarTodos();
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            track.detach().forEach((e) => e.remove());

            if (track.sid) elementos.current.delete(track.sid);
        });

        // locais: preview da câmara/partilha por evento — cobre o arranque,
        // o ligar/desligar a meio e a partilha de ecrã
        r.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
            if (pub.track && pub.kind === Track.Kind.Video) {
                const el = pub.track.attach();
                el.className = 'maka-video-local';
                elementos.current.set(pub.trackSid ?? `local_${elementos.current.size}`, el);
                anexarTodos();
            }
        });
        r.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
            pub.track?.detach().forEach((e) => e.remove());

            if (pub.trackSid) elementos.current.delete(pub.trackSid);
        });

        try {
            await r.connect(wsUrl, token);
        } catch (e) {
            setErro('Não foi possível ligar ao servidor de chamadas.');
            console.error('[makachat] ligação LiveKit falhou:', e);

            return false;
        }

        // políticas de autoplay: desbloqueia a reprodução de áudio (estamos num gesto do utilizador)
        void r.startAudio().catch(() => undefined);

        try {
            await r.localParticipant.setMicrophoneEnabled(true);

            if (video) {
                await r.localParticipant.setCameraEnabled(true);
                setCamara(true);
            }
        } catch (e) {
            setErro(video ? 'Sem acesso à câmara/microfone.' : 'Sem acesso ao microfone.');
            console.error('[makachat] media falhou:', e);

            return false;
        }

        return true;
    }, []);

    useEffect(
        () =>
            subscreverChamadas((evento: EventoChamada) => {
                if (evento.evento === 'iniciada') {
                    if (typeof document !== 'undefined' && document.hidden) {
                        mostrarNotificacao(
                            `${evento.iniciador?.nome ?? 'Alguém'} está a ligar`,
                            { corpo: evento.chamada.tipo === 'video' ? 'Chamada de vídeo' : 'Chamada de áudio', icone: evento.iniciador?.foto_url ?? undefined, tag: `chamada_${evento.chamada.id}` },
                        );
                    }

                    setAtiva({ chamada: evento.chamada, fase: 'a_receber', iniciador: evento.iniciador });
                    void engine.storage.obterConversa(evento.chamada.conversa_id).then(setConversa);
                } else if (evento.evento === 'atendida') {
                    setAtiva((a) => (a ? { ...a, fase: 'em_curso', chamada: evento.chamada } : a));
                    comecarTimer();
                } else if (!falhada.current) {
                    limpar();
                }
            }),
        [subscreverChamadas, engine, limpar, comecarTimer],
    );

    const iniciar = useCallback(
        async (conversaId: string, tipo: 'audio' | 'video') => {
            // sem permissões nem sequer tocamos do outro lado
            const problema = await verificarMedia(tipo === 'video');

            if (problema) {
                setErroSolto(problema);
                setTimeout(() => setErroSolto(null), 6000);

                return;
            }

            const r = await api.iniciarChamada(conversaId, tipo);

            setAtiva({ chamada: r.chamada, fase: 'a_ligar' });
            void engine.storage.obterConversa(conversaId).then(setConversa);

            if (r.livekit_token && r.ws_url) {
                const ok = await ligarSala(r.livekit_token, r.ws_url, tipo === 'video');

                if (!ok) {
                    falhada.current = true;
                    await api.terminarChamada(r.chamada.id).catch(() => undefined);
                    setAtiva((a) => (a ? { ...a, fase: 'falhada' } : a));
                }
            }
        },
        [api, engine, ligarSala, verificarMedia],
    );

    const atender = async () => {
        if (!ativa) return;

        // sem permissões a chamada não é atendida — rejeitamos com o motivo à vista
        const problema = await verificarMedia(ativa.chamada.tipo === 'video');

        if (problema) {
            falhada.current = true;
            setErro(problema);
            setAtiva({ ...ativa, fase: 'falhada' });
            await api.rejeitarChamada(ativa.chamada.id).catch(() => undefined);

            return;
        }

        const r = await api.atenderChamada(ativa.chamada.id);

        if (r.livekit_token && r.ws_url) {
            const ok = await ligarSala(r.livekit_token, r.ws_url, ativa.chamada.tipo === 'video');

            if (!ok) {
                falhada.current = true;
                await api.terminarChamada(ativa.chamada.id).catch(() => undefined);
                setAtiva({ ...ativa, fase: 'falhada' });

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

    // ao voltar da pill ou quando a janela monta, volta a pendurar os vídeos
    useEffect(() => {
        anexarTodos();
    }, [anexarTodos, modo, ativa?.fase]);

    // arrastar pela barra de título (pointer events)
    const aoPegar = (e: React.PointerEvent) => {
        arrasto.current = { ativo: true, dx: e.clientX + pos.x, dy: e.clientY - pos.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
    const aoMover = (e: React.PointerEvent) => {
        if (!arrasto.current.ativo) return;

        setPos({
            x: Math.max(0, arrasto.current.dx - e.clientX),
            y: Math.max(0, e.clientY - arrasto.current.dy),
        });
    };
    const aoLargar = () => {
        arrasto.current.ativo = false;
    };

    const titulo = ativa?.fase === 'a_receber' ? (ativa.iniciador?.nome ?? 'Alguém') : (conversa?.titulo ?? 'Chamada');
    const foto = ativa?.fase === 'a_receber' ? (ativa.iniciador?.foto_url ?? null) : (conversa?.foto_url ?? null);
    const subtitulo =
        ativa?.fase === 'em_curso' && inicioEm ? (
            <Duracao desde={inicioEm} />
        ) : ativa?.fase === 'falhada' ? (
            'Chamada falhada'
        ) : ativa?.fase === 'a_ligar' ? (
            'A chamar…'
        ) : (
            `Chamada de ${ativa?.chamada.tipo === 'video' ? 'vídeo' : 'áudio'}`
        );

    const B = (p: { onClick(): void; titulo: string; classe?: string; children: React.ReactNode }) => (
        <button
            title={p.titulo}
            onClick={p.onClick}
            className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 text-lg text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${p.classe ?? 'bg-white/15 hover:bg-white/25'}`}
        >
            {p.children}
        </button>
    );

    const valorCtx = useMemo(() => ({ iniciar, ativa }), [iniciar, ativa]);

    return (
        <Ctx.Provider value={valorCtx}>
            {children}
            {/* estilos dos vídeos anexados imperativamente */}
            <style>{`
                .maka-video-remoto { width: 100%; max-height: 100%; object-fit: cover; border-radius: 12px; }
                .maka-video-local { position: absolute; right: 10px; bottom: 10px; width: 28%; border-radius: 10px; box-shadow: 0 4px 14px rgba(0,0,0,.4); z-index: 1; }
            `}</style>

            {erroSolto && !ativa && (
                <div className="fixed bottom-6 left-6 z-[9999] animate-maka-subir rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-red-500/50">
                    {erroSolto}
                </div>
            )}

            {ativa && modo === 'pill' && (
                <button
                    onClick={() => setModo('janela')}
                    className="fixed bottom-6 left-6 z-[9999] flex animate-maka-subir cursor-pointer items-center gap-2.5 rounded-full border-0 bg-slate-900 py-2 pl-2 pr-4 text-white shadow-2xl"
                >
                    <AvatarWeb nome={titulo} url={foto} tamanho={30} />
                    <span className="text-sm font-semibold">{subtitulo}</span>
                    <Icon icon="tabler:arrows-maximize" className="text-white/70" />
                </button>
            )}

            {ativa && modo !== 'pill' && (
                <div
                    className={`z-[9999] flex flex-col overflow-hidden bg-slate-900 text-white shadow-2xl ring-1 ring-white/10 ${
                        modo === 'cheio' ? 'fixed inset-0' : 'fixed w-[420px] max-w-[94vw] animate-maka-subir rounded-2xl'
                    }`}
                    style={modo === 'cheio' ? undefined : { right: pos.x, bottom: pos.y }}
                >
                    {/* barra de título (arrastável) */}
                    <div
                        className={`flex items-center gap-2.5 px-3 py-2.5 ${modo === 'janela' ? 'cursor-move touch-none select-none' : ''}`}
                        onPointerDown={modo === 'janela' ? aoPegar : undefined}
                        onPointerMove={modo === 'janela' ? aoMover : undefined}
                        onPointerUp={modo === 'janela' ? aoLargar : undefined}
                    >
                        <AvatarWeb nome={titulo} url={foto} tamanho={30} />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{titulo}</span>
                            <span className="block text-xs text-white/60">{subtitulo}</span>
                        </span>
                        <button title={modo === 'cheio' ? 'Restaurar' : 'Ecrã inteiro'} onClick={() => setModo(modo === 'cheio' ? 'janela' : 'cheio')} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/10">
                            <Icon icon={modo === 'cheio' ? 'tabler:arrows-minimize' : 'tabler:arrows-maximize'} />
                        </button>
                        <button title="Minimizar" onClick={() => setModo('pill')} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/70 hover:bg-white/10">
                            <Icon icon="tabler:minus" />
                        </button>
                    </div>

                    {/* área de media */}
                    <div className={`relative flex items-center justify-center bg-black/40 ${modo === 'cheio' ? 'flex-1' : 'h-[300px]'}`}>
                        <div ref={midia} className="absolute inset-0 flex items-center justify-center gap-2 p-2" />
                        {(ativa.chamada.tipo === 'audio' || ativa.fase !== 'em_curso') && (
                            <div className={`z-[1] flex flex-col items-center gap-3 ${ativa.fase !== 'em_curso' ? 'animate-maka-pulsar' : ''}`}>
                                <AvatarWeb nome={titulo} url={foto} tamanho={modo === 'cheio' ? 110 : 76} />
                                <span className="text-sm text-white/70">{subtitulo}</span>
                            </div>
                        )}
                        {erro && (
                            <div className="absolute inset-x-3 bottom-3 z-[2] rounded-xl bg-red-500/90 px-3 py-2 text-center text-xs font-semibold text-white">
                                {erro}
                            </div>
                        )}
                    </div>

                    {/* controlos */}
                    <div className="flex items-center justify-center gap-3 px-4 py-3.5">
                        {ativa.fase === 'falhada' ? (
                            <B titulo="Fechar" onClick={() => void desligar()} classe="bg-white/15 hover:bg-white/25">
                                <Icon icon="tabler:x" />
                            </B>
                        ) : ativa.fase === 'a_receber' ? (
                            <>
                                <B titulo="Atender" onClick={() => void atender()} classe="animate-maka-pulsar bg-emerald-500 hover:bg-emerald-400">
                                    <Icon icon="tabler:phone" />
                                </B>
                                <B titulo="Rejeitar" onClick={() => void desligar()} classe="bg-red-600 hover:bg-red-500">
                                    <Icon icon="tabler:phone-off" />
                                </B>
                            </>
                        ) : (
                            <>
                                <B titulo={mudo ? 'Ativar micro' : 'Silenciar'} onClick={() => { const m = !mudo; setMudo(m); void room.current?.localParticipant.setMicrophoneEnabled(!m); }}>
                                    <Icon icon={mudo ? 'tabler:microphone-off' : 'tabler:microphone'} />
                                </B>
                                {ativa.chamada.tipo === 'video' && (
                                    <B titulo="Câmara" onClick={() => { const c = !camara; setCamara(c); void room.current?.localParticipant.setCameraEnabled(c); }}>
                                        <Icon icon={camara ? 'tabler:video' : 'tabler:video-off'} />
                                    </B>
                                )}
                                <B titulo="Partilhar ecrã" onClick={() => { const e = !ecra; setEcra(e); void room.current?.localParticipant.setScreenShareEnabled(e); }} classe={ecra ? 'bg-[var(--maka-primaria)]' : undefined}>
                                    <Icon icon="tabler:screen-share" />
                                </B>
                                <B titulo="Desligar" onClick={() => void desligar()} classe="bg-red-600 hover:bg-red-500">
                                    <Icon icon="tabler:phone-off" />
                                </B>
                            </>
                        )}
                    </div>
                </div>
            )}
        </Ctx.Provider>
    );
}

/** Relógio da chamada isolado: só este componente re-renderiza a cada segundo. */
function Duracao({ desde }: { desde: number }) {
    const [, forcar] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => forcar((n) => n + 1), 1000);

        return () => clearInterval(timer);
    }, []);

    const segundos = Math.max(0, Math.floor((Date.now() - desde) / 1000));

    return (
        <>
            {String(Math.floor(segundos / 60)).padStart(2, '0')}:{String(segundos % 60).padStart(2, '0')}
        </>
    );
}
