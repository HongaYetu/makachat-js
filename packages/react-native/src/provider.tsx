import {
    AlvoParticipante,
    FlagFuncionalidade,
    IdentidadeConfig,
    MakaApi,
    MakaSocket,
    Mensagem,
    MetadadosPartilha,
    ObterToken,
    EventoChamada,
    ParticipanteConversa,
    Presenca,
    StorageAdapter,
    SyncEngine,
    Typing,
} from '@hongayetu/makachat-core';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { obterPushMakaChat } from './opcionais';
import { SqliteStorage } from './sqlite-storage';
import { MakaTema, resolverTema, TemaResolvido } from './tema';
import { tocarSom } from './sons';
import type { HeaderChatContexto } from './ui/ChatScreen';

export interface MakaChatContexto {
    engine: SyncEngine;
    api: MakaApi;
    socket: MakaSocket;
    serviceKey: string;
    identidade: IdentidadeConfig;
    features: FlagFuncionalidade[];
    /** ligação socket ativa? (barras de estado offline) */
    ligado: boolean;
    /** contactos fornecidos pela app — criar conversas/grupos */
    contactos: AlvoParticipante[];
    tema: TemaResolvido;
    subscreverTyping(ouvinte: (typing: Typing) => void): () => void;
    subscreverPresenca(ouvinte: (presenca: Presenca) => void): () => void;
    subscreverChamadas(ouvinte: (evento: EventoChamada) => void): () => void;
    /** mensagens novas recebidas (deduplicadas, sem as próprias) — em qualquer ecrã da app */
    subscreverMensagens(ouvinte: (mensagem: Mensagem) => void): () => void;
    /** ChatScreen regista-se como visível — marcar-lidas e badges respeitam isto */
    registarVisivel(conversaId: string): () => void;
    estaVisivel(conversaId: string): boolean;
    /** clique num cartão de partilha/link — a app navega (deep link/router) */
    aoAbrirPartilha?: (metadados: MetadadosPartilha) => void;
    /** "Ver perfil" no mini perfil/info — o serviço navega (ex.: kanda → /perfil/username) */
    aoVerPerfil?: (participante: ParticipanteConversa) => void;
    /** pesquisa server-side de contactos (nova conversa/partilha) — API da app */
    pesquisarContactos?: (q: string) => Promise<AlvoParticipante[]>;
    /** rótulo da secção de sugestões na nova conversa (padrão: "Sugestões") */
    textoSugestoes?: string;
    /** header custom da conversa (RotaConversa usa-o — ex.: Humbi laranja); a barra de estado passa a ser gerida pelo próprio header */
    renderHeaderConversa?: (ctx: HeaderChatContexto) => React.ReactNode;
}

// singleton global: o subcaminho `/rotas` é um bundle CJS separado (esbuild não
// faz code-splitting p/ CJS), pelo que este módulo é DUPLICADO nesse bundle —
// sem o cache global, o MakaChatProvider e o useMakaChat das rotas usariam
// Contextos diferentes (→ ecrã em branco na conversa).
const alcanceGlobal = globalThis as unknown as { __makaChatCtx?: React.Context<MakaChatContexto | null> };
const Contexto = (alcanceGlobal.__makaChatCtx ??= createContext<MakaChatContexto | null>(null));

export interface MakaChatProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    getToken: ObterToken;
    /** storage alternativo (por omissão: expo-sqlite, um ficheiro por identidade) */
    storage?: StorageAdapter;
    tema?: MakaTema;
    contactos?: AlvoParticipante[];
    aoAbrirPartilha?: (metadados: MetadadosPartilha) => void;
    aoVerPerfil?: (participante: ParticipanteConversa) => void;
    pesquisarContactos?: (q: string) => Promise<AlvoParticipante[]>;
    textoSugestoes?: string;
    renderHeaderConversa?: (ctx: HeaderChatContexto) => React.ReactNode;
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

