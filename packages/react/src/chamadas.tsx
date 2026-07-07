import { Chamada, EventoChamada } from '@hongayetu/makachat-core';
import { RemoteTrack, Room, RoomEvent, Track } from 'livekit-client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMakaChat } from './provider';

interface EstadoChamada {
    chamada: Chamada;
    fase: 'a_receber' | 'a_ligar' | 'em_curso';
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

/** Monta dentro do MakaChatProvider; toca/atende em qualquer página. */
export function ChamadasProvider({ children }: { children: React.ReactNode }) {
    const { api, subscreverChamadas } = useMakaChat();
    const [ativa, setAtiva] = useState<EstadoChamada | null>(null);
    const room = useRef<Room | null>(null);
    const midia = useRef<HTMLDivElement>(null);
    const [mudo, setMudo] = useState(false);
    const [camara, setCamara] = useState(false);
    const [ecra, setEcra] = useState(false);

    const limpar = useCallback(() => {
        void room.current?.disconnect();
        room.current = null;
        setAtiva(null);
        setMudo(false);
        setCamara(false);
        setEcra(false);
    }, []);

    const ligarSala = useCallback(async (token: string, wsUrl: string, video: boolean) => {
        const r = new Room();
        room.current = r;

        r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            const el = track.attach();

            if (track.kind === Track.Kind.Video) el.style.cssText = 'max-width:46%;border-radius:8px';
            midia.current?.appendChild(el);
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach().forEach((e) => e.remove()));

        await r.connect(wsUrl, token);
        await r.localParticipant.setMicrophoneEnabled(true);

        if (video) {
            await r.localParticipant.setCameraEnabled(true);
            setCamara(true);

            const local = r.localParticipant.getTrackPublication(Track.Source.Camera)?.track;

            if (local) {
                const el = local.attach();
                el.style.cssText = 'max-width:22%;border-radius:8px;opacity:.9';
                midia.current?.appendChild(el);
            }
        }
    }, []);

    useEffect(
        () =>
            subscreverChamadas((evento: EventoChamada) => {
                if (evento.evento === 'iniciada') {
                    setAtiva({ chamada: evento.chamada, fase: 'a_receber', iniciador: evento.iniciador });
                } else if (evento.evento === 'atendida') {
                    setAtiva((a) => (a ? { ...a, fase: 'em_curso', chamada: evento.chamada } : a));
                } else {
                    limpar();
                }
            }),
        [subscreverChamadas, limpar],
    );

    const iniciar = useCallback(
        async (conversaId: string, tipo: 'audio' | 'video') => {
            const r = await api.iniciarChamada(conversaId, tipo);

            setAtiva({ chamada: r.chamada, fase: 'a_ligar' });

            if (r.livekit_token && r.ws_url) await ligarSala(r.livekit_token, r.ws_url, tipo === 'video');
        },
        [api, ligarSala],
    );

    const atender = async () => {
        if (!ativa) return;

        const r = await api.atenderChamada(ativa.chamada.id);

        setAtiva({ ...ativa, fase: 'em_curso', chamada: r.chamada });

        if (r.livekit_token && r.ws_url) await ligarSala(r.livekit_token, r.ws_url, ativa.chamada.tipo === 'video');
    };

    const desligar = async () => {
        if (ativa) {
            await (ativa.fase === 'a_receber'
                ? api.rejeitarChamada(ativa.chamada.id)
                : api.terminarChamada(ativa.chamada.id)
            ).catch(() => undefined);
        }

        limpar();
    };

    const B = (p: { onClick(): void; bg?: string; children: React.ReactNode }) => (
        <button
            onClick={p.onClick}
            style={{ border: 'none', borderRadius: '50%', width: 52, height: 52, fontSize: 20, cursor: 'pointer', background: p.bg ?? '#334155', color: '#fff' }}
        >
            {p.children}
        </button>
    );

    return (
        <Ctx.Provider value={{ iniciar, ativa }}>
            {children}
            {ativa && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.94)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, color: '#fff' }}>
                    <div style={{ fontSize: 20 }}>
                        {ativa.fase === 'a_receber'
                            ? `${ativa.iniciador?.nome ?? 'Alguém'} — chamada de ${ativa.chamada.tipo === 'video' ? 'vídeo' : 'áudio'}`
                            : ativa.fase === 'a_ligar'
                              ? 'A chamar…'
                              : 'Em chamada'}
                    </div>
                    <div ref={midia} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90%' }} />
                    <div style={{ display: 'flex', gap: 14 }}>
                        {ativa.fase === 'a_receber' && <B onClick={() => void atender()} bg="#22c55e">📞</B>}
                        {ativa.fase !== 'a_receber' && (
                            <>
                                <B onClick={() => { const m = !mudo; setMudo(m); void room.current?.localParticipant.setMicrophoneEnabled(!m); }}>{mudo ? '🔇' : '🎤'}</B>
                                {ativa.chamada.tipo === 'video' && (
                                    <B onClick={() => { const c = !camara; setCamara(c); void room.current?.localParticipant.setCameraEnabled(c); }}>{camara ? '📷' : '🚫'}</B>
                                )}
                                <B onClick={() => { const e = !ecra; setEcra(e); void room.current?.localParticipant.setScreenShareEnabled(e); }}>{ecra ? '🖥️✓' : '🖥️'}</B>
                            </>
                        )}
                        <B onClick={() => void desligar()} bg="#dc2626">✕</B>
                    </div>
                </div>
            )}
        </Ctx.Provider>
    );
}
