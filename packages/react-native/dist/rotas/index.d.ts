import React from 'react';

/**
 * Layout do grupo `(chat)`: um Stack sem cabeçalho com transição uniforme.
 * `screenOptions` permite à app afinar (ex.: animação, gestos).
 */
declare function LayoutChatMakaChat({ screenOptions }: {
    screenOptions?: Record<string, unknown>;
}): React.JSX.Element;
/** `app/(chat)/chat/[id].tsx` — conversa. */
declare function RotaConversa(): React.JSX.Element | null;
/** `app/(chat)/chat-info/[id].tsx` — info da conversa. */
declare function RotaInfoConversa(): React.JSX.Element | null;
/** `app/(chat)/nova-conversa.tsx` — nova conversa (pesquisa/sugestões do provider). */
declare function RotaNovaConversa(): React.JSX.Element | null;
/** `app/(chat)/conversas-arquivadas.tsx` — lista de arquivadas. */
declare function RotaArquivadas(): React.JSX.Element | null;
/** `app/(chat)/pesquisar-conversas.tsx` — pesquisa dedicada (input no header). */
declare function RotaPesquisarConversas(): React.JSX.Element | null;

export { LayoutChatMakaChat, RotaArquivadas, RotaConversa, RotaInfoConversa, RotaNovaConversa, RotaPesquisarConversas };
