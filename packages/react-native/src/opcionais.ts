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

export const obterImagePicker = () => carregar<typeof import('expo-image-picker')>('expo-image-picker');
export const obterDocumentPicker = () => carregar<typeof import('expo-document-picker')>('expo-document-picker');
export const obterAv = () => carregar<typeof import('expo-av')>('expo-av');
export const obterFileSystem = () => carregar<typeof import('expo-file-system')>('expo-file-system');
export const obterLiveKit = () => carregar<any>('@livekit/react-native');
export const obterFlashList = () => carregar<{ FlashList: unknown }>('@shopify/flash-list');
