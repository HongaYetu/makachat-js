# @hongayetu/makachat-react

UI web completa do MakaChat: Tailwind pré-compilado (sem conflito com o CSS da app), ícones Iconify (set Tabler), tema por serviço via CSS vars.

## Instalação

```tsx
import '@hongayetu/makachat-react/styles.css';
import { MakaChatProvider, ChamadasProvider, MakaChatDock } from '@hongayetu/makachat-react';

<MakaChatProvider serviceKey="humbi" identity={identidade} getToken={getToken} tema={{ primaria: '#FF5A00' }}>
    <ChamadasProvider>           {/* opcional: chamadas LiveKit (peer dep livekit-client) */}
        <App />
        <MakaChatDock />
    </ChamadasProvider>
</MakaChatProvider>
```

## Modos de apresentação

| Componente | Uso |
|---|---|
| `<MakaChatBoxFull />` | página inteira (viewport todo) |
| `<MakaChatBoxMin />` | preenche o contentor onde for montado (áreas de admin) |
| `<MakaChatDock />` | boxes flutuantes estilo Facebook + launcher com badge; `useDock().abrir(conversaId)` |

Todos aceitam `conversaAbertaId` e abrem conversa por query string (`?conversa=<id>`; configurável com `queryParam`, no Dock é opt-in).

## Funcionalidades (gated por flags do serviço)

Mensagens com reações (picker + lista de quem reagiu), respostas com salto/flash, edição, eliminação para mim/para todos com confirmação, encaminhar multi-conversa; fotos multi-seleção com lobby/legenda, galeria interna, ficheiros com cartão por extensão, gravação e reprodutor de áudio (velocidade + ganho automático); grupos completos (criar — 1 pessoa vira privada, 2+ vira grupo —, foto, membros, papéis); pesquisa de conversas (local + servidor) e dentro da conversa (full-text, navegação n/m); paginação nos dois eixos; arquivadas, fixadas, não lida; presença, typing, recibos, read-awareness com botão de novas mensagens.

## Hooks úteis fora do chat

```ts
useMensagemRecebida((m) => toast(`Nova mensagem`));   // qualquer página, sem UI de chat
useTotalNaoLidas();                                    // badge global (navbar)
useLigacao();                                          // estado do socket
pedirPermissaoNotificacoes();                          // notificações nativas (opt-in no provider)
```

## Tema

CSS vars `--maka-*` definidas pelo prop `tema` do provider (`primaria`, `fundo`, `superficie`, `bolhaMinha`, `raio`, ...). Cada serviço ganha a sua identidade sem recompilar CSS.
