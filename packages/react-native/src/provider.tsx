import {
    FlagFuncionalidade,
    IdentidadeConfig,
    MakaApi,
    MakaSocket,
    ObterToken,
    EventoChamada,
    Presenca,
    StorageAdapter,
    SyncEngine,
    Typing,
} from '@hongayetu/makachat-core';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SqliteStorage } from './sqlite-storage';

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
}

const Contexto = createContext<MakaChatContexto | null>(null);

export interface MakaChatProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    getToken: ObterToken;
    /** storage alternativo (por omissão: expo-sqlite, um ficheiro por identidade) */
    storage?: StorageAdapter;
    children: React.ReactNode;
}

// o Metro fornece require em runtime; declarado aqui para não depender de @types/node
declare const require: (modulo: string) => unknown;

function abrirStoragePadrao(serviceKey: string, identity: IdentidadeConfig): StorageAdapter {
    // require dinâmico: expo-sqlite é peerDependency e só existe na app
    const sqlite = require('expo-sqlite') as {
        openDatabaseSync(nome: string): ConstructorParameters<typeof SqliteStorage>[0];
    };

    // um ficheiro por serviço+identidade — isolamento local entre contextos
    const nome = `makachat_${serviceKey}_${identity.tipo}_${identity.id}.db`.replace(/[^a-zA-Z0-9_.]/g, '_');

    return new SqliteStorage(sqlite.openDatabaseSync(nome));
}

export function MakaChatProvider({ serviceKey, identity, getToken, storage, children }: MakaChatProviderProps) {
    const [features, setFeatures] = useState<FlagFuncionalidade[]>([]);
    const ouvintesTyping = useRef(new Set<(typing: Typing) => void>());
    const ouvintesPresenca = useRef(new Set<(presenca: Presenca) => void>());
    const ouvintesChamadas = useRef(new Set<(evento: EventoChamada) => void>());

    const valor = useMemo<MakaChatContexto>(() => {
        const api = new MakaApi(getToken);
        const adapter = storage ?? abrirStoragePadrao(serviceKey, identity);

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
