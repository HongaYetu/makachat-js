import {
    FlagFuncionalidade,
    IdentidadeConfig,
    MakaApi,
    MakaSocket,
    MemoryStorage,
    ObterToken,
    EventoChamada,
    Presenca,
    StorageAdapter,
    SyncEngine,
    Typing,
} from '@hongayetu/makachat-core';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cssVarsDoTema, MakaTema } from './tema';

export interface MakaChatContexto {
    engine: SyncEngine;
    api: MakaApi;
    socket: MakaSocket;
    serviceKey: string;
    identidade: IdentidadeConfig;
    features: FlagFuncionalidade[];
    subscreverTyping(ouvinte: (typing: Typing) => void): () => void;
    subscreverPresenca(ouvinte: (presenca: Presenca) => void): () => void;
    subscreverChamadas(ouvinte: (evento: EventoChamada) => void): () => void;
    /** ligação socket ativa? (para barras de estado offline) */
    ligado: boolean;
    /** ConversaPainel regista-se como visível; o Dock usa isto para não duplicar */
    registarVisivel(conversaId: string): () => void;
    estaVisivel(conversaId: string): boolean;
}

const Contexto = createContext<MakaChatContexto | null>(null);

export interface MakaChatProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    getToken: ObterToken;
    /** na web a fonte é o servidor; por omissão usa memória (sem persistência local) */
    storage?: StorageAdapter;
    tema?: MakaTema;
    children: React.ReactNode;
}

export function MakaChatProvider({ serviceKey, identity, getToken, storage, tema, children }: MakaChatProviderProps) {
    const [features, setFeatures] = useState<FlagFuncionalidade[]>([]);
    const [ligado, setLigado] = useState(false);
    const visiveis = useRef(new Map<string, number>());
    const ouvintesTyping = useRef(new Set<(typing: Typing) => void>());
    const ouvintesPresenca = useRef(new Set<(presenca: Presenca) => void>());
    const ouvintesChamadas = useRef(new Set<(evento: EventoChamada) => void>());

    const valor = useMemo<MakaChatContexto>(() => {
        const api = new MakaApi(getToken);
        const adapter = storage ?? new MemoryStorage();

        let engine: SyncEngine;

        const socket = new MakaSocket({
            obterToken: async () => {
                api.invalidarSessao();

                return api.sessao();
            },
            aoLigar: () => {
                setLigado(true);
                void engine.aoLigar();
            },
            aoDesligar: () => setLigado(false),
        });

        engine = new SyncEngine(adapter, api, socket, {
            identidade: identity,
            aoTyping: (typing) => ouvintesTyping.current.forEach((o) => o(typing)),
            aoPresenca: (presenca) => ouvintesPresenca.current.forEach((o) => o(presenca)),
            aoChamada: (evento) => ouvintesChamadas.current.forEach((o) => o(evento)),
        });

        return {
            engine,
            api,
            socket,
            serviceKey,
            identidade: identity,
            features: [],
            subscreverTyping: (ouvinte) => {
                ouvintesTyping.current.add(ouvinte);

                return () => ouvintesTyping.current.delete(ouvinte);
            },
            subscreverPresenca: (ouvinte) => {
                ouvintesPresenca.current.add(ouvinte);

                return () => ouvintesPresenca.current.delete(ouvinte);
            },
            subscreverChamadas: (ouvinte) => {
                ouvintesChamadas.current.add(ouvinte);

                return () => ouvintesChamadas.current.delete(ouvinte);
            },
            ligado: false,
            registarVisivel: (conversaId) => {
                visiveis.current.set(conversaId, (visiveis.current.get(conversaId) ?? 0) + 1);

                return () => {
                    const atual = (visiveis.current.get(conversaId) ?? 1) - 1;

                    if (atual <= 0) {
                        visiveis.current.delete(conversaId);
                    } else {
                        visiveis.current.set(conversaId, atual);
                    }
                };
            },
            estaVisivel: (conversaId) => (visiveis.current.get(conversaId) ?? 0) > 0,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceKey, identity.id, identity.tipo]);

    useEffect(() => {
        void valor.engine.iniciar();
        void valor.api
            .listarFeatures()
            .then((r) => setFeatures(r.features))
            .catch(() => undefined);

        return () => valor.socket.desligar();
    }, [valor]);

    return (
        <Contexto.Provider value={{ ...valor, features, ligado }}>
            <div style={{ display: 'contents', ...cssVarsDoTema(tema) }}>{children}</div>
        </Contexto.Provider>
    );
}

export function useMakaChat(): MakaChatContexto {
    const contexto = useContext(Contexto);

    if (!contexto) {
        throw new Error('useMakaChat tem de ser usado dentro de <MakaChatProvider>');
    }

    return contexto;
}
