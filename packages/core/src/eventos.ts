/** Nomes de eventos socket — fonte única, alinhada com o PROTOCOL.md. */

export const EVENTOS_CLIENTE = {
    ENVIAR: 'mensagem:enviar',
    EDITAR: 'mensagem:editar',
    ELIMINAR: 'mensagem:eliminar',
    ENTREGUES: 'mensagens:entregues',
    LIDAS: 'mensagens:lidas',
    REAGIR: 'reacao:alternar',
    TYPING: 'typing',
    ENTRAR_CONVERSA: 'conversa:entrar',
    SYNC: 'sync:desde',
} as const;

export const EVENTOS_SERVIDOR = {
    MENSAGEM_NOVA: 'mensagem:nova',
    MENSAGEM_ATUALIZADA: 'mensagem:atualizada',
    MENSAGEM_ELIMINADA: 'mensagem:eliminada',
    RECIBO: 'recibo:atualizado',
    REACAO: 'reacao:atualizada',
    TYPING: 'typing',
    PRESENCA: 'presenca',
    CONVERSA_ATUALIZADA: 'conversa:atualizada',
    PARTICIPANTE_ADICIONADO: 'participante:adicionado',
    PARTICIPANTE_REMOVIDO: 'participante:removido',
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
] as const;

export type Funcionalidade = (typeof FUNCIONALIDADES)[number];
