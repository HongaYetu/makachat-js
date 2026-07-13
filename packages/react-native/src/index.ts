export * from '@hongayetu/makachat-core';
export { SqliteStorage, type SQLiteDatabaseLike } from './sqlite-storage';
export { MakaChatProvider, useMakaChat, useMakaChatOpcional, type MakaChatProviderProps, type MakaChatContexto } from './provider';
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
    useTotalNaoLidasOpcional,
} from './hooks';
export { useTema } from './provider';
export { type MakaTema } from './tema';
export { Avatar, NomeComBadge, Sheet, ListaPerformante, horaCurta, rotuloDia } from './ui/comum';
export { ConversasScreen, previewConversa, type ConversasScreenProps, type TopoConversasContexto } from './ui/ConversasScreen';
export { ChatScreen, type ChatScreenProps, type HeaderChatContexto } from './ui/ChatScreen';
export { InfoConversaScreen, type InfoConversaScreenProps } from './ui/InfoConversaScreen';
export { NovaConversaScreen, type NovaConversaScreenProps } from './ui/NovaConversaScreen';
export { ChamadasProvider, useChamadas, useChamadasOpcional, type ChamadasApi } from './chamadas';
export { ReprodutorAudio, GravadorAudio } from './ui/audio';
export { Galeria, LobbyFotos, VisualizadorVideo, enviarAnexoLocal, escolherFotosEVideos, escolherFicheiro, registarFicheiroLocal, tipoDeMime, type FicheiroLocal } from './ui/media';
export { PartilharParaConversaScreen, usePartilhaRecebida, type PartilharScreenProps } from './ui/PartilharScreen';
export { Bolha, CartaoRegistoChamada } from './ui/Bolha';
export { ligarPushNativo } from './push-nativo';
export { NotificacoesLocais } from './notificacoes-locais';
export { tocarSom, comecarToque, pararToque, type NomeSom } from './sons';
