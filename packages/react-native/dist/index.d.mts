import { StorageAdapter, Conversa, Mensagem, CursorConversa, ItemOutbox, Recibo, SyncEngine, MakaApi, MakaSocket, IdentidadeConfig, FlagFuncionalidade, AlvoParticipante, Typing, Presenca, EventoChamada, MetadadosPartilha, ObterToken, DadosEnvioMensagem, Anexo, Funcionalidade, Chamada, ParticipanteConversa } from '@hongayetu/makachat-core';
export * from '@hongayetu/makachat-core';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatListProps } from 'react-native';

/**
 * Superfície mínima do expo-sqlite (API moderna, síncrona-async) — declarada
 * estruturalmente para não obrigar o monorepo a instalar o expo. Em runtime
 * a app fornece `require('expo-sqlite').openDatabaseSync(nome)`.
 */
interface SQLiteDatabaseLike {
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, params?: unknown[]): Promise<unknown>;
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
/**
 * StorageAdapter sobre expo-sqlite: o SQLite é a fonte de verdade da UI
 * (padrão kanda-messaging). Os objetos são guardados como JSON com colunas
 * indexáveis extraídas — pesquisa full-text pode evoluir para FTS5 sem mudar
 * o contrato.
 */
declare class SqliteStorage implements StorageAdapter {
    private readonly db;
    constructor(db: SQLiteDatabaseLike);
    init(): Promise<void>;
    private criarEsquema;
    upsertConversas(conversas: Conversa[]): Promise<void>;
    listarConversas(arquivadas?: boolean): Promise<Conversa[]>;
    obterConversa(conversaId: string): Promise<Conversa | null>;
    removerConversa(conversaId: string): Promise<void>;
    upsertMensagens(mensagens: Mensagem[]): Promise<void>;
    removerMensagem(conversaId: string, mensagemId: string): Promise<void>;
    removerMensagemPorRef(conversaId: string, refCliente: string): Promise<void>;
    listarMensagens(conversaId: string, opcoes?: {
        antes_de?: string;
        limite?: number;
    }): Promise<Mensagem[]>;
    cursores(): Promise<CursorConversa[]>;
    adicionarOutbox(item: ItemOutbox): Promise<void>;
    listarOutbox(): Promise<ItemOutbox[]>;
    atualizarOutbox(item: ItemOutbox): Promise<void>;
    removerOutbox(refCliente: string): Promise<void>;
    aplicarRecibo(recibo: Recibo): Promise<void>;
    obterMeta(chave: string): Promise<string | null>;
    gravarMeta(chave: string, valor: string): Promise<void>;
    limpar(): Promise<void>;
}

/**
 * Tema por cores do MakaChat mobile — mesmo shape da web (MakaTema): cada
 * serviço ganha a sua identidade passando `tema` ao provider (ex.: Humbi
 * `{ primaria: '#f97316' }`). Consumido via useTema() nos componentes.
 */
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
    raio?: number;
}
type TemaResolvido = Required<MakaTema>;

interface MakaChatContexto {
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
}
interface MakaChatProviderProps {
    serviceKey: string;
    identity: IdentidadeConfig;
    getToken: ObterToken;
    /** storage alternativo (por omissão: expo-sqlite, um ficheiro por identidade) */
    storage?: StorageAdapter;
    tema?: MakaTema;
    contactos?: AlvoParticipante[];
    aoAbrirPartilha?: (metadados: MetadadosPartilha) => void;
    children: React.ReactNode;
}
declare function MakaChatProvider({ serviceKey, identity, getToken, storage, tema, contactos, aoAbrirPartilha, children, }: MakaChatProviderProps): React.JSX.Element;
declare function useMakaChat(): MakaChatContexto;
/** Tema resolvido (cores) — todos os componentes MakaChat leem daqui. */
declare function useTema(): TemaResolvido;

