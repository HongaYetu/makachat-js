/** Tipos GENÉRICOS do Honga Hub (ligação/token/ack) — partilhados por todos os
 *  módulos (chat, streaming, ...). Os tipos específicos de chat vivem em
 *  @hongayetu/makachat-core. */

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

export type Ack<T = Record<string, unknown>> = {
    estado: 'ok' | 'erro';
    texto?: string;
} & T;
