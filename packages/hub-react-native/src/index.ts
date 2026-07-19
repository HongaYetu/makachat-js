// Só a superfície GENÉRICA do hub — nada de chat. Uma app sem chat não deve
// ver Mensagem/Conversa/MakaSocket. Tipos/classes genéricos vêm do core.
export { HubApi, HubSocket, ErroApi, type HubSocketOpcoes, type IdentidadeConfig, type CredenciaisSessao, type ObterToken, type Ack, uuid } from '@hongayetu/honga-hub-core';
export { HongaHubProvider, useHongaHub, useHongaHubOpcional, type HongaHubContexto, type HongaHubProviderProps } from './provider';
export { useCanalHub, useLigacao } from './hooks';