/** Re-renderiza quando o SyncEngine notifica uma nova versão do storage. */
declare function useVersaoChat(): number;
declare function useConversas(arquivadas?: boolean): Conversa[];
declare function useMensagens(conversaId: string | null, limite?: number): Mensagem[];
declare function useEnviarMensagem(): (dados: DadosEnvioMensagem, anexosPreview?: Anexo[]) => Promise<Mensagem>;
declare function useTypingConversa(conversaId: string | null): Typing | null;
declare function usePresenca(identidadeId: string | null): Presenca | null;
/** A UI esconde botões de funcionalidades desativadas para o serviço. */
declare function useFuncionalidadeAtiva(funcionalidade: Funcionalidade, tipoConversa?: string): boolean;
/** Estado da ligação socket (true = online). */
declare function useLigacao(): boolean;
/**
 * Reage a QUALQUER mensagem nova recebida, em qualquer ecrã da app — o
 * servidor emite para a sala da identidade, sem depender da conversa aberta.
 */
declare function useMensagemRecebida(handler: (mensagem: Mensagem) => void): void;
/** Total de não lidas em todas as conversas — badge global (tab bar, título...). */
declare function useTotalNaoLidas(): number;

/**
 * Lista da UI em FlatList — ordem e `inverted` fiáveis. O FlashList v2
 * (@shopify/flash-list) reordenava/scrollava mal esta lista (maintainVisible-
 * ContentPosition on por omissão), por isso não é usado. Reintroduzir mais
 * tarde só com config v2 validada em dispositivo.
 */
declare function ListaPerformante<T>(props: FlatListProps<T> & {
    estimatedItemSize?: number;
}): React.JSX.Element;
declare function Avatar({ nome, url, tamanho }: {
    nome: string;
    url?: string | null;
    tamanho?: number;
}): React.JSX.Element;
/** Nome + badge de verificação (metadados.verificado) — nem todos os serviços o usam. */
declare function NomeComBadge({ nome, metadados, estilo, numeroLinhas, }: {
    nome: string;
    metadados?: Record<string, unknown> | null;
    estilo?: object;
    numeroLinhas?: number;
}): React.JSX.Element;
declare function horaCurta(iso: string): string;
declare function rotuloDia(iso: string): string;
interface ItemSheet {
    icone: keyof typeof Ionicons.glyphMap;
    rotulo: string;
    destrutivo?: boolean;
    acao(): void;
}
/** Bottom sheet estilo WhatsApp via @gorhom/bottom-sheet: safe-area correto,
 * gesto de fechar, backdrop escurecido. API prop-driven (visivel/aoFechar). */
declare function Sheet({ visivel, aoFechar, titulo, itens, children, }: {
    visivel: boolean;
    aoFechar(): void;
    titulo?: string;
    itens?: ItemSheet[];
    children?: React.ReactNode;
}): React.JSX.Element;

interface ConversasScreenProps {
    arquivadas?: boolean;
    onAbrirConversa(conversa: Conversa): void;
    /** abre esta conversa ao montar (deep link/push) — equivalente mobile do ?conversa= */
    conversaInicial?: string | null;
    /** navegar para o modo arquivadas (a app decide: outro ecrã ou estado local) */
    onAbrirArquivadas?(): void;
    textoVazio?: string;
}
/** Lista de conversas estilo WhatsApp: pesquisa, badges, long-press, FAB nova conversa. */
declare function ConversasScreen({ arquivadas, onAbrirConversa, conversaInicial, onAbrirArquivadas, textoVazio }: ConversasScreenProps): React.JSX.Element;
declare function previewConversa(c: Conversa): string;

interface ChatScreenProps {
    conversaId: string;
    /** voltar à lista (header) */
    onVoltar?(): void;
    /** abrir info da conversa/grupo */
    onAbrirInfo?(conversa: Conversa): void;
    /** abrir outra conversa (ex.: mensagem direta a partir das reações) */
    onAbrirOutraConversa?(conversaId: string): void;
    /** iniciar/entrar em chamadas — liga ao ChamadasProvider da app */
    chamadas?: {
        iniciar(conversaId: string, tipo: 'audio' | 'video'): Promise<void>;
        entrar(chamadaId: string, tipo: 'audio' | 'video'): Promise<void>;
    } | null;
    /** compat: abrir anexos fora (por omissão usa galeria/player internos) */
    onAbrirAnexo?(url: string, tipo: string): void;
}
declare function ChatScreen({ conversaId, onVoltar, onAbrirInfo, onAbrirOutraConversa, chamadas, onAbrirAnexo }: ChatScreenProps): React.JSX.Element;

