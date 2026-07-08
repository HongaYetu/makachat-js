import { registerRootComponent } from 'expo';

// LiveKit precisa dos globals WebRTC antes de qualquer ligação (padrão EiConnect)
try {
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
} catch {
    // app sem chamadas — segue sem LiveKit
}

const App = require('./App').default;

registerRootComponent(App);
