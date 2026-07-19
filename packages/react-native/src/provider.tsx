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
import { HubApi, HubSocket, useHongaHubOpcional } from '@hongayetu/honga-hub-react-native';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
    /**
     * Subscreve um CANAL genérico do hub (chamadas, bloqueio, notificações do
     * serviço...) reutilizando o MESMO socket do chat. Equivalente ao
     * Echo.private(canal).listen(evento). Devolve uma função para cancelar.
     */
    subscribeToChannel(canal: string, evento: string, handler: (payload: any) => void): () => void;
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
const alcanceGlobal = globalThis as unknown as {
    __makaChatCtx?: React.Context<MakaChatContexto | null>;
    __makaChatEstados?: WeakMap<HubSocket, EstadoChat>;
};
const Contexto = (alcanceGlobal.__makaChatCtx ??= createContext<MakaChatContexto | null>(null));

export interface MakaChatProviderProps {
    /** obrigatórios SEM <HongaHubProvider> por cima; com ele, herdam-se do hub */
    serviceKey?: string;
    identity?: IdentidadeConfig;
    getToken?: ObterToken;
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

/**
 * Estado do chat por socket: engine, storage e listas de ouvintes. Vive fora
 * do componente porque, em modo HERDADO (socket do HongaHubProvider), o
 * MakaChatProvider pode desmontar/remontar sem que o socket morra — recriar o
 * engine a cada montagem duplicaria handlers no socket partilhado. Cache por
 * socket (em globalThis pelo mesmo motivo do Contexto).
 */
interface EstadoChat {
    api: MakaApi;
    socket: MakaSocket;
    adapter: StorageAdapter;
    engine: SyncEngine;
    iniciado: boolean;
    visiveis: Map<string, number>;
    ouvintesTyping: Set<(typing: Typing) => void>;
    ouvintesPresenca: Set<(presenca: Presenca) => void>;
    ouvintesChamadas: Set<(evento: EventoChamada) => void>;
    ouvintesMensagens: Set<(mensagem: Mensagem) => void>;
}

const estadosPorSocket = (alcanceGlobal.__makaChatEstados ??= new WeakMap<HubSocket, EstadoChat>());

function construirEstado(hubApi: HubApi, hubSocket: HubSocket, identidade: IdentidadeConfig, adapter: StorageAdapter): EstadoChat {
    const api = new MakaApi(hubApi);
    const socket = new MakaSocket(hubSocket);

    const estado: EstadoChat = {
        api,
        socket,
        adapter,
        engine: null as unknown as SyncEngine,
        iniciado: false,
        visiveis: new Map(),
        ouvintesTyping: new Set(),
        ouvintesPresenca: new Set(),
        ouvintesChamadas: new Set(),
        ouvintesMensagens: new Set(),
    };

    estado.engine = new SyncEngine(adapter, api, socket, {
        identidade,
        aoTyping: (typing) => estado.ouvintesTyping.forEach((o) => o(typing)),
        aoPresenca: (presenca) => estado.ouvintesPresenca.forEach((o) => o(presenca)),
        aoChamada: (evento) => estado.ouvintesChamadas.forEach((o) => o(evento)),
        aoMensagem: (mensagem) => {
            estado.ouvintesMensagens.forEach((o) => o(mensagem));

            // mobile: só toca 'recebida' se estou DENTRO da conversa dela (visível);
            // fora da conversa → mudo (o push nativo trata o resto). silenciosa → sem som
            if (!mensagem.silenciosa && (estado.visiveis.get(mensagem.conversa_id) ?? 0) > 0) {
                tocarSom('recebida');
            }
        },
        // 'vista': a minha mensagem foi lida pelo outro — só com a conversa aberta
        aoLido: (conversaId) => {
            if ((estado.visiveis.get(conversaId) ?? 0) > 0) tocarSom('vista');
        },
    });

    return estado;
}

function montarContexto(
    estado: EstadoChat,
    serviceKey: string,
    identidade: IdentidadeConfig,
): Omit<MakaChatContexto, 'features' | 'ligado' | 'contactos' | 'tema' | 'aoAbrirPartilha' | 'aoVerPerfil' | 'pesquisarContactos' | 'textoSugestoes' | 'renderHeaderConversa'> {
    return {
        engine: estado.engine,
        api: estado.api,
        socket: estado.socket,
        serviceKey,
        identidade,
        subscreverTyping: (ouvinte) => {
            estado.ouvintesTyping.add(ouvinte);

            return () => estado.ouvintesTyping.delete(ouvinte);
        },
        subscreverPresenca: (ouvinte) => {
            estado.ouvintesPresenca.add(ouvinte);

            return () => estado.ouvintesPresenca.delete(ouvinte);
        },
        subscreverChamadas: (ouvinte) => {
            estado.ouvintesChamadas.add(ouvinte);

            return () => estado.ouvintesChamadas.delete(ouvinte);
        },
        subscreverMensagens: (ouvinte) => {
            estado.ouvintesMensagens.add(ouvinte);

            return () => estado.ouvintesMensagens.delete(ouvinte);
        },
        subscribeToChannel: (canal, evento, handler) => estado.socket.subscreverCanal(canal, evento, handler),
        registarVisivel: (conversaId: string) => {
            estado.visiveis.set(conversaId, (estado.visiveis.get(conversaId) ?? 0) + 1);

            return () => {
                const atual = (estado.visiveis.get(conversaId) ?? 1) - 1;

                if (atual <= 0) estado.visiveis.delete(conversaId);
                else estado.visiveis.set(conversaId, atual);
            };
        },
        estaVisivel: (conversaId: string) => (estado.visiveis.get(conversaId) ?? 0) > 0,
    };
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
    // HERANÇA: com um <HongaHubProvider> por cima, o chat reutiliza a ligação
    // global (socket/api/identidade/token do hub) — um único socket por app.
    // Sem hub, comportamento standalone clássico (cria a própria ligação).
    const hub = useHongaHubOpcional();

    const [features, setFeatures] = useState<FlagFuncionalidade[]>([]);
    const [ligadoLocal, setLigadoLocal] = useState(false);

    if (!hub && (!serviceKey || !identity || !getToken)) {
        throw new Error('MakaChatProvider: sem <HongaHubProvider> por cima, serviceKey/identity/getToken são obrigatórios');
    }

    if (hub && identity && (identity.id !== hub.identidade.id || identity.tipo !== hub.identidade.tipo)) {
        console.warn('[MakaChat] identity difere da do HongaHubProvider — a identidade do hub prevalece');
    }

    const hubSocket = hub?.socket ?? null;

    const par = useMemo(() => {
        if (hub) {
            let estado = estadosPorSocket.get(hub.socket);

            if (!estado) {
                estado = construirEstado(hub.api, hub.socket, hub.identidade, storage ?? abrirStoragePadrao(hub.serviceKey, hub.identidade));
                estadosPorSocket.set(hub.socket, estado);
            }

            return { estado, contexto: montarContexto(estado, hub.serviceKey, hub.identidade), socketProprio: null as HubSocket | null };
        }

        // standalone: cria a própria ligação genérica (namespace 'chat') + wrappers
        const hubApi = new HubApi(getToken!);
        const adapter = storage ?? abrirStoragePadrao(serviceKey!, identity!);

        let estadoRef: EstadoChat | null = null;
        const proprioHubSocket = new HubSocket({
            namespace: 'chat',
            obterToken: async () => {
                hubApi.invalidarSessao();

                return hubApi.sessao();
            },
            aoLigar: () => {
                setLigadoLocal(true);
                void estadoRef?.engine.aoLigar();
            },
            aoDesligar: () => setLigadoLocal(false),
        });

        const estado = construirEstado(hubApi, proprioHubSocket, identity!, adapter);
        estadoRef = estado;

        return { estado, contexto: montarContexto(estado, serviceKey!, identity!), socketProprio: proprioHubSocket };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hubSocket, serviceKey, identity?.id, identity?.tipo]);

    useEffect(() => {
        if (!par.estado.iniciado) {
            par.estado.iniciado = true;
            void par.estado.engine.iniciar();
        }

        // Features cache-first: lê do SQLite (imediato → sem flicker/botões
        // "desligados") e só depois atualiza da rede. O backend continua a ser
        // a fonte de verdade — o fetch regrava o cache e refresca a UI.
        void (async () => {
            const adapter = par.estado.adapter;
            await adapter.init().catch(() => undefined); // idempotente (CREATE TABLE IF NOT EXISTS)

            const raw = await adapter.obterMeta('features').catch(() => null);
            if (raw) {
                try {
                    const cacheadas = JSON.parse(raw) as FlagFuncionalidade[];
                    // só preenche o vazio inicial — nunca sobrescreve o fresh que já tenha chegado
                    setFeatures((prev) => (prev.length ? prev : cacheadas));
                } catch {
                    /* cache corrompido — ignora */
                }
            }

            try {
                const r = await par.estado.api.listarFeatures();
                setFeatures(r.features);
                void adapter.gravarMeta('features', JSON.stringify(r.features));
            } catch {
                /* offline → fica o cache */
            }
        })();

        if (par.socketProprio) {
            // standalone: o socket é nosso — liga-o e mata-o com o provider
            void par.socketProprio.ligar();

            return () => par.socketProprio!.desligar();
        }

        // herdado: pendurar o delta-sync na ligação do hub; se o socket já está
        // ligado (chat montou depois do hub ligar), correr o catch-up já
        const off = hub!.subscreverLigado(() => void par.estado.engine.aoLigar().catch(() => undefined));

        if (hub!.socket.ligado) {
            void par.estado.engine.aoLigar().catch(() => undefined);
        }

        return off;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [par]);

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

            if (mensagens.length) void par.estado.engine.ingerirMensagensPush(mensagens);
        };

        void push.drenarInbox().then(ingerir).catch(() => undefined);

        const sub = push.aoReceberPush
            ? (push.aoReceberPush((item: { mensagem_json: string }) => ingerir([item])) as { remove(): void })
            : null;

        return () => sub?.remove?.();
    }, [par]);

    // App volta do background (SÓ standalone — em modo herdado o hub trata
    // disto e avisa via subscreverLigado): o Android mata websockets com o
    // ecrã desligado. Desligado → reconecta já; se o socket "sobreviveu",
    // corre na mesma o aoLigar completo (rejoin + delta + outbox).
    useEffect(() => {
        if (!par.socketProprio) return;

        const socket = par.socketProprio;

        const sub = AppState.addEventListener('change', (estado: string) => {
            if (estado !== 'active') return;

            if (socket.ligado) {
                void par.estado.engine.aoLigar().catch(() => undefined);
            } else {
                socket.garantirLigado();
            }
        });

        return () => sub.remove();
    }, [par]);

    const temaResolvido = useMemo(() => resolverTema(tema), [tema]);
    const ligado = hub ? hub.ligado : ligadoLocal;

    return (
        <Contexto.Provider
            value={{ ...par.contexto, features, ligado, contactos: contactos ?? [], tema: temaResolvido, aoAbrirPartilha, aoVerPerfil, pesquisarContactos, textoSugestoes, renderHeaderConversa }}
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
