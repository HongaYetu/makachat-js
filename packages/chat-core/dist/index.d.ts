import { HubApi, CredenciaisSessao, HubSocket, Ack, IdentidadeConfig } from '@hongayetu/honga-hub-core';
export { Ack, CredenciaisSessao, ErroApi, IdentidadeConfig, ObterToken, uuid } from '@hongayetu/honga-hub-core';

/** Tipos do módulo CHAT (MakaChat) — espelham o PROTOCOL.md do Honga Hub.
 *  Os tipos genéricos de ligação/token/ack vêm de @hongayetu/honga-hub-core e
 *  são re-exportados aqui para os consumidores do chat os obterem num só sítio. */

interface Anexo {
    id: string;
    tipo: 'foto' | 'video' | 'audio' | 'ficheiro';
    nome_ficheiro?: string | null;
    mime: string | null;
    tamanho_bytes: number | null;
    largura: number | null;
    altura: number | null;
    duracao_segundos: number | null;
    blurhash: string | null;
    estado: 'pendente' | 'pronto' | 'falhou';
    url: string | null;
}
type TipoMensagem = 'texto' | 'foto' | 'video' | 'audio' | 'ficheiro' | 'partilha' | 'link' | 'sistema' | 'chamada';
/**
 * Attach genérico: referência a uma entidade de um serviço, que "fica" com a
 * mensagem e é renderizada como cartão tocável. Ao tocar, o host decide como
 * abrir (registo por `tipo`); se não tratar, o SDK abre um modal genérico.
 *
 * É deliberadamente genérico — hoje serve estados/histórias, amanhã pode
 * referenciar publicações, produtos, bilhetes, etc. sem tocar no schema.
 */
interface Referencia {
    /** discriminador: 'estado' | 'publicacao' | 'produto' | 'bilhete' | ... */
    tipo: string;
    /** id da entidade no serviço de origem */
    id: string;
    titulo?: string;
    subtitulo?: string;
    imagem_url?: string;
    /** presente quando o attach nasce de uma reação (ex.: ❤️) */
    emoji?: string;
    /** deeplink/fallback quando o host não trata o tipo */
    url?: string;
    /** payload específico do tipo, usado pelo modal/host */
    dados?: Record<string, unknown>;
    /** versão do envelope, para evolução futura */
    versao?: number;
}
/**
 * Contexto da conversa entregue ao host quando se abre uma {@link Referencia},
 * para o host resolver o alvo sem depender apenas de `dados` (ex.: descobrir o
 * autor de um estado = o participante que NÃO enviou a resposta).
 */
