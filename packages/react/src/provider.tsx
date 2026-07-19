import {
    AlvoParticipante,
    Mensagem,
    MetadadosPartilha,
    FlagFuncionalidade,
    IdentidadeConfig,
    MakaApi,
    MakaSocket,
    MemoryStorage,
    ObterToken,
    EventoChamada,
    ParticipanteConversa,
    Presenca,
    StorageAdapter,
    SyncEngine,
    Typing,
} from '@hongayetu/makachat-core';
import { HubApi, HubSocket, useHongaHubOpcional } from '@hongayetu/honga-hub-react';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cssVarsDoTema, MakaTema } from './tema';
import { mostrarNotificacao } from './notificacoes';
import { tocarSom } from './sons';

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
    /** mensagens novas recebidas (deduplicadas, sem as próprias) — chega em QUALQUER página, sem UI de chat montada */
    subscreverMensagens(ouvinte: (mensagem: Mensagem) => void): () => void;
    /**
     * Subscreve um CANAL genérico do hub (chamadas, bloqueio, notificações do
     * serviço...) reutilizando o MESMO socket do chat. Equivalente ao
     * Echo.private(canal).listen(evento). Devolve uma função para cancelar.
     */
    subscribeToChannel(canal: string, evento: string, handler: (payload: any) => void): () => void;
    /** contactos fornecidos pela app (para criar grupos/conversas) */
    contactos: AlvoParticipante[];
    /** pesquisa de contactos NO serviço (API da app) — usada na nova conversa */
    pesquisarContactos?: (q: string) => Promise<AlvoParticipante[]>;
    /** contactos ONLINE segundo o serviço (ex.: quem sigo) — botão Online da lista */
    obterOnline?: () => Promise<AlvoParticipante[]>;
    /** ligação socket ativa? (para barras de estado offline) */
    ligado: boolean;
    /** clique num cartão de partilha/link — a app decide a navegação (deep link, router...) */
    aoAbrirPartilha?: (metadados: MetadadosPartilha) => void;
    /** "Ver perfil" no mini perfil/info — o serviço navega (ex.: kanda → /perfil/username) */
    aoVerPerfil?: (participante: ParticipanteConversa) => void;
    /** ConversaPainel regista-se como visível; o Dock usa isto para não duplicar */
    registarVisivel(conversaId: string): () => void;
    estaVisivel(conversaId: string): boolean;
}

const Contexto = createContext<MakaChatContexto | null>(null);

export interface MakaChatProviderProps {
    /** obrigatórios SEM <HongaHubProvider> por cima; com ele, herdam-se do hub */
    serviceKey?: string;
    identity?: IdentidadeConfig;
    getToken?: ObterToken;
    /** na web a fonte é o servidor; por omissão usa memória (sem persistência local) */
    storage?: StorageAdapter;
    tema?: MakaTema;
    /** contactos conhecidos do serviço (opcional) — usados em criar grupo/adicionar membros */
    contactos?: AlvoParticipante[];
    /** pesquisa de contactos NO serviço — a nova conversa usa isto com debounce */
    pesquisarContactos?: (q: string) => Promise<AlvoParticipante[]>;
    /** contactos online segundo o serviço — liga o botão Online na lista de conversas */
    obterOnline?: () => Promise<AlvoParticipante[]>;
    /** notificações nativas do browser quando a página está em background (default: false, opt-in) */
    notificacoesNativas?: boolean;
    /** clique na notificação — a app decide como abrir a conversa (ex.: useDock().abrir) */
    aoAbrirNotificacao?: (conversaId: string) => void;
    /** clique num cartão de partilha/link */
    aoAbrirPartilha?: (metadados: MetadadosPartilha) => void;
    aoVerPerfil?: (participante: ParticipanteConversa) => void;
    children: React.ReactNode;
}

