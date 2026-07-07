# MakaChat JS

Bibliotecas cliente do MakaChat (chat centralizado Honga Yetu). Publicadas em `npm.pkg.github.com` (org HongaYetu).

| Pacote | Descrição |
|---|---|
| `@hongayetu/makachat-core` | Protocolo, cliente socket/REST, `StorageAdapter` e `SyncEngine` offline-first — sem dependência de React |
| `@hongayetu/makachat-react-native` | UI completa estilo WhatsApp para Expo/React Native, storage `expo-sqlite` |
| `@hongayetu/makachat-react` | UI web (duas colunas), storage Dexie/IndexedDB |

O contrato de eventos/REST é o `PROTOCOL.md` do [makachat-server](https://github.com/HongaYetu/makachat-server).

```bash
pnpm install
pnpm build
pnpm test
```