interface ContextoAberturaReferencia {
    conversaId: string;
    /** identidade que enviou a mensagem que carrega o attach */
    remetenteId: string;
    /** participantes exceto o próprio (mesma semântica de `outros` nas bolhas) */
    outros: ParticipanteConversa[];
}
/** Payload de mensagens partilha/link (cartão genérico na UI). */
interface MetadadosPartilha {
    contexto_tipo?: string;
    contexto_id?: string;
    titulo?: string;
    subtitulo?: string;
    imagem_url?: string;
    url?: string;
    /** attach genérico de primeira classe (ver {@link Referencia}) */
    referencia?: Referencia;
    [extra: string]: unknown;
}
/** Estado local de envio (não vem do servidor). */
type EstadoEnvio = 'a_enviar' | 'enviada' | 'falhou';
interface Reacao {
    identidade_id: string;
    emoji: string;
}
interface Mensagem {
    id: string;
    conversa_id: string;
    remetente_identidade_id: string;
    tipo: TipoMensagem;
    conteudo: string | null;
    resposta_a_id: string | null;
    encaminhada_de_id: string | null;
    ref_cliente: string;
    editada_em: string | null;
    eliminada: boolean;
    /**
     * Decidido pelo hub na criação: mensagem que NÃO conta como não lida
     * (badge) — os clientes também não tocam som nem alertam (ex.: registos
     * de chamada e outros eventos de sistema sem contagem).
     */
    silenciosa?: boolean;
    metadados?: MetadadosPartilha | null;
    reacoes: Reacao[];
    anexos: Anexo[];
    criada_em: string;
    /** Só local: presente enquanto a mensagem não foi confirmada pelo servidor */
    estado_envio?: EstadoEnvio;
}
interface ParticipanteConversa {
    identidade_id: string;
    id_externo: string;
    tipo: string;
    nome: string;
    foto_url: string | null;
    /** extras vindos da estratégia de resolução do serviço (ex.: telefone) */
    metadados?: Record<string, unknown> | null;
    papel: 'dono' | 'admin' | 'membro';
    ultima_leitura_mensagem_id: string | null;
    ultima_entrega_mensagem_id: string | null;
    saiu_em: string | null;
}
interface PreferenciasParticipante {
    papel: string;
    mensagens_nao_lidas: number;
    arquivada: boolean;
    fixada: boolean;
    silenciada_ate: string | null;
    ultima_leitura_mensagem_id: string | null;
}
interface PreviewMensagem {
    id: string;
    tipo: TipoMensagem;
    conteudo: string | null;
    eliminada: boolean;
    remetente_identidade_id: string;
    criada_em: string;
}
interface Conversa {
    id: string;
    tipo: 'privada' | 'grupo';
    titulo: string | null;
    foto_url: string | null;
    contexto_tipo: string | null;
    contexto_id: string | null;
    /** override de funcionalidades por conversa (ex.: chat da corrida com
     *  `{'media.ficheiro': false}`) — a UI faz merge com as flags do serviço. */
    funcionalidades?: Record<string, boolean> | null;
    /** fechada pelo serviço (ex.: sem encomendas ativas) — histórico visível, envio bloqueado; undefined = aberta (cache antiga) */
    estado?: 'aberta' | 'fechada';
    fecho_motivo?: string | null;
    fechada_em?: string | null;
    ultima_atividade_em: string;
    criada_em: string;
    participantes: ParticipanteConversa[];
    participante?: PreferenciasParticipante;
    ultima_mensagem?: PreviewMensagem | null;
    /** chamada a tocar/em curso nesta conversa (banner "entrar") */
    chamada_ativa?: {
        id: string;
        tipo: 'audio' | 'video';
        estado: string;
        iniciada_em: string;
        atendida_em: string | null;
    } | null;
}
interface Recibo {
    conversa_id: string;
    identidade_id: string;
    entregue_ate: string | null;
    lido_ate: string | null;
}
interface Presenca {
    identidade_id: string;
    online: boolean;
    ultimo_visto_em: string | null;
}
interface Typing {
    conversa_id: string;
    identidade_id: string;
    ativo: boolean;
}
interface Chamada {
    id: string;
    conversa_id: string;
    iniciador_identidade_id: string;
    tipo: 'audio' | 'video';
    estado: 'a_tocar' | 'em_curso' | 'terminada' | 'perdida' | 'rejeitada' | 'cancelada' | 'falhada' | 'ocupada';
    iniciada_em: string;
    atendida_em: string | null;
    terminada_em: string | null;
    duracao_segundos: number | null;
}
interface EventoChamada {
    evento: 'iniciada' | 'a_tocar' | 'atendida' | 'rejeitada' | 'terminada' | 'participante_saiu';
    chamada: Chamada;
    iniciador?: {
        identidade_id: string;
        nome: string;
        foto_url: string | null;
    };
    identidade_id?: string;
}
interface RespostaChamada {
    chamada: Chamada;
    livekit_token: string | null;
    ws_url: string | null;
    /** 1:1: o destinatário está online? (autor: offline → "A ligar…"; online → "A chamar…") */
    destinatario_online?: boolean;
    /** o destinatário já estava numa chamada → não tocou (autor vê "Ocupado") */
    ocupado?: boolean;
}
interface FlagFuncionalidade {
    funcionalidade: string;
    tipo_conversa: string;
    ativo: boolean;
    limites: unknown;
}
interface AlvoParticipante {
    id_externo: string;
    tipo: string;
    nome?: string;
    foto?: string | null;
}
interface DadosEnvioMensagem {
    conversa_id: string;
    tipo?: TipoMensagem;
    conteudo?: string;
    resposta_a_id?: string;
    encaminhada_de_id?: string;
    anexo_ids?: string[];
    /** payload de partilha/link (≤4KB) */
    metadados?: MetadadosPartilha;
}
interface ItemOutbox {
    ref_cliente: string;
    conversa_id: string;
    dados: DadosEnvioMensagem;
    criado_em: string;
    tentativas: number;
}
interface CursorConversa {
    conversa_id: string;
    ultimo_id: string | null;
}
/**
 * Comparação de UUIDv7 (ordenáveis lexicograficamente) — base dos recibos
 * por watermark: lida ⇔ lido_ate >= mensagem.id.
 */
