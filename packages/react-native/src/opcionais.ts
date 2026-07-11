/**
 * Módulos nativos OPCIONAIS: cada funcionalidade só existe se a app instalar
 * o peer correspondente — apps só-texto não pagam nativo nenhum. Os require
 * são ESTÁTICOS (string literal) dentro de try/catch para o Metro os poder
 * analisar: com `resolver.allowOptionalDependencies` na app, um peer em falta
 * é tolerado (o catch esconde a funcionalidade). require dinâmico — require(var)
 * — é rejeitado pelo Metro, por isso cada getter tem o seu literal.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
declare const require: (modulo: string) => any;

export const obterImagePicker = (): any => {
    try {
        return require('expo-image-picker');
    } catch {
        return null;
    }
};

export const obterDocumentPicker = (): any => {
    try {
        return require('expo-document-picker');
    } catch {
        return null;
    }
};

export const obterAudio = (): any => {
    try {
        return require('expo-audio');
    } catch {
        return null;
    }
};

export const obterVideo = (): any => {
    try {
        return require('expo-video');
    } catch {
        return null;
    }
};

export const obterFileSystem = (): any => {
    // SDK 54+: o entry principal exporta a API nova + stubs deprecados que
    // LANÇAM em runtime; uploadAsync e afins vivem em expo-file-system/legacy.
    try {
        return require('expo-file-system/legacy');
    } catch {
        // SDKs antigos não têm o subpath — o entry principal É a API antiga
    }

    try {
        return require('expo-file-system');
    } catch {
        return null;
    }
};

export const obterLiveKit = (): any => {
    try {
        return require('@livekit/react-native');
    } catch {
        return null;
    }
};

export const obterLiveKitClient = (): any => {
    try {
        return require('livekit-client');
    } catch {
        return null;
    }
};

export const obterFlashList = (): { FlashList: unknown } | null => {
    try {
        return require('@shopify/flash-list');
    } catch {
        return null;
    }
};

export const obterNotifee = (): any => {
    try {
        const m = require('@notifee/react-native');

        return (m as { default?: unknown })?.default ?? m;
    } catch {
        return null;
    }
};

export const obterPushMakaChat = (): any => {
    try {
        return require('@hongayetu/expo-makachat-push');
    } catch {
        return null;
    }
};

// KeyboardAvoidingView robusto (edge-to-edge/Android). Requer a app ter o
// <KeyboardProvider> na raiz. Sem o módulo, cai no KeyboardAvoidingView do RN.
export const obterKeyboardController = (): any => {
    try {
        return require('react-native-keyboard-controller');
    } catch {
        return null;
    }
};
