export * from '@hongayetu/makachat-core';
export { SqliteStorage, type SQLiteDatabaseLike } from './sqlite-storage';
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
export { ConversasScreen, Avatar, horaCurta, type ConversasScreenProps } from './ui/ConversasScreen';
export { ChatScreen, type ChatScreenProps } from './ui/ChatScreen';
