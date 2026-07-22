# @hongayetu/ads-react-native

SDK Honga Ads para React Native/Expo — banner, interstitial e rewarded da rede de publishers Honga Yetu. JS puro, sem módulos nativos.

Documentação completa: [dev.honga.com/docs/honga-ads](https://dev.honga.com/docs/honga-ads).

## Instalação

```bash
npm install @hongayetu/ads-react-native
```

## Uso

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HongaAdsProvider, AdBanner, useInterstitial, useRewarded } from '@hongayetu/ads-react-native';

// Raiz da app — use uma chave hy_test_ durante a integração.
<HongaAdsProvider publisherId="hy-pub-xxxx" apiKey="hy_live_xxxx|secret" storage={AsyncStorage}>
    <App />
</HongaAdsProvider>

// Banner
<AdBanner unitId="hy-unit-xxxx" />

// Interstitial
const interstitial = useInterstitial('hy-unit-yyyy');
await interstitial.load();
if (interstitial.isLoaded) interstitial.show();

// Rewarded — onReward só dispara após confirmação server-side.
const rewarded = useRewarded('hy-unit-zzzz', {
    onReward: () => darRecompensa(),
});
```

## Comportamento

- **Impressões**: registadas após 1s de exibição (banner/interstitial); no rewarded, no fim da visualização mínima (15s), medida e validada pelo servidor.
- **Tokens de uso único**: cada anúncio mostrado consome os seus tokens — `show()` limpa o `isLoaded`; faça `load()` de novo para o próximo.
- **No-fill / falhas de rede**: nunca bloqueiam a app — o banner colapsa e `load()` resolve com `isLoaded=false`.
- **Ambiente test**: com chaves `hy_test_` os criativos vêm marcados como teste e não geram custo nem receita.
