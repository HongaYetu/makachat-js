# @hongayetu/makachat-react-native

UI MakaChat completa para Expo/React Native — paridade com o pacote web, com interações ao estilo WhatsApp/Messenger/Telegram: long-press com sheet de ações, swipe para responder, gravação de voz com timer, galeria fullscreen, ecrã de chamada nativo (LiveKit). Offline-first com `expo-sqlite`.

## Uso mínimo

```tsx
import { MakaChatProvider, ChamadasProvider, ConversasScreen, ChatScreen, InfoConversaScreen, useChamadas } from '@hongayetu/makachat-react-native';

<MakaChatProvider serviceKey="humbi" identity={identidade} getToken={getToken} tema={{ primaria: '#f97316' }} contactos={contactos}>
    <ChamadasProvider>
        {/* navegação da app: lista → conversa → info */}
        <ConversasScreen onAbrirConversa={(c) => router.push(`/chat/${c.id}`)} />
        <ChatScreen conversaId={id} chamadas={useChamadas()} onVoltar={router.back} onAbrirInfo={(c) => router.push(`/chat/${c.id}/info`)} />
    </ChamadasProvider>
</MakaChatProvider>
```

Para chamadas, regista os globals do LiveKit no entry da app (antes de tudo):

```js
// index.js
const { registerGlobals } = require('@livekit/react-native');
registerGlobals();
```

## Funcionalidades (gated pelas flags do serviço)

Lista com pesquisa local+servidor, badges (não lidas/fixada/silenciada/chamada ativa/verificado), long-press (fixar, silenciar 8h/1sem/sempre, arquivar, não lida, eliminar), arquivadas, paginação, FAB nova conversa (1 pessoa → privada, 2+ → grupo). Conversa com bolhas agrupadas estilo Messenger, separadores de dia, swipe→responder, sheet de ações (reagir/responder/encaminhar multi/editar/eliminar para mim-todos), reações com lista de quem reagiu, citação com salto+destaque, pesquisa full-text na conversa (n/m), paginação para trás, typing, recibos ✓✓ azuis, botão de novas mensagens, banner "chamada a decorrer — Entrar", conversa fechada com motivo, cartões de registo de chamada e partilha/link, fotos multi com lobby+legenda, galeria fullscreen, vídeo (expo-video), ficheiros, mensagens de voz (gravador + player com velocidade), grupos completos (InfoConversaScreen: foto, renomear, membros, papéis, sair).

## Dependências

Obrigatórias (peer): `expo-sqlite`, `@expo/vector-icons`.

Opcionais — cada uma ativa uma funcionalidade; sem ela o botão correspondente desaparece:

| Peer | Ativa |
|---|---|
| `@shopify/flash-list` | listas de alta performance (senão FlatList) |
| `expo-image-picker` | fotos e vídeos |
| `expo-document-picker` | ficheiros |
| `expo-audio` | mensagens de voz (gravar + ouvir) |
| `expo-video` | player de vídeo interno |
| `expo-file-system` | uploads em streaming |
| `@livekit/react-native` + `@livekit/react-native-webrtc` + `livekit-client` | chamadas de voz/vídeo |

Push: pacote irmão `expo-makachat-push` (inbox nativa FCM/APNs, tokens em `POST /v1/dispositivos`).

## QA

`apps/exemplo-mobile` (Expo): perfis demo, todos os módulos opcionais instalados. Ajustar o IP do servidor no `App.tsx`, `npx expo start` com o makachat-server local ligado.

## Chamadas com a app fechada / nativo

| Capacidade | Android | iOS |
|---|---|---|
| Notificação de chamada a tocar (app fechada) | ✅ CallStyle nativo (API 31+) com Atender/Rejeitar, full-screen, som de toque; para quando alguém atende (`chamada_fim`) | ⚠️ Notificação normal (NSE) — tap abre a app e o banner "Entrar" assume |
| Retomar chamada do push (arranque frio) | ✅ `retomarPendente()` automático no provider | — |
| Áudio em background durante a chamada | ✅ foreground service (peer opcional `@notifee/react-native` + runner no index.js) | ✅ (AudioSession) |
| Partilha de ecrã | ✅ (flag `chamadas.partilha_ecra`) | ❌ exige Broadcast Extension (fase própria) |
| Toque contínuo/ecrã nativo com app morta (VoIP) | CallStyle cobre | ❌ exige CallKit+PushKit + certificado VoIP APNs (fase própria) |

Fora do âmbito mobile v1: Broadcast Extension iOS e CallKit/PushKit (bloqueados por certificados/dispositivo — o resto do fluxo já está pronto do lado do servidor e do Android).
