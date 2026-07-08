# @hongayetu/expo-makachat-push

Módulo nativo (padrão kanda-messaging): recebe pushes do MakaChat **com a app fechada**, grava num inbox SQLite próprio e o JS drena-o para o storage principal — sem contenção com o expo-sqlite.

## Payload (enviado pelo makachat-server via FCM/APNs)

`data`: `makachat=1`, `chave_servico`, `conversa_id`, `mensagem=<json da mensagem>`, `titulo`, `corpo` (iOS: `mutable-content: 1`).

## Android

- O `MakachatFcmService` regista-se sozinho (manifest do módulo). Requer o setup Firebase normal da app (`google-services.json`).
- Com a app morta: grava no inbox + mostra notificação. Com a app viva: também emite `onMensagemPush`.

## iOS

1. Configurar um **App Group** (ex. `group.com.hongayetu.humbi`) na app e na NSE.
2. Criar o target **Notification Service Extension** e copiar `nse-source/NotificationService.swift` (+ `ios/InboxDatabase.swift`) para ele, ajustando o `appGroup`.
3. Na app JS: `configurar('group.com.hongayetu.humbi')` no arranque.

## Uso com o MakaChat

```ts
import * as MakaPush from '@hongayetu/expo-makachat-push';

MakaPush.configurar(appGroupIOS);

// arranque + foreground: drenar para o storage do MakaChatProvider
const itens = await MakaPush.drenarInbox();
await engine.storage.upsertMensagens(
    itens.map((i) => ({ ...JSON.parse(i.mensagem_json), estado_envio: 'enviada' })),
);

MakaPush.aoReceberPush(() => {/* app viva em background — refrescar badge */});
```

Registo do token: `api.registarDispositivo({ plataforma, fornecedor: 'fcm', token })` (endpoint `/v1/dispositivos`).

## Chamadas (Android)

Pushes com `makachat_chamada=1` mostram notificação de chamada nativa (CallStyle, som de toque, Atender/Rejeitar, full-screen intent) e `acao=parar` cancela-a quando alguém atende. API JS: `obterChamadaPendente()` (arranque frio — lê e limpa), `aoChamadaPush(listener)` (app viva) e `cancelarNotificacaoChamada(id)`. O `ChamadasProvider` do `@hongayetu/makachat-react-native` consome isto automaticamente via `retomarPendente()`.

Permissões da app (app.json → android.permissions): `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`.
