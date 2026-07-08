# @hongayetu/makachat-react-native

UI MakaChat para Expo/React Native, com storage persistente em `expo-sqlite` (offline-first via `SyncEngine` do core).

> Estado: baseline funcional (lista + conversa + envio com outbox). A paridade com o pacote web (reações, media completa, grupos, chamadas, pesquisa) é a próxima fase — ver o plano no repositório.

```tsx
import { MakaChatProvider, ConversasScreen, ChatScreen, SqliteStorage } from '@hongayetu/makachat-react-native';

<MakaChatProvider serviceKey="humbi" identity={identidade} getToken={getToken}>
    <ConversasScreen onAbrirConversa={(c) => navegarPara(c.id)} />
</MakaChatProvider>
```

Push: usar o pacote irmão `expo-makachat-push` (FCM/APNs registados em `POST /v1/dispositivos`).