/**
 * Estado do chat por HubSocket: wrappers de chat (MakaApi/MakaSocket), engine,
 * storage e listas de ouvintes. Vive fora do componente porque, em modo
 * HERDADO (socket do HongaHubProvider), o MakaChatProvider pode
 * desmontar/remontar (navegações, layouts) sem que o socket morra — recriar o
 * engine a cada montagem duplicaria handlers no socket partilhado. Cache pelo
 * HubSocket (estável entre remontagens): mesma ligação → mesmo engine.
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
    // props mutáveis lidas pelos callbacks do engine (atualizadas a cada render)
    notificacoesNativas: boolean;
    aoAbrirNotificacao?: (conversaId: string) => void;
}

const estadosPorSocket = new WeakMap<HubSocket, EstadoChat>();

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
        notificacoesNativas: false,
        aoAbrirNotificacao: undefined,
    };

    estado.engine = new SyncEngine(adapter, api, socket, {
        identidade,
        aoTyping: (typing) => estado.ouvintesTyping.forEach((o) => o(typing)),
        aoPresenca: (presenca) => estado.ouvintesPresenca.forEach((o) => o(presenca)),
        aoChamada: (evento) => estado.ouvintesChamadas.forEach((o) => o(evento)),
        aoMensagem: (mensagem: Mensagem) => {
            // evento global: qualquer página subscrita recebe, sem depender da conversa aberta
            estado.ouvintesMensagens.forEach((o) => o(mensagem));

            // som de mensagem recebida (página visível; em background é o sistema que avisa);
            // silenciosa (decisão do hub: não conta no badge) → sem som
            if (!mensagem.silenciosa && (typeof document === 'undefined' || !document.hidden)) tocarSom('recebida');

            // extra opcional: notificação nativa quando a página está em background
            if (!estado.notificacoesNativas || typeof document === 'undefined' || !document.hidden) return;

            void adapter.obterConversa(mensagem.conversa_id).then((conversa) => {
                const autor = conversa?.participantes.find((p) => p.identidade_id === mensagem.remetente_identidade_id);
                const previews: Record<string, string> = { foto: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', ficheiro: '📎 Ficheiro', chamada: '📞 Chamada' };
                const corpo = mensagem.tipo === 'texto' ? (mensagem.conteudo ?? '') : (previews[mensagem.tipo] ?? 'Nova mensagem');
                const titulo = conversa?.tipo === 'grupo' && conversa.titulo
                    ? `${autor?.nome ?? 'Alguém'} · ${conversa.titulo}`
                    : (autor?.nome ?? conversa?.titulo ?? 'Nova mensagem');

                mostrarNotificacao(titulo, { corpo, icone: autor?.foto_url ?? undefined, tag: mensagem.conversa_id }, () => {
                    estado.aoAbrirNotificacao?.(mensagem.conversa_id);
                });
            });
        },
        // 'vista': a minha mensagem foi lida pelo outro — só com a conversa aberta e página visível
        aoLido: (conversaId: string) => {
            if ((estado.visiveis.get(conversaId) ?? 0) > 0 && (typeof document === 'undefined' || !document.hidden)) {
                tocarSom('vista');
            }
        },
    });

    return estado;
}

function montarContexto(
    estado: EstadoChat,
    serviceKey: string,
    identidade: IdentidadeConfig,
): Omit<MakaChatContexto, 'features' | 'ligado' | 'contactos' | 'pesquisarContactos' | 'obterOnline' | 'aoAbrirPartilha' | 'aoVerPerfil'> {
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
        registarVisivel: (conversaId) => {
            estado.visiveis.set(conversaId, (estado.visiveis.get(conversaId) ?? 0) + 1);

            return () => {
                const atual = (estado.visiveis.get(conversaId) ?? 1) - 1;

                if (atual <= 0) {
                    estado.visiveis.delete(conversaId);
                } else {
                    estado.visiveis.set(conversaId, atual);
                }
            };
        },
        estaVisivel: (conversaId) => (estado.visiveis.get(conversaId) ?? 0) > 0,
    };
}

export function MakaChatProvider({ serviceKey, identity, getToken, storage, tema, contactos, pesquisarContactos, obterOnline, notificacoesNativas = false, aoAbrirNotificacao, aoAbrirPartilha, aoVerPerfil, children }: MakaChatProviderProps) {
    // HERANÇA: com um <HongaHubProvider> por cima, o chat reutiliza a ligação
    // global (socket/api/identidade/token do hub) — um único socket por app.
    // Sem hub, comportamento standalone clássico (cria a própria ligação no
    // namespace 'chat').
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
                estado = construirEstado(hub.api, hub.socket, hub.identidade, storage ?? new MemoryStorage());
                estadosPorSocket.set(hub.socket, estado);
            }

            return { estado, contexto: montarContexto(estado, hub.serviceKey, hub.identidade), socketProprio: null as HubSocket | null };
        }

        // standalone: cria a própria ligação genérica (namespace 'chat') + wrappers
        const hubApi = new HubApi(getToken!);

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

        const estado = construirEstado(hubApi, proprioHubSocket, identity!, storage ?? new MemoryStorage());
        estadoRef = estado;

        return { estado, contexto: montarContexto(estado, serviceKey!, identity!), socketProprio: proprioHubSocket };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hubSocket, serviceKey, identity?.id, identity?.tipo]);

    // props mutáveis lidas pelos callbacks do engine
    par.estado.notificacoesNativas = notificacoesNativas;
    par.estado.aoAbrirNotificacao = aoAbrirNotificacao;

    useEffect(() => {
        if (!par.estado.iniciado) {
            par.estado.iniciado = true;
            void par.estado.engine.iniciar();
        }

        // Features cache-first: lê do storage (imediato → sem flicker/botões
        // "desligados") e só depois atualiza da rede. O backend continua a ser
        // a fonte de verdade — o fetch regrava o cache e refresca a UI.
        // (na web o MemoryStorage não persiste entre reloads, mas beneficia remounts)
        void (async () => {
            const adapter = par.estado.adapter;
            await adapter.init().catch(() => undefined); // idempotente

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

    // Tab volta a visível (SÓ standalone — em modo herdado o hub trata disto e
    // avisa via subscreverLigado): browsers suspendem timers/websockets em
    // background; reconecta já, ou delta leve se o socket sobreviveu.
    useEffect(() => {
        if (!par.socketProprio || typeof document === 'undefined') return;

        const socket = par.socketProprio;

        const aoVisibilidade = () => {
            if (document.visibilityState !== 'visible') return;

            if (socket.ligado) {
                void par.estado.engine.aoLigar().catch(() => undefined);
            } else {
                socket.garantirLigado();
            }
        };

        document.addEventListener('visibilitychange', aoVisibilidade);

        return () => document.removeEventListener('visibilitychange', aoVisibilidade);
    }, [par]);

    const ligado = hub ? hub.ligado : ligadoLocal;

    return (
        <Contexto.Provider value={{ ...par.contexto, features, ligado, contactos: contactos ?? [], pesquisarContactos, obterOnline, aoAbrirPartilha, aoVerPerfil }}>
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

/** Como useMakaChat, mas devolve null fora do provider (layouts que montam sem sessão). */
export function useMakaChatOpcional(): MakaChatContexto | null {
    return useContext(Contexto);
}
