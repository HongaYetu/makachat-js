export * from '@hongayetu/makachat-core';
export { MakaChatProvider, useMakaChat, type MakaChatProviderProps, type MakaChatContexto } from './provider';
export {
    useVersaoChat,
    useConversas,
    useMensagens,
    useEnviarMensagem,
    useTypingConversa,
    usePresenca,
    useFuncionalidadeAtiva,
    useLigacao,
    useSemLigacao,
    useMensagemRecebida,
    useTotalNaoLidas,
} from './hooks';
export {
    MakaChatConversas,
    MakaChatConversa,
    AvatarWeb,
    type MakaChatConversasProps,
} from './ui';
export { ChamadasProvider, useChamadas, useChamadasOpcional } from './chamadas';
export { MakaChatBoxFull, MakaChatBoxMin, MakaChatDock, useDock, type MakaChatDockProps, type BoxProps } from './boxes';
export { type MakaTema } from './tema';
export { pedirPermissaoNotificacoes, notificacoesSuportadas, mostrarNotificacao } from './notificacoes';
export { tocarSom, comecarToque, pararToque, type NomeSom } from './sons';
export { ConversaPainel, type ConversaPainelProps } from './ui';
