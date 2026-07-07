import {
    FlagFuncionalidade,
    IdentidadeConfig,
    MakaApi,
    MakaSocket,
    MemoryStorage,
    ObterToken,
    Presenca,
    StorageAdapter,
    SyncEngine,
    Typing,
} from '@hongayetu/makachat-core';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface MakaChatContexto {
    engine: SyncEngine;
    api: MakaApi;
    socket: MakaSocket;
    serviceKey: string;
    identidade: IdentidadeConfig;
    features: FlagFuncionalidade[];
    subscreverTyping(ouvinte: (typing: Typing) => void): () => void;
    subscreverPresenca(ouvinte: (presenca: Presenca) => void): () => void;
}

const Contexto = createContext<MakaChatContexto | null>(null);

export interface MakaChatProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    getToken: ObterToken;
    /** na web a fonte é o servidor; por omissão usa memória (sem persistência local) */
    storage?: StorageAdapter;
    children: React.ReactNode;
}

export function MakaChatProvider({ serviceKey, identity, getToken, storage, children }: MakaChatProviderProps) {
    const [features, setFeatures] = useState<FlagFuncionalidade[]>([]);
    const ouvintesTyping = useRef(new Set<(typing: Typing) => void>());
    const ouvintesPresenca = useRef(new Set<(presenca: Presenca) => void>());

    const valor = useMemo<MakaChatContexto>(() => {
        const api = new MakaApi(getToken);
        const adapter = storage ?? new MemoryStorage();

        let engine: SyncEngine;

        const socket = new MakaSocket({
            obterToken: async () => {
                api.invalidarSessao();

                return api.sessao();
            },
            aoLigar: () => void engine.aoLigar(),
        });

        engine = new SyncEngine(adapter, api, socket, {
            identidade: identity,
            aoTyping: (typing) => ouvintesTyping.current.forEach((o) => o(typing)),
            aoPresenca: (presenca) => ouvintesPresenca.current.forEach((o) => o(presenca)),
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

    return <Contexto.Provider value={{ ...valor, features }}>{children}</Contexto.Provider>;
}

export function useMakaChat(): MakaChatContexto {
    const contexto = useContext(Contexto);

    if (!contexto) {
        throw new Error('useMakaChat tem de ser usado dentro de <MakaChatProvider>');
    }

    return contexto;
}
