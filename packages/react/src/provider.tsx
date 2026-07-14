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
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
    serviceKey: string;
    identity: IdentidadeConfig;
    getToken: ObterToken;
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

export function MakaChatProvider({ serviceKey, identity, getToken, storage, tema, contactos, pesquisarContactos, obterOnline, notificacoesNativas = false, aoAbrirNotificacao, aoAbrirPartilha, aoVerPerfil, children }: MakaChatProviderProps) {
    const [features, setFeatures] = useState<FlagFuncionalidade[]>([]);
    const [ligado, setLigado] = useState(false);
    const visiveis = useRef(new Map<string, number>());
    const ouvintesTyping = useRef(new Set<(typing: Typing) => void>());
    const ouvintesPresenca = useRef(new Set<(presenca: Presenca) => void>());
    const ouvintesChamadas = useRef(new Set<(evento: EventoChamada) => void>());
    const ouvintesMensagens = useRef(new Set<(mensagem: Mensagem) => void>());
    // refs para o engine (criado uma vez) ver sempre as props atuais
    const notifAtivas = useRef(notificacoesNativas);
    notifAtivas.current = notificacoesNativas;
    const aoAbrirNotif = useRef(aoAbrirNotificacao);
    aoAbrirNotif.current = aoAbrirNotificacao;

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
            aoMensagem: (mensagem: Mensagem) => {
                // evento global: qualquer página subscrita recebe, sem depender da conversa aberta
                ouvintesMensagens.current.forEach((o) => o(mensagem));

                // som de mensagem recebida (página visível; em background é o sistema que avisa);
                // silenciosa (decisão do hub: não conta no badge) → sem som
                if (!mensagem.silenciosa && (typeof document === 'undefined' || !document.hidden)) tocarSom('recebida');

                // extra opcional: notificação nativa quando a página está em background
                if (!notifAtivas.current || typeof document === 'undefined' || !document.hidden) return;

                void adapter.obterConversa(mensagem.conversa_id).then((conversa) => {
                    const autor = conversa?.participantes.find((p) => p.identidade_id === mensagem.remetente_identidade_id);
                    const previews: Record<string, string> = { foto: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', ficheiro: '📎 Ficheiro', chamada: '📞 Chamada' };
                    const corpo = mensagem.tipo === 'texto' ? (mensagem.conteudo ?? '') : (previews[mensagem.tipo] ?? 'Nova mensagem');
                    const titulo = conversa?.tipo === 'grupo' && conversa.titulo
                        ? `${autor?.nome ?? 'Alguém'} · ${conversa.titulo}`
                        : (autor?.nome ?? conversa?.titulo ?? 'Nova mensagem');

                    mostrarNotificacao(titulo, { corpo, icone: autor?.foto_url ?? undefined, tag: mensagem.conversa_id }, () => {
                        aoAbrirNotif.current?.(mensagem.conversa_id);
                    });
                });
            },
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
            subscreverMensagens: (ouvinte) => {
                ouvintesMensagens.current.add(ouvinte);

                return () => ouvintesMensagens.current.delete(ouvinte);
            },
            subscribeToChannel: (canal, evento, handler) => socket.subscreverCanal(canal, evento, handler),
            ligado: false,
            contactos: [],
            aoAbrirPartilha: undefined,
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

    // Tab volta a visível: browsers suspendem timers/websockets em tabs em background.
    // Reconecta já; se o socket sobreviveu, delta leve para recuperar eventos perdidos.
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const aoVisibilidade = () => {
            if (document.visibilityState !== 'visible') return;

            if (valor.socket.ligado) {
                // aoLigar completo: rejoin + conversas/não-lidas + delta + outbox —
                // as recuperadas seguem o fluxo normal de mensagem nova
                void valor.engine.aoLigar().catch(() => undefined);
            } else {
                valor.socket.garantirLigado();
            }
        };

        document.addEventListener('visibilitychange', aoVisibilidade);

        return () => document.removeEventListener('visibilitychange', aoVisibilidade);
    }, [valor]);

    return (
        <Contexto.Provider value={{ ...valor, features, ligado, contactos: contactos ?? [], pesquisarContactos, obterOnline, aoAbrirPartilha, aoVerPerfil }}>
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