declare function idMaiorOuIgual(a: string | null, b: string): boolean;
declare function rotuloTipoIdentidade(tipo: string): string;
/** Estado de entrega/leitura de uma mensagem por participante (relatório de entrega). */
interface ReciboParticipante {
    identidade_id: string;
    nome: string;
    foto_url: string | null;
    tipo: string;
    entregue: boolean;
    vista: boolean;
}
/** Item da tab Links da info (mensagem com subtipo 'link' no hub). */
interface MensagemLink {
    id: string;
    tipo: string;
    conteudo: string | null;
    metadados: MetadadosPartilha | null;
    remetente_identidade_id: string;
    criada_em: string;
}
/** Divide texto em segmentos, isolando URLs (linkify nas bolhas). */
declare function dividirLinks(texto: string): {
    texto: string;
    url?: string;
}[];
/**
 * Resolve o attach genérico (cartão) de uma mensagem, de forma retrocompatível:
 * - novo formato: `metadados.referencia`;
 * - legado: mensagens `partilha`/`link` (ou com `contexto_tipo` plano) →
 *   adaptadas para {@link Referencia}.
 * Devolve `null` quando a mensagem não tem cartão para mostrar.
 */
declare function referenciaDaMensagem(mensagem: Mensagem): Referencia | null;

/**
 * Nomes de eventos socket do módulo CHAT do Honga Hub — fonte única,
 * alinhada com o PROTOCOL.md. Todos os eventos levam o prefixo do módulo
 * (`chat:`); o hub multiplexa vários módulos (chat, streaming, ...).
 */
declare const EVENTOS_CLIENTE: {
    readonly ENVIAR: "chat:mensagem:enviar";
    readonly EDITAR: "chat:mensagem:editar";
    readonly ELIMINAR: "chat:mensagem:eliminar";
    readonly ENTREGUES: "chat:mensagens:entregues";
    readonly LIDAS: "chat:mensagens:lidas";
    readonly REAGIR: "chat:reacao:alternar";
    readonly TYPING: "chat:typing";
    readonly ENTRAR_CONVERSA: "chat:conversa:entrar";
    readonly SYNC: "chat:sync:desde";
};
declare const EVENTOS_SERVIDOR: {
    readonly MENSAGEM_NOVA: "chat:mensagem:nova";
    readonly MENSAGEM_ATUALIZADA: "chat:mensagem:atualizada";
    readonly MENSAGEM_ELIMINADA: "chat:mensagem:eliminada";
    readonly RECIBO: "chat:recibo:atualizado";
    readonly REACAO: "chat:reacao:atualizada";
    readonly TYPING: "chat:typing";
    readonly PRESENCA: "chat:presenca";
    readonly CONVERSA_ATUALIZADA: "chat:conversa:atualizada";
    /** conversa eliminada pelo serviço (ex.: fim da corrida) — remover localmente */
    readonly CONVERSA_ELIMINADA: "chat:conversa:eliminada";
    readonly PARTICIPANTE_ADICIONADO: "chat:participante:adicionado";
    readonly PARTICIPANTE_REMOVIDO: "chat:participante:removido";
    readonly PARTICIPANTE_ATUALIZADO: "chat:participante:atualizado";
    readonly CHAMADA_INICIADA: "chat:chamada:iniciada";
    /** o dispositivo do destinatário confirma que está a tocar → autor: A ligar… → A chamar… */
    readonly CHAMADA_A_TOCAR: "chat:chamada:a_tocar";
    readonly CHAMADA_ATENDIDA: "chat:chamada:atendida";
    readonly CHAMADA_REJEITADA: "chat:chamada:rejeitada";
    readonly CHAMADA_TERMINADA: "chat:chamada:terminada";
    readonly CHAMADA_PARTICIPANTE_SAIU: "chat:chamada:participante_saiu";
};
declare const FUNCIONALIDADES: readonly ["media.foto", "media.video", "media.ficheiro", "media.audio", "reacoes", "encaminhar", "grupos", "chamadas.audio", "chamadas.video", "chamadas.partilha_ecra", "conversas.eliminar", "mensagens.eliminar", "conversas.criar", "presenca"];
type Funcionalidade = (typeof FUNCIONALIDADES)[number];

