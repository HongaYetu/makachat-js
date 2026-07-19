import { SyncEngine, MakaApi, MakaSocket, IdentidadeConfig, FlagFuncionalidade, Typing, Presenca, EventoChamada, Mensagem, AlvoParticipante, MetadadosPartilha, ParticipanteConversa, ObterToken, StorageAdapter, Conversa, DadosEnvioMensagem, Anexo, Funcionalidade, Chamada } from '@hongayetu/makachat-core';
export * from '@hongayetu/makachat-core';
import * as react_jsx_runtime from 'react/jsx-runtime';
import React from 'react';

/** Tema por cores — cada serviço ganha a sua identidade. */
interface MakaTema {
    primaria?: string;
    primariaContraste?: string;
    fundo?: string;
    superficie?: string;
    bolhaMinha?: string;
    bolhaMinhaTexto?: string;
    bolhaOutro?: string;
    texto?: string;
    textoSuave?: string;
    raio?: string;
    fonte?: string;
}

interface MakaChatContexto {
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
interface MakaChatProviderProps {
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
declare function MakaChatProvider({ serviceKey, identity, getToken, storage, tema, contactos, pesquisarContactos, obterOnline, notificacoesNativas, aoAbrirNotificacao, aoAbrirPartilha, aoVerPerfil, children }: MakaChatProviderProps): react_jsx_runtime.JSX.Element;
declare function useMakaChat(): MakaChatContexto;
/** Como useMakaChat, mas devolve null fora do provider (layouts que montam sem sessão). */
declare function useMakaChatOpcional(): MakaChatContexto | null;

/** Estado da ligação socket (true = online) — hub-first, com fallback ao chat. */
declare function useLigacao(): boolean;
/**
 * Subscreve um canal genérico do hub (chamadas, bloqueio, notificações...) e
 * chama `handler` a cada `evento`. O handler é estável via ref — só re-subscreve
 * se `canal`/`evento` mudarem, não a cada render. Resolve o HongaHubProvider
 * primeiro; sem ele, cai no socket do MakaChatProvider (standalone).
 */
declare function useCanalHub(canal: string, evento: string, handler: (payload: any) => void): void;
/**
 * true só quando estamos desligados há mais de `atrasoMs` — evita falsos
 * positivos do banner "sem ligação" em reconexões normais (arranque, voltar
 * do background); desliga no instante em que a ligação volta.
 */
declare function useSemLigacao(atrasoMs?: number): boolean;
declare function useVersaoChat(): number;
declare function useConversas(arquivadas?: boolean): Conversa[];
declare function useMensagens(conversaId: string | null, limite?: number): Mensagem[];
declare function useEnviarMensagem(): (dados: DadosEnvioMensagem, anexosPreview?: Anexo[]) => Promise<Mensagem>;
declare function useTypingConversa(conversaId: string | null): Typing | null;
declare function usePresenca(identidadeId: string | null): Presenca | null;
/** A UI esconde botões de funcionalidades desativadas para o serviço. */
declare function useFuncionalidadeAtiva(funcionalidade: Funcionalidade, tipoConversa?: string): boolean;
/**
 * Reage a QUALQUER mensagem nova recebida, em qualquer página da app —
 * o servidor emite para a sala da identidade, não é preciso conversa aberta
 * nem UI de chat montada. Ex.: toasts próprios, badge na navbar, sons.
 */
declare function useMensagemRecebida(handler: (mensagem: Mensagem) => void): void;
/** Total de mensagens não lidas em todas as conversas — badge global (navbar, título da página...). */
declare function useTotalNaoLidas(): number;
/** Total de não lidas SEM exigir o provider — devolve 0 fora dele (badges em layouts). */
declare function useTotalNaoLidasOpcional(): number;

interface MakaChatConversasProps {
    arquivadas?: boolean;
    conversaAtivaId?: string | null;
    onAbrirConversa(conversa: Conversa): void;
    /** título do estado vazio (padrão: "Ainda sem conversas") */
    tituloVazio?: string;
    /** subtítulo do estado vazio */
    textoVazio?: string;
    /** estado vazio COMPLETAMENTE custom da app — substitui o do SDK */
    renderVazio?(): React.ReactNode;
}
declare function MakaChatConversas({ arquivadas, conversaAtivaId, onAbrirConversa, tituloVazio, textoVazio, renderVazio }: MakaChatConversasProps): react_jsx_runtime.JSX.Element;
interface ConversaPainelProps {
    conversaId: string;
    compacto?: boolean;
    aoFechar?(): void;
    /** box do dock: botão de minimizar no header (header único, sem barra própria da box) */
    aoMinimizar?(): void;
    /** abrir outra conversa (ex.: "mensagem" a partir do modal de reações) */
    aoAbrirOutraConversa?(conversaId: string): void;
}
declare function ConversaPainel({ conversaId, compacto, aoFechar, aoMinimizar, aoAbrirOutraConversa }: ConversaPainelProps): react_jsx_runtime.JSX.Element;
/** Compat: nome antigo. */
declare function MakaChatConversa({ conversaId }: {
    conversaId: string;
}): react_jsx_runtime.JSX.Element;
declare function AvatarWeb({ nome, url, tamanho, grupo }: {
    nome: string;
    url?: string | null;
    tamanho?: number;
    grupo?: boolean;
}): react_jsx_runtime.JSX.Element;

interface EstadoChamada {
    chamada: Chamada;
    fase: 'a_receber' | 'a_ligar' | 'a_chamar' | 'em_curso' | 'falhada' | 'ocupado';
    iniciador?: {
        nome: string;
        foto_url: string | null;
    };
}
interface ChamadasApi {
    iniciar(conversaId: string, tipo: 'audio' | 'video'): Promise<void>;
    /** entra numa chamada de grupo já a decorrer (banner "a decorrer") */
    entrar(chamadaId: string, tipo: 'audio' | 'video'): Promise<void>;
    ativa: EstadoChamada | null;
}
declare function useChamadasOpcional(): ChamadasApi | null;
declare function useChamadas(): ChamadasApi;
/**
 * Janela de chamada flutuante e arrastável (estilo Messenger): não bloqueia o
 * site; expande para ecrã inteiro ou minimiza para uma pill com a duração.
 */
declare function ChamadasProvider({ children }: {
    children: React.ReactNode;
}): react_jsx_runtime.JSX.Element;

interface BoxProps {
    /** abre esta conversa (ex.: vindo de um botão "Falar com a loja") */
    conversaAbertaId?: string | null;
    /** nome do parâmetro de query string que abre uma conversa ao carregar (default 'conversa'; false desliga) */
    queryParam?: string | false;
}
/** Página inteira: ocupa o viewport todo e ignora o layout do site. */
declare function MakaChatBoxFull({ conversaAbertaId, queryParam }?: BoxProps): react_jsx_runtime.JSX.Element;
/** Preenche 100% do contentor onde for montado (ex.: área útil de um admin). */
declare function MakaChatBoxMin({ conversaAbertaId, queryParam }?: BoxProps): react_jsx_runtime.JSX.Element;
interface DockApi {
    abrir(conversaId: string, opcoes?: {
        minimizada?: boolean;
    }): void;
    fechar(conversaId: string): void;
}
declare function useDock(): DockApi;
/** Como useDock, mas devolve null fora do Dock (páginas sem sessão/provider). */
declare function useDockOpcional(): DockApi | null;
interface MakaChatDockProps {
    /** abre uma box automaticamente quando chega mensagem nova (default true) */
    autoAbrir?: boolean;
    /** query string que abre uma box ao carregar (default false — evita duplicar com BoxMin/BoxFull) */
    queryParam?: string | false;
    /** false = esconde launcher e boxes mantendo o contexto/estado (ex.: página onde já há BoxMin/BoxFull) */
    visivel?: boolean;
    maxBoxes?: number;
    children?: React.ReactNode;
}
/**
 * Boxes múltiplas fixas no canto inferior direito: launcher com não lidas e
 * conversas recentes; boxes lado a lado, minimizáveis. Convive com BoxMin.
 */
declare function MakaChatDock({ autoAbrir, visivel, maxBoxes, queryParam, children }: MakaChatDockProps): react_jsx_runtime.JSX.Element;

/**
 * Notificações nativas do browser — permitem avisar o utilizador de mensagens
 * e chamadas mesmo quando está noutra página/tab (o provider continua montado
 * no layout, ou a página está em background).
 */
declare function notificacoesSuportadas(): boolean;
/** Pede permissão ao utilizador (chamar num gesto: clique/tap). */
declare function pedirPermissaoNotificacoes(): Promise<boolean>;
/** Mostra uma notificação se houver permissão; clique foca a janela. */
declare function mostrarNotificacao(titulo: string, opcoes: {
    corpo?: string;
    icone?: string;
    tag?: string;
}, aoClicar?: () => void): void;

/**
 * Sons do chat (herdados do Kanda): mensagem recebida/enviada/vista e toque
 * de chamada. Os ficheiros são publicados em dist/sons e resolvidos via
 * import.meta.url (bundlers ESM tratam o asset).
 */
type NomeSom = 'recebida' | 'enviada' | 'vista' | 'a_chamar' | 'toque_receber';
/** a_chamar = ringback de QUEM LIGA; toque_receber = ring de quem recebe. */
type TipoToque = 'ligar' | 'receber';
/** Efeito curto (recebida/enviada/vista). Falha em silêncio (autoplay/ambiente). */
declare function tocarSom(nome: NomeSom): void;
/** Toque de chamada em loop — 'ligar' (ringback de quem liga) ou 'receber' (ring). */
declare function comecarToque(tipo?: TipoToque): void;
declare function pararToque(): void;

export { AvatarWeb, type BoxProps, ChamadasProvider, ConversaPainel, type ConversaPainelProps, MakaChatBoxFull, MakaChatBoxMin, type MakaChatContexto, MakaChatConversa, MakaChatConversas, type MakaChatConversasProps, MakaChatDock, type MakaChatDockProps, MakaChatProvider, type MakaChatProviderProps, type MakaTema, type NomeSom, comecarToque, mostrarNotificacao, notificacoesSuportadas, pararToque, pedirPermissaoNotificacoes, tocarSom, useCanalHub, useChamadas, useChamadasOpcional, useConversas, useDock, useDockOpcional, useEnviarMensagem, useFuncionalidadeAtiva, useLigacao, useMakaChat, useMakaChatOpcional, useMensagemRecebida, useMensagens, usePresenca, useSemLigacao, useTotalNaoLidas, useTotalNaoLidasOpcional, useTypingConversa, useVersaoChat };
