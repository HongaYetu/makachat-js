# @hongayetu/makachat-core

Núcleo do cliente MakaChat — sem dependência de React. Usado pelos pacotes `-react` e `-react-native`, ou diretamente em qualquer app JS.

## Peças

- **`MakaApi`** — cliente REST tipado: sessão/token, conversas (listar com `q`/cursor, criar privada/grupo), mensagens (histórico, pesquisa full-text), media (criar → PUT → confirmar, URLs assinadas), chamadas, dispositivos, features.
- **`MakaSocket`** — ligação socket.io ao namespace `/chat` com renovação de token, buffer de handlers pré-ligação e proteção contra sockets concorrentes.
- **`SyncEngine`** — offline-first: escrita otimista, outbox idempotente por `ref_cliente`, delta sync na (re)ligação, watermarks de recibos, lista de conversas viva (preview/ordem/não lidas atualizados localmente), dedupe de eventos.
- **`StorageAdapter`** — interface de storage (`MemoryStorage` incluído; sqlite/IndexedDB nos pacotes de UI).

## Uso direto

```ts
import { MakaApi, MakaSocket, MemoryStorage, SyncEngine } from '@hongayetu/makachat-core';

const api = new MakaApi(getToken);
const socket = new MakaSocket({ obterToken: () => api.sessao(), aoLigar: () => engine.aoLigar() });
const engine = new SyncEngine(new MemoryStorage(), api, socket, {
    identidade: { id: '42', tipo: 'cliente', nome: 'Ana' },
    aoMensagem: (m) => console.log('nova mensagem em qualquer conversa', m),
});

await engine.iniciar();
await engine.enviarMensagem({ conversa_id, tipo: 'texto', conteudo: 'Olá' });
```

## Testes

```bash
pnpm exec vitest run              # 8 unit + 11 integração
# a suite de integração exige o makachat-server local em 127.0.0.1:3900
```