/**
 * Cliente REST do módulo CHAT. Compõe sobre o {@link HubApi} genérico
 * (sessão/token/`pedir`) e acrescenta os endpoints de chat. Delega
 * `sessao`/`invalidarSessao`/`pedir` para manter compatibilidade com quem
 * usava o antigo MakaApi. Uma app sem chat nunca instancia isto.
 */
declare class MakaApi {
    private readonly hub;
    constructor(hub: HubApi);
    sessao(): Promise<CredenciaisSessao>;
    invalidarSessao(): void;
    pedir<T>(caminho: string, init?: RequestInit): Promise<T>;
    registarDispositivo(dados: Parameters<HubApi['registarDispositivo']>[0]): Promise<{
        segredo_resposta?: string;
    }>;
    removerDispositivo(token: string): Promise<{
        removido: boolean;
    }>;
    listarConversas(opcoes?: {
        cursor?: string;
        arquivadas?: boolean;
        limite?: number;
        q?: string;
    }): Promise<{
        conversas: Conversa[];
        proximo_cursor: string | null;
    }>;
    obterConversa(conversaId: string): Promise<{
        conversa: Conversa;
    }>;
    criarPrivada(participante: AlvoParticipante): Promise<{
        conversa: Conversa;
    }>;
    criarGrupo(titulo: string, participantes: AlvoParticipante[]): Promise<{
        conversa: Conversa;
    }>;
    /** Media da conversa por tipo — tabs da info (Fotos/Ficheiros/Áudios/Links). */
    listarMedia(conversaId: string, tipo: 'fotos' | 'videos' | 'audios' | 'ficheiros' | 'links', opcoes?: {
        antes_de?: string;
        limite?: number;
    }): Promise<{
        anexos?: (Anexo & {
            mensagem_id: string;
        })[];
        links?: MensagemLink[];
    }>;
    /** Relatório de entrega de uma mensagem (grupos): quem entregou / quem viu. */
    recibosDaMensagem(conversaId: string, mensagemId: string): Promise<{
        recibos: ReciboParticipante[];
    }>;
    listarMensagens(conversaId: string, opcoes?: {
        antes_de?: string;
        limite?: number;
    }): Promise<{
        mensagens: Mensagem[];
        proximo_cursor: string | null;
    }>;
    pesquisarMensagens(conversaId: string, q: string): Promise<{
        mensagens: Mensagem[];
    }>;
    atualizarGrupo(conversaId: string, dados: {
        titulo?: string;
        foto_url?: string | null;
    }): Promise<{
        conversa: Conversa;
    }>;
    atualizarPreferencias(conversaId: string, dados: {
        arquivada?: boolean;
        fixada?: boolean;
        silenciada_ate?: string | null;
    }): Promise<{
        conversa: Conversa;
    }>;
    adicionarParticipantes(conversaId: string, participantes: AlvoParticipante[]): Promise<{
        conversa: Conversa;
    }>;
    /** Promove/despromove um membro do grupo (papel do dono é intocável). */
    mudarPapel(conversaId: string, identidadeId: string, papel: 'admin' | 'membro'): Promise<{
        conversa: Conversa;
    }>;
    removerParticipante(conversaId: string, identidadeId: string): Promise<unknown>;
    sairDaConversa(conversaId: string): Promise<unknown>;
    eliminarConversa(conversaId: string): Promise<unknown>;
    marcarNaoLida(conversaId: string): Promise<{
        mensagens_nao_lidas: number;
    }>;
    listarFeatures(): Promise<{
        features: FlagFuncionalidade[];
    }>;
    criarMedia(dados: {
        tipo: string;
        mime?: string;
        nome_ficheiro?: string;
    }): Promise<{
        anexo_id: string;
        limite_bytes: number;
        upload: {
            metodo: string;
            url: string;
        };
    }>;
    carregarMedia(upload: {
        metodo: string;
        url: string;
    }, bytes: Blob | ArrayBuffer, mime?: string): Promise<void>;
    confirmarMedia(anexoId: string, meta?: {
        largura?: number;
        altura?: number;
        duracao_segundos?: number;
        blurhash?: string;
        duravel?: boolean;
    }): Promise<{
        anexo: Anexo;
    }>;
    iniciarChamada(conversaId: string, tipo: 'audio' | 'video'): Promise<RespostaChamada>;
    atenderChamada(chamadaId: string): Promise<RespostaChamada>;
    /** O destinatário avisa que está A TOCAR → o autor passa de "A ligar…" a "A chamar…". */
    chamadaATocar(chamadaId: string): Promise<{
        estado: string;
    }>;
    rejeitarChamada(chamadaId: string): Promise<RespostaChamada>;
    terminarChamada(chamadaId: string): Promise<RespostaChamada>;
    obterContexto(conversaId: string): Promise<{
        contexto: {
            titulo: string;
            subtitulo?: string;
            foto_url?: string | null;
            linhas?: string[];
        } | null;
    }>;
}

