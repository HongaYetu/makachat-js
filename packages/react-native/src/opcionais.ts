/**
 * Módulos nativos OPCIONAIS: cada funcionalidade só existe se a app instalar
 * o peer correspondente — apps só-texto não pagam nativo nenhum. O Metro
 * resolve require em runtime; o try/catch esconde a funcionalidade em falta.
 */

// o Metro fornece require em runtime
declare const require: (modulo: string) => unknown;

function carregar<T>(modulo: string): T | null {
    try {
        return require(modulo) as T;
    } catch {
        return null;
    }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const obterImagePicker = (): any => carregar('expo-image-picker');
export const obterDocumentPicker = (): any => carregar('expo-document-picker');
export const obterAudio = (): any => carregar('expo-audio');
export const obterVideo = (): any => carregar('expo-video');
export const obterFileSystem = (): any => carregar('expo-file-system');
export const obterLiveKit = (): any => carregar('@livekit/react-native');
export const obterLiveKitClient = (): any => carregar('livekit-client');
export const obterFlashList = (): { FlashList: unknown } | null => carregar('@shopify/flash-list');
export const obterNotifee = (): any => {
    const m = carregar<{ default?: unknown }>('@notifee/react-native');

    return (m as { default?: unknown })?.default ?? m;
};
export const obterPushMakaChat = (): any => carregar('@hongayetu/expo-makachat-push');
