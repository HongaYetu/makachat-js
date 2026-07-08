# MakaChat JS

Bibliotecas cliente do MakaChat (chat centralizado Honga Yetu). Publicadas em `npm.pkg.github.com` (org HongaYetu).

| Pacote | Descrição |
|---|---|
| [`@hongayetu/makachat-core`](packages/core) | Protocolo, cliente socket/REST, `StorageAdapter` e `SyncEngine` offline-first — sem dependência de React |
| [`@hongayetu/makachat-react`](packages/react) | UI web completa (Tailwind pré-compilado, Iconify Tabler): BoxFull/BoxMin/Dock, media, reações, grupos, chamadas, pesquisa |
| [`@hongayetu/makachat-react-native`](packages/react-native) | UI para Expo/React Native, storage `expo-sqlite` (paridade com a web em curso) |

O contrato de eventos/REST é o `PROTOCOL.md` do [makachat-server](https://github.com/HongaYetu/makachat-server).

## Uso mínimo (web)

```tsx
import '@hongayetu/makachat-react/styles.css';
import { MakaChatProvider, MakaChatDock } from '@hongayetu/makachat-react';

<MakaChatProvider
    serviceKey="humbi"
    identity={{ id: userId, tipo: 'cliente', nome }}
    getToken={() => req('/api/makachat/token')}
    tema={{ primaria: '#FF5A00' }}
    contactos={contactos}          // opcional: alvos para criar conversas/grupos
>
    <App />
    <MakaChatDock />               {/* ou <MakaChatBoxFull/> / <MakaChatBoxMin/> */}
</MakaChatProvider>
```

- **3 modos**: `MakaChatBoxFull` (página inteira), `MakaChatBoxMin` (preenche o contentor), `MakaChatDock` (boxes flutuantes estilo Facebook, `useDock().abrir(id)`)
- **Query string**: `?conversa=<id>` abre a conversa ao carregar (BoxFull/BoxMin; no Dock via prop `queryParam`)
- **Eventos em qualquer página** (sem UI de chat montada): `useMensagemRecebida(handler)`, `useTotalNaoLidas()`, `subscreverMensagens()` no contexto
- **Notificações nativas** do browser (opt-in): `notificacoesNativas` + `pedirPermissaoNotificacoes()`; clique → `aoAbrirNotificacao(conversaId)`
- **Chamadas**: `ChamadasProvider` global — janela flutuante arrastável toca em qualquer página

## Desenvolvimento

```bash
pnpm install
pnpm build
pnpm test   # inclui a suite de integração biblioteca↔servidor: requer o makachat-server local ligado (pnpm start:dev)
```

Exemplo interativo: `apps/exemplo-web` (`pnpm --filter exemplo-web dev`) — perfis demo, 3 modos e temas.

## Estilos (pacote web)

O `@hongayetu/makachat-react` é estilizado com Tailwind e publica o CSS pré-compilado — importar uma vez na app:

```ts
import '@hongayetu/makachat-react/styles.css';
```

As cores vêm do tema (`<MakaChatProvider tema={{ primaria: '#FF5A00', ... }}>`) via CSS vars `--maka-*`. Em alternativa, apps com Tailwind próprio podem adicionar `node_modules/@hongayetu/makachat-react/dist/*.js` ao `content` do tailwind.config e dispensar o import.
