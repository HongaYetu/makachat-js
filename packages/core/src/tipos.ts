/** Tipos do protocolo MakaChat — espelham o PROTOCOL.md do makachat-server. */

export interface IdentidadeConfig {
    /** id externo da entidade no serviço de origem (claim `sub`) */
    id: string;
    /** tipo de entidade no serviço (cliente, motorista, encarregado...) */
    tipo: string;
    nome: string;
    foto?: string | null;
}

export interface CredenciaisSessao {
    token: string;
    socket_url: string;
    api_url: string;
}

export type ObterToken = () => Promise<CredenciaisSessao>;

export interface Anexo {
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

export type TipoMensagem =
    | 'texto'
    | 'foto'
    | 'video'
    | 'audio'
    | 'ficheiro'
    | 'partilha'
    | 'link'
    | 'sistema'
    | 'chamada';

/** Payload de mensagens partilha/link (cartão genérico na UI). */
export interface MetadadosPartilha {
    contexto_tipo?: string;
    contexto_id?: string;
    titulo?: string;
    subtitulo?: string;
    imagem_url?: string;
    url?: string;
    [extra: string]: unknown;
}

/** Estado local de envio (não vem do servidor). */
export type EstadoEnvio = 'a_enviar' | 'enviada' | 'falhou';

export interface Reacao {
    identidade_id: string;
    emoji: string;
}

export interface Mensagem {
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

export interface ParticipanteConversa {
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

export interface PreferenciasParticipante {
    papel: string;
    mensagens_nao_lidas: number;
    arquivada: boolean;
    fixada: boolean;
    silenciada_ate: string | null;
    ultima_leitura_mensagem_id: string | null;
}

export interface PreviewMensagem {
    id: string;
    tipo: TipoMensagem;
    conteudo: string | null;
    eliminada: boolean;
    remetente_identidade_id: string;
    criada_em: string;
}

export interface Conversa {
    id: string;
    tipo: 'privada' | 'grupo';
    titulo: string | null;
    foto_url: string | null;
    contexto_tipo: string | null;
    contexto_id: string | null;
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
    chamada_ativa?: { id: string; tipo: 'audio' | 'video'; estado: string; iniciada_em: string; atendida_em: string | null } | null;
}

export interface Recibo {
    conversa_id: string;
    identidade_id: string;
    entregue_ate: string | null;
    lido_ate: string | null;
}

export interface Presenca {
    identidade_id: string;
    online: boolean;
    ultimo_visto_em: string | null;
}

export interface Typing {
    conversa_id: string;
    identidade_id: string;
    ativo: boolean;
}

export interface Chamada {
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

export interface EventoChamada {
    evento: 'iniciada' | 'a_tocar' | 'atendida' | 'rejeitada' | 'terminada' | 'participante_saiu';
    chamada: Chamada;
    iniciador?: { identidade_id: string; nome: string; foto_url: string | null };
    identidade_id?: string;
}

export interface RespostaChamada {
    chamada: Chamada;
    livekit_token: string | null;
    ws_url: string | null;
    /** 1:1: o destinatário está online? (autor: offline → "A ligar…"; online → "A chamar…") */
    destinatario_online?: boolean;
    /** o destinatário já estava numa chamada → não tocou (autor vê "Ocupado") */
    ocupado?: boolean;
}

export interface FlagFuncionalidade {
    funcionalidade: string;
    tipo_conversa: string;
    ativo: boolean;
    limites: unknown;
}

export interface AlvoParticipante {
    id_externo: string;
    tipo: string;
    nome?: string;
    foto?: string | null;
}

export interface DadosEnvioMensagem {
    conversa_id: string;
    tipo?: TipoMensagem;
    conteudo?: string;
    resposta_a_id?: string;
    encaminhada_de_id?: string;
    anexo_ids?: string[];
    /** payload de partilha/link (≤4KB) */
    metadados?: MetadadosPartilha;
}

export interface ItemOutbox {
    ref_cliente: string;
    conversa_id: string;
    dados: DadosEnvioMensagem;
    criado_em: string;
    tentativas: number;
}

export interface CursorConversa {
    conversa_id: string;
    ultimo_id: string | null;
}

export type Ack<T = Record<string, unknown>> = {
    estado: 'ok' | 'erro';
    texto?: string;
} & T;

/**
 * Comparação de UUIDv7 (ordenáveis lexicograficamente) — base dos recibos
 * por watermark: lida ⇔ lido_ate >= mensagem.id.
 */
export function idMaiorOuIgual(a: string | null, b: string): boolean {
    return !!a && a >= b;
}

/** Rótulos humanos dos tipos de identidade conhecidos — a UI nunca mostra o tipo cru. */
const ROTULOS_TIPO_IDENTIDADE: Record<string, string> = {
    cliente: 'Cliente',
    negocio: 'Negócio',
    utilizador_kanda: 'Utilizador do Kanda',
    sistema: 'Sistema',
};

export function rotuloTipoIdentidade(tipo: string): string {
    if (ROTULOS_TIPO_IDENTIDADE[tipo]) return ROTULOS_TIPO_IDENTIDADE[tipo];

    // fallback: "entregador_urbano" → "Entregador urbano"
    const legivel = tipo.replaceAll('_', ' ').trim();

    return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

/** Estado de entrega/leitura de uma mensagem por participante (relatório de entrega). */
export interface ReciboParticipante {
    identidade_id: string;
    nome: string;
    foto_url: string | null;
    tipo: string;
    entregue: boolean;
    vista: boolean;
}

/** Item da tab Links da info (mensagem com subtipo 'link' no hub). */
export interface MensagemLink {
    id: string;
    tipo: string;
    conteudo: string | null;
    metadados: MetadadosPartilha | null;
    remetente_identidade_id: string;
    criada_em: string;
}

/** Divide texto em segmentos, isolando URLs (linkify nas bolhas). */
export function dividirLinks(texto: string): { texto: string; url?: string }[] {
    const regex = /https?:\/\/[^\s<>"']+/gi;
    const partes: { texto: string; url?: string }[] = [];
    let cursor = 0;

    for (const m of texto.matchAll(regex)) {
        const inicio = m.index ?? 0;

        if (inicio > cursor) partes.push({ texto: texto.slice(cursor, inicio) });

        // pontuação final comum não faz parte do URL ("vê https://x.com.")
        const url = m[0].replace(/[).,;!?]+$/, '');
        partes.push({ texto: url, url });
        cursor = inicio + url.length;
    }

    if (cursor < texto.length) partes.push({ texto: texto.slice(cursor) });

    return partes.length ? partes : [{ texto }];
}