interface InfoConversaScreenProps {
    conversaId: string;
    onVoltar?(): void;
    /** depois de sair/eliminar — voltar à lista */
    onSaiu?(): void;
    onAbrirOutraConversa?(conversaId: string): void;
}
/** Info da conversa/grupo estilo WhatsApp: membros, papéis, foto, renomear, sair. */
declare function InfoConversaScreen({ conversaId, onVoltar, onSaiu, onAbrirOutraConversa }: InfoConversaScreenProps): React.JSX.Element;

interface EstadoChamada {
    chamada: Chamada;
    fase: 'a_receber' | 'a_ligar' | 'em_curso' | 'falhada';
    iniciador?: {
        nome: string;
        foto_url: string | null;
    };
}
interface ChamadasApi {
    iniciar(conversaId: string, tipo: 'audio' | 'video'): Promise<void>;
    entrar(chamadaId: string, tipo: 'audio' | 'video'): Promise<void>;
    /** retoma uma chamada vinda de push com a app fechada (atender/rejeitar/tocar) */
    retomarPendente(): Promise<void>;
    ativa: EstadoChamada | null;
    /** false quando a app não instalou @livekit/react-native */
    suportado: boolean;
}
declare function useChamadas(): ChamadasApi;
declare function useChamadasOpcional(): ChamadasApi | null;
/**
 * Chamadas LiveKit no mobile (padrão EiConnect): registerGlobals à primeira
 * utilização, AudioSession communication, Room adaptiveStream/dynacast com
 * reconexão progressiva (90s), câmara pausa em background. Mesmas regras da
 * web: sem permissões a chamada não avança; falha → "Chamada falhada".
 */
