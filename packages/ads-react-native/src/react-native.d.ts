/**
 * Tipos mínimos das peerDependencies (não instaladas no monorepo).
 * A app consumidora usa os tipos reais; aqui só precisamos de compilar.
 */
declare module 'react-native' {
    import type * as React from 'react';

    export const View: React.ComponentType<any>;
    export const Text: React.ComponentType<any>;
    export const Image: React.ComponentType<any>;
    export const Modal: React.ComponentType<any>;
    export const Pressable: React.ComponentType<any>;
    export const ActivityIndicator: React.ComponentType<any>;

    export const StyleSheet: {
        create<T extends Record<string, any>>(styles: T): T;
    };

    export const Linking: {
        openURL(url: string): Promise<unknown>;
    };

    export const Dimensions: {
        get(dim: 'window' | 'screen'): { width: number; height: number };
    };
}
