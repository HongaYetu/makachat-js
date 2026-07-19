/**
 * Nomes de eventos socket do módulo CHAT do Honga Hub — fonte única,
 * alinhada com o PROTOCOL.md. Todos os eventos levam o prefixo do módulo
 * (`chat:`); o hub multiplexa vários módulos (chat, streaming, ...).
 */

export const EVENTOS_CLIENTE = {
    ENVIAR: 'chat:mensagem:enviar',
    EDITAR: 'chat:mensagem:editar',
    ELIMINAR: 'chat:mensagem:eliminar',
    ENTREGUES: 'chat:mensagens:entregues',
    LIDAS: 'chat:mensagens:lidas',
    REAGIR: 'chat:reacao:alternar',
    TYPING: 'chat:typing',
    ENTRAR_CONVERSA: 'chat:conversa:entrar',
    SYNC: 'chat:sync:desde',
} as const;

export const EVENTOS_SERVIDOR = {
    MENSAGEM_NOVA: 'chat:mensagem:nova',
    MENSAGEM_ATUALIZADA: 'chat:mensagem:atualizada',
    MENSAGEM_ELIMINADA: 'chat:mensagem:eliminada',
    RECIBO: 'chat:recibo:atualizado',
    REACAO: 'chat:reacao:atualizada',
    TYPING: 'chat:typing',
    PRESENCA: 'chat:presenca',
    CONVERSA_ATUALIZADA: 'chat:conversa:atualizada',
    /** conversa eliminada pelo serviço (ex.: fim da corrida) — remover localmente */
    CONVERSA_ELIMINADA: 'chat:conversa:eliminada',
    PARTICIPANTE_ADICIONADO: 'chat:participante:adicionado',
    PARTICIPANTE_REMOVIDO: 'chat:participante:removido',
    PARTICIPANTE_ATUALIZADO: 'chat:participante:atualizado',
    CHAMADA_INICIADA: 'chat:chamada:iniciada',
    /** o dispositivo do destinatário confirma que está a tocar → autor: A ligar… → A chamar… */
    CHAMADA_A_TOCAR: 'chat:chamada:a_tocar',
    CHAMADA_ATENDIDA: 'chat:chamada:atendida',
    CHAMADA_REJEITADA: 'chat:chamada:rejeitada',
    CHAMADA_TERMINADA: 'chat:chamada:terminada',
    CHAMADA_PARTICIPANTE_SAIU: 'chat:chamada:participante_saiu',
} as const;

export const FUNCIONALIDADES = [
    'media.foto',
    'media.video',
    'media.ficheiro',
    'media.audio',
    'reacoes',
    'encaminhar',
    'grupos',
    'chamadas.audio',
    'chamadas.video',
    'chamadas.partilha_ecra',
    'conversas.eliminar',
    'mensagens.eliminar',
    // criação de conversas pelo utilizador (nova conversa/mensagem direta);
    // serviços com conversas só de sistema (ex.: via encomenda) não a ativam
    'conversas.criar',
] as const;

export type Funcionalidade = (typeof FUNCIONALIDADES)[number];
