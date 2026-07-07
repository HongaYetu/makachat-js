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
} from './hooks';
export {
    MakaChatConversas,
    MakaChatConversa,
    AvatarWeb,
    type MakaChatConversasProps,
} from './ui';
export { ChamadasProvider, useChamadas, useChamadasOpcional } from './chamadas';
export { MakaChatBoxFull, MakaChatBoxMin, MakaChatDock, useDock, type MakaChatDockProps } from './boxes';
export { type MakaTema } from './tema';
export { ConversaPainel, type ConversaPainelProps } from './ui';