export function MakaChatProvider({
    serviceKey,
    identity,
    getToken,
    storage,
    tema,
    contactos,
    aoAbrirPartilha,
    aoVerPerfil,
    pesquisarContactos,
    textoSugestoes,
    renderHeaderConversa,
    children,
}: MakaChatProviderProps) {
    const [features, setFeatures] = useState<FlagFuncionalidade[]>([]);
    const [ligado, setLigado] = useState(false);
    const visiveis = useRef(new Map<string, number>());
    const ouvintesTyping = useRef(new Set<(typing: Typing) => void>());
    const ouvintesPresenca = useRef(new Set<(presenca: Presenca) => void>());
    const ouvintesChamadas = useRef(new Set<(evento: EventoChamada) => void>());
    const ouvintesMensagens = useRef(new Set<(mensagem: Mensagem) => void>());

    const valor = useMemo<
        Omit<MakaChatContexto, 'features' | 'ligado' | 'contactos' | 'tema' | 'aoAbrirPartilha' | 'aoVerPerfil'>
    >(() => {
        const api = new MakaApi(getToken);
        const adapter = storage ?? abrirStoragePadrao(serviceKey, identity);

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
            aoMensagem: (mensagem) => {
                ouvintesMensagens.current.forEach((o) => o(mensagem));

                // silenciosa (decisão do hub: não conta no badge) → sem som
                if (!mensagem.silenciosa) tocarSom('recebida');
            },
        });

        return {
            engine,
            api,
            socket,
            serviceKey,
            identidade: identity,
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
            subscreverMensagens: (ouvinte) => {
                ouvintesMensagens.current.add(ouvinte);

                return () => ouvintesMensagens.current.delete(ouvinte);
            },
            registarVisivel: (conversaId: string) => {
                visiveis.current.set(conversaId, (visiveis.current.get(conversaId) ?? 0) + 1);

                return () => {
                    const atual = (visiveis.current.get(conversaId) ?? 1) - 1;

                    if (atual <= 0) visiveis.current.delete(conversaId);
                    else visiveis.current.set(conversaId, atual);
                };
            },
            estaVisivel: (conversaId: string) => (visiveis.current.get(conversaId) ?? 0) > 0,
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

    // Inbox do push nativo: mensagens recebidas por FCM com a app morta ficam
    // no SQLite nativo — drena no arranque e ouve pushes com a app viva em
    // background. Upsert idempotente por id (o delta não duplica).
    useEffect(() => {
        const push = obterPushMakaChat();

        if (!push?.drenarInbox) return;

        const ingerir = (itens: { mensagem_json: string }[]) => {
            const mensagens = itens
                .map((item) => {
                    try {
                        return JSON.parse(item.mensagem_json) as Mensagem;
                    } catch {
                        return null;
                    }
                })
                .filter((m): m is Mensagem => !!m && typeof m.id === 'string' && typeof m.conversa_id === 'string');

            if (mensagens.length) void valor.engine.ingerirMensagensPush(mensagens);
        };

        void push.drenarInbox().then(ingerir).catch(() => undefined);

        const sub = push.aoReceberPush
            ? (push.aoReceberPush((item: { mensagem_json: string }) => ingerir([item])) as { remove(): void })
            : null;

        return () => sub?.remove?.();
    }, [valor]);

    // App volta do background: o Android mata websockets com o ecrã desligado.
    // Desligado → reconecta já (o 'connect' dispara o aoLigar). Se o socket
    // "sobreviveu", corre na mesma o aoLigar completo (rejoin + conversas/não-lidas
    // + delta + outbox) — as recuperadas seguem o fluxo normal de mensagem nova.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (estado: string) => {
            if (estado !== 'active') return;

            if (valor.socket.ligado) {
                void valor.engine.aoLigar().catch(() => undefined);
            } else {
                valor.socket.garantirLigado();
            }
        });

        return () => sub.remove();
    }, [valor]);

    const temaResolvido = useMemo(() => resolverTema(tema), [tema]);

    return (
        <Contexto.Provider
            value={{ ...valor, features, ligado, contactos: contactos ?? [], tema: temaResolvido, aoAbrirPartilha, aoVerPerfil, pesquisarContactos, textoSugestoes, renderHeaderConversa }}
        >
            <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
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

/** Como useMakaChat, mas devolve null fora do provider (layouts que montam antes do login). */
export function useMakaChatOpcional(): MakaChatContexto | null {
    return useContext(Contexto);
}

/** Tema resolvido (cores) — todos os componentes MakaChat leem daqui. */
export function useTema(): TemaResolvido {
    return useMakaChat().tema;
}