declare function ChamadasProvider({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;

/**
 * Player de mensagens de voz estilo WhatsApp: waveform, tempo, velocidade
 * 1x/1.5x/2x. Usa expo-audio (peer opcional) — sem ele mostra aviso.
 */
declare function ReprodutorAudio({ url, mimha }: {
    url: string;
    mimha: boolean;
}): React.JSX.Element;
/**
 * Gravador estilo WhatsApp (expo-audio): timer a andar, cancelar ou enviar.
 * Devolve o URI local + duração ao terminar.
 */
declare function GravadorAudio({ aoTerminar, aoCancelar }: {
    aoTerminar(uri: string, duracaoSegundos: number): void;
    aoCancelar(): void;
}): React.JSX.Element;

interface FicheiroLocal {
    uri: string;
    mime: string;
    nome: string;
    tipo: 'foto' | 'video' | 'audio' | 'ficheiro';
    largura?: number;
    altura?: number;
    duracao_segundos?: number;
}
declare function escolherFotosEVideos(): Promise<FicheiroLocal[]>;
declare function escolherFicheiro(): Promise<FicheiroLocal | null>;
declare function enviarAnexoLocal(api: MakaApi, ficheiro: FicheiroLocal, opcoes?: {
    duravel?: boolean;
}): Promise<Anexo>;
declare function LobbyFotos({ ficheiros, aoMudar, aoAdicionarMais, aoEnviar, aoFechar, aEnviar, insets }: {
    ficheiros: FicheiroLocal[];
    aoMudar(novos: FicheiroLocal[]): void;
    aoAdicionarMais(): void;
    aoEnviar(legenda: string): void;
    aoFechar(): void;
    aEnviar: boolean;
    insets: {
        top: number;
        bottom: number;
    };
}): React.JSX.Element;
/** Galeria com TODAS as fotos da conversa, paging horizontal + contador. */
declare function Galeria({ mensagens, inicialAnexoId, aoFechar, aoResponder, aoEncaminhar, insets }: {
    mensagens: Mensagem[];
    inicialAnexoId: string;
    aoFechar(): void;
    aoResponder?(mensagem: Mensagem): void;
    aoEncaminhar?(mensagem: Mensagem): void;
    insets: {
        top: number;
        bottom: number;
    };
}): React.JSX.Element;
/** Player de vídeo fullscreen (expo-video, opcional); sem o módulo abre no browser/OS. */
declare function VisualizadorVideo({ url, aoFechar, insets }: {
    url: string;
    aoFechar(): void;
    insets: {
        top: number;
        bottom: number;
    };
}): React.JSX.Element | null;

declare function CartaoRegistoChamada({ mensagem, aoLigar }: {
    mensagem: Mensagem;
    aoLigar?(tipo: 'audio' | 'video'): void;
}): React.JSX.Element;
interface BolhaProps {
    mensagem: Mensagem;
    minha: boolean;
    grupo: boolean;
    autor: ParticipanteConversa | null;
    outros: ParticipanteConversa[];
    primeiraDoBloco: boolean;
    ultimaDoBloco: boolean;
    respondida: Mensagem | null;
    destacada: boolean;
    aoResponder(): void;
    aoLongPress(): void;
    aoVerReacoes(): void;
    aoClicarCitacao(id: string): void;
    aoAbrirFoto(anexo: Anexo): void;
    aoAbrirUrl(url: string): void;
    aoLigar?(tipo: 'audio' | 'video'): void;
}
/** Bolha Messenger/WhatsApp: agrupamento, swipe para responder, long-press, reações. */
declare function Bolha({ mensagem: m, minha, grupo, autor, outros, primeiraDoBloco, ultimaDoBloco, respondida, destacada, aoResponder, aoLongPress, aoVerReacoes, aoClicarCitacao, aoAbrirFoto, aoAbrirUrl, aoLigar, }: BolhaProps): React.JSX.Element;

/**
 * Regista o dispositivo no MakaChat e liga a resposta ao vivo da notificação
 * (Android): o registo devolve um segredo que o serviço nativo usa para
 * enviar respostas com a app fechada (POST /v1/push/resposta).
 *
 * Chamar depois do login, com o token FCM da app:
 *   await ligarPushNativo(api, identidade, tokenFcm);
 */
declare function ligarPushNativo(api: MakaApi, identidade: IdentidadeConfig, tokenFcm: string, plataforma?: 'android' | 'ios'): Promise<boolean>;

/**
 * Sons do chat (herdados do Kanda) via expo-audio (peer opcional — sem ele,
 * silêncio). Os mp3 são copiados para dist pelo build (loader copy) e o
 * Metro empacota-os como assets.
 */
type NomeSom = 'recebida' | 'enviada' | 'vista' | 'a_chamar';
/** Efeito curto (recebida/enviada/vista). Falha em silêncio. */
declare function tocarSom(nome: NomeSom): void;
/** Toque de chamada em loop (a ligar / a receber). */
declare function comecarToque(): void;
declare function pararToque(): void;

export { Avatar, Bolha, CartaoRegistoChamada, type ChamadasApi, ChamadasProvider, ChatScreen, type ChatScreenProps, ConversasScreen, type ConversasScreenProps, Galeria, GravadorAudio, InfoConversaScreen, type InfoConversaScreenProps, ListaPerformante, LobbyFotos, type MakaChatContexto, MakaChatProvider, type MakaChatProviderProps, type MakaTema, NomeComBadge, type NomeSom, ReprodutorAudio, type SQLiteDatabaseLike, Sheet, SqliteStorage, VisualizadorVideo, comecarToque, enviarAnexoLocal, escolherFicheiro, escolherFotosEVideos, horaCurta, ligarPushNativo, pararToque, previewConversa, rotuloDia, tocarSom, useChamadas, useChamadasOpcional, useConversas, useEnviarMensagem, useFuncionalidadeAtiva, useLigacao, useMakaChat, useMensagemRecebida, useMensagens, usePresenca, useTema, useTotalNaoLidas, useTypingConversa, useVersaoChat };