/**
 * Socket do módulo CHAT. Compõe sobre o {@link HubSocket} genérico (ligação,
 * token, canais nomeados) e acrescenta as ações tipadas `chat:*`. Delega o
 * ciclo de vida/canais para o hub, por isso serve de drop-in para quem usava o
 * antigo MakaSocket. Uma app sem chat nunca instancia isto.
 */
declare class MakaSocket {
    private readonly hub;
    constructor(hub: HubSocket);
    get ligado(): boolean;
    ligar(): Promise<void>;
    desligar(): void;
    garantirLigado(): void;
    on(evento: string, handler: (payload: never) => void): void;
    subscreverCanal(canal: string, evento: string, handler: (payload: never) => void): () => void;
    private emitirComAck;
    enviarMensagem(dados: DadosEnvioMensagem & {
        ref_cliente: string;
    }): Promise<Ack<{
        mensagem: Mensagem;
        duplicada: boolean;
    }>>;
    editarMensagem(mensagemId: string, conteudo: string): Promise<Ack<{
        mensagem: Mensagem;
    }>>;
    eliminarMensagem(mensagemId: string, paraTodos: boolean): Promise<Ack<{
        mensagem: Mensagem;
        para_todos: boolean;
    }>>;
    marcarEntregues(conversaId: string, ateMensagemId: string): Promise<{
        estado: "ok" | "erro";
        texto?: string;
    }>;
    marcarLidas(conversaId: string, ateMensagemId: string): Promise<{
        estado: "ok" | "erro";
        texto?: string;
    }>;
    alternarReacao(mensagemId: string, emoji: string): Promise<Ack<{
        mensagem_id: string;
        conversa_id: string;
        emoji: string | null;
    }>>;
    typing(conversaId: string, ativo: boolean): void;
    entrarConversa(conversaId: string): Promise<{
        estado: "ok" | "erro";
        texto?: string;
    }>;
    sincronizarDesde(cursores: CursorConversa[], alteradasDesde?: string): Promise<Ack<{
        lotes: {
            conversa_id: string;
            mensagens: Mensagem[];
        }[];
        agora?: string;
    }>>;
}

/**
 * Contrato de armazenamento local (source of truth offline-first).
 * Implementações: expo-sqlite (react-native), Dexie/IndexedDB (react web),
 * memória (testes). Trocar de motor não toca no SyncEngine nem na UI.
 */
