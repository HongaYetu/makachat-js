import * as react_jsx_runtime from 'react/jsx-runtime';

/**
 * Layout do grupo `(chat)`: um Stack sem cabeçalho com transição uniforme.
 * `screenOptions` permite à app afinar (ex.: animação, gestos).
 */
declare function LayoutChatMakaChat({ screenOptions }: {
    screenOptions?: Record<string, unknown>;
}): react_jsx_runtime.JSX.Element;
/** `app/(chat)/chat/[id].tsx` — conversa. */
declare function RotaConversa(): react_jsx_runtime.JSX.Element | null;
/** `app/(chat)/chat-info/[id].tsx` — info da conversa. */
declare function RotaInfoConversa(): react_jsx_runtime.JSX.Element | null;
/** `app/(chat)/nova-conversa.tsx` — nova conversa (pesquisa/sugestões do provider). */
declare function RotaNovaConversa(): react_jsx_runtime.JSX.Element | null;
/** `app/(chat)/conversas-arquivadas.tsx` — lista de arquivadas. */
declare function RotaArquivadas(): react_jsx_runtime.JSX.Element | null;
/** `app/(chat)/pesquisar-conversas.tsx` — pesquisa dedicada (input no header). */
declare function RotaPesquisarConversas(): react_jsx_runtime.JSX.Element | null;

export { LayoutChatMakaChat, RotaArquivadas, RotaConversa, RotaInfoConversa, RotaNovaConversa, RotaPesquisarConversas };
