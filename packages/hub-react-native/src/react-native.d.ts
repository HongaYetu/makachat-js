/**
 * Tipos mínimos das peerDependencies (não instaladas no monorepo).
 * A app consumidora usa os tipos reais; aqui só precisamos de compilar.
 */
declare module 'react-native' {
    export const AppState: {
        currentState: string;
        addEventListener(tipo: string, handler: (estado: string) => void): { remove(): void };
    };
}