interface StorageAdapter {
    init(): Promise<void>;
    upsertConversas(conversas: Conversa[]): Promise<void>;
    listarConversas(arquivadas?: boolean): Promise<Conversa[]>;
    obterConversa(conversaId: string): Promise<Conversa | null>;
    removerConversa(conversaId: string): Promise<void>;
    upsertMensagens(mensagens: Mensagem[]): Promise<void>;
    removerMensagemPorRef(conversaId: string, refCliente: string): Promise<void>;
    removerMensagem(conversaId: string, mensagemId: string): Promise<void>;
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
    /** metadados do sync (ex.: `sync_em` — água alta do delta de alteradas) */
    obterMeta(chave: string): Promise<string | null>;
    gravarMeta(chave: string, valor: string): Promise<void>;
    limpar(): Promise<void>;
}
/** Implementação em memória — testes e fallback. */
declare class MemoryStorage implements StorageAdapter {
    private conversas;
    private mensagens;
    private outbox;
    private meta;
    init(): Promise<void>;
    upsertConversas(conversas: Conversa[]): Promise<void>;
    listarConversas(arquivadas?: boolean): Promise<Conversa[]>;
    obterConversa(conversaId: string): Promise<Conversa | null>;
    removerConversa(conversaId: string): Promise<void>;
    upsertMensagens(novas: Mensagem[]): Promise<void>;
    removerMensagemPorRef(conversaId: string, refCliente: string): Promise<void>;
    removerMensagem(conversaId: string, mensagemId: string): Promise<void>;
    listarMensagens(conversaId: string, opcoes?: {
        antes_de?: string;
        limite?: number;
    }): Promise<Mensagem[]>;
    cursores(): Promise<{
        conversa_id: string;
        ultimo_id: string | null;
    }[]>;
    adicionarOutbox(item: ItemOutbox): Promise<void>;
    listarOutbox(): Promise<ItemOutbox[]>;
    atualizarOutbox(item: ItemOutbox): Promise<void>;
    removerOutbox(refCliente: string): Promise<void>;
    aplicarRecibo(recibo: Recibo): Promise<void>;
    obterMeta(chave: string): Promise<string | null>;
    gravarMeta(chave: string, valor: string): Promise<void>;
    limpar(): Promise<void>;
}

interface SyncEngineOpcoes {
    identidade: IdentidadeConfig;
    aoTyping?: (typing: Typing) => void;
    /** mensagem RECEBIDA e nova (deduplicada) — usado para notificações */
    aoMensagem?: (mensagem: Mensagem) => void;
    /** a MINHA última mensagem enviada foi LIDA pelo outro (recibo) — som 'vista' */
    aoLido?: (conversaId: string) => void;
    aoPresenca?: (presenca: Presenca) => void;
    aoChamada?: (evento: EventoChamada) => void;
}
type Ouvinte = (versao: number) => void;
/**
 * Motor offline-first (padrão kanda-messaging): o storage local é a fonte de
 * verdade da UI; escritas acontecem primeiro localmente (estado `a_enviar`) e
 * o outbox faz flush idempotente por `ref_cliente` quando há ligação. Cada
 * alteração incrementa a versão e notifica os subscritores (hooks re-renderizam).
 */
