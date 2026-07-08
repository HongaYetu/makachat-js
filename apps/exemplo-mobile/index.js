import { registerRootComponent } from 'expo';

// LiveKit precisa dos globals WebRTC antes de qualquer ligação (padrão EiConnect)
try {
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
} catch {
    // app sem chamadas — segue sem LiveKit
}

// Foreground service Android: mantém o áudio da chamada vivo em background.
// O runner fica pendurado até o ChamadasProvider chamar stopForegroundService.
try {
    const notifee = require('@notifee/react-native').default;
    notifee.registerForegroundService(() => new Promise(() => {}));
} catch {
    // sem notifee — chamadas funcionam, só não sobrevivem tanto em background
}

const App = require('./App').default;

registerRootComponent(App);