declare class SyncEngine {
    readonly storage: StorageAdapter;
    readonly api: MakaApi;
    readonly socket: MakaSocket;
    private readonly opcoes;
    private versao;
    private ouvintes;
    private aFazerFlush;
    /** fila de mutações locais da conversa — ver patchConversa */
    private filaConversa;
    /** salas de conversa a (re)entrar em cada ligação — typing/presença chegam por aqui */
    private salas;
    /** última presença conhecida por identidade (snapshot do connect + eventos) —
     *  a lista de conversas mostra bolinhas sem abrir nenhuma conversa */
    private presencas;
    /** última mensagem minha que já disparou 'vista' por conversa — evita repetir
     *  o som por cada leitor num grupo (uma leitura por mensagem) */
    private ultimaVistaPorConversa;
    /** cache em memória de conversas (semeado pela lista) — abre a conversa com
     *  header instantâneo (avatar/nome), sem flash de "?"/"…" enquanto o storage
     *  async carrega. */
    private conversasCache;
    constructor(storage: StorageAdapter, api: MakaApi, socket: MakaSocket, opcoes: SyncEngineOpcoes);
    get versaoAtual(): number;
    /** Última presença conhecida da identidade (null = nunca vista/offline). */
    presencaDe(identidadeId: string): Presenca | null;
    /** Conversa em cache (síncrono) — para abrir sem flash de "?"/"…". */
    conversaEmCache(conversaId: string): Conversa | null;
    /** Semeia/atualiza o cache em memória (chamado pela lista e ao abrir). */
    semearConversas(conversas: Conversa[]): void;
    subscrever(ouvinte: Ouvinte): () => void;
    private notificar;
    /**
     * Mutação local da conversa SERIALIZADA: lê a versão fresca e escreve sem
     * intercalar com outros writers. Sem isto, o upsert pós-ack do marcarLidas
     * do emissor podia gravar um snapshot lido ANTES do recibo do recetor e
     * regredir os ticks (lida → entregue) até reabrir a conversa.
     */
    private patchConversa;
    iniciar(): Promise<void>;
    /** Chamado pelo MakaSocket em cada (re)ligação. */
    aoLigar(): Promise<void>;
    /** Marca como entregues as mensagens mais novas do que a minha última entrega, por conversa. */
    private marcarEntreguesPendentes;
    /** Entra na sala da conversa (typing/presença), garante rejoin e a conversa no storage. */
    entrarConversa(conversaId: string): Promise<void>;
    atualizarConversas(): Promise<void>;
    /**
     * Delta pós-reconexão: recupera mensagens novas E alteradas (reações,
     * edições, eliminações — via água alta `sync_em`) e faz as novas correr
     * o fluxo normal (aoMensagem → notificações/badges, marcar entregues),
     * como se tivessem chegado ao vivo.
     */
    sincronizarDelta(): Promise<void>;
    /** Reflete o estado da chamada da conversa no storage — banner "a decorrer" na UI. */
    private atualizarChamadaAtiva;
    /** Mantém a lista viva: preview, ordem (topo) e contador sem esperar pelo REST. */
    private atualizarPreviewLocal;
    /** Mensagens vindas do push nativo (inbox offline) — upsert idempotente por id + refresh da UI. */
    ingerirMensagensPush(mensagens: Mensagem[]): Promise<void>;
    /** Carrega histórico da conversa via REST para o storage (chamado ao abrir). */
    carregarMensagens(conversaId: string, antesDe?: string): Promise<number>;
    enviarMensagem(dados: DadosEnvioMensagem, anexosPreview?: Anexo[]): Promise<Mensagem>;
    /** Flush idempotente: reenvio com o mesmo ref_cliente nunca duplica no servidor. */
    flushOutbox(): Promise<void>;
    private marcarFalhada;
    /**
     * "Tentar de novo" numa mensagem falhada: reconstrói o pedido a partir da
     * cópia local, volta a pô-la no outbox como `a_enviar` e faz flush. Idempotente
     * (mesmo ref_cliente) — se o servidor já a tinha, devolve a existente.
     */
    reenviar(conversaId: string, mensagemId: string): Promise<void>;
    /** identidade_id desta identidade na conversa (público — a UI usa p/ atribuição de chamadas). */
    minhaIdentidadeId(conversaId: string): Promise<string | null>;
    alternarReacao(conversaId: string, mensagemId: string, emoji: string): Promise<void>;
    editarMensagem(mensagemId: string, conteudo: string): Promise<void>;
    eliminarMensagem(conversaId: string, mensagemId: string, paraTodos: boolean): Promise<void>;
    /** Descarta LOCALMENTE uma mensagem que nunca chegou ao servidor (falhada/pendente) — sem tocar no hub, sem flag. */
    descartarMensagemLocal(conversaId: string, mensagemId: string): Promise<void>;
    eliminarConversa(conversaId: string): Promise<void>;
    /** Silencia (ISO ou '9999-12-31T00:00:00Z' para sempre) ou reativa (null) as notificações da conversa. */
    silenciarConversa(conversaId: string, ate: string | null): Promise<void>;
    marcarNaoLida(conversaId: string): Promise<void>;
    marcarLidas(conversaId: string): Promise<void>;
    private registarEventos;
}

export { type AlvoParticipante, type Anexo, type Chamada, type ContextoAberturaReferencia, type Conversa, type CursorConversa, type DadosEnvioMensagem, EVENTOS_CLIENTE, EVENTOS_SERVIDOR, type EstadoEnvio, type EventoChamada, FUNCIONALIDADES, type FlagFuncionalidade, type Funcionalidade, type ItemOutbox, MakaApi, MakaSocket, MemoryStorage, type Mensagem, type MensagemLink, type MetadadosPartilha, type ParticipanteConversa, type PreferenciasParticipante, type Presenca, type PreviewMensagem, type Reacao, type Recibo, type ReciboParticipante, type Referencia, type RespostaChamada, type StorageAdapter, SyncEngine, type SyncEngineOpcoes, type TipoMensagem, type Typing, dividirLinks, idMaiorOuIgual, referenciaDaMensagem, rotuloTipoIdentidade };
