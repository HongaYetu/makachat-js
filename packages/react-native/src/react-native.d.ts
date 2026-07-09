/**
 * Tipos mínimos das peerDependencies (não instaladas no monorepo).
 * A app consumidora usa os tipos reais; aqui só precisamos de compilar.
 */
declare module 'react-native' {
    export const View: any;
    export const Text: any;
    export const FlatList: any;
    export type FlatListProps<T> = Record<string, any> & { data?: readonly T[] | null };
    export const TextInput: any;
    export const TouchableOpacity: any;
    export const Pressable: any;
    export const Modal: any;
    export const Image: any;
    export const ScrollView: any;
    export const KeyboardAvoidingView: any;
    export const SafeAreaView: any;
    export const ActivityIndicator: any;
    export const Alert: { alert(titulo: string, mensagem?: string, botoes?: any[], opcoes?: any): void };
    export const Platform: { OS: string; select<T>(specifics: Record<string, T>): T };
    export const Dimensions: { get(dim: string): { width: number; height: number } };
    export const useWindowDimensions: () => { width: number; height: number };
    export const AppState: {
        currentState: string;
        addEventListener(tipo: string, handler: (estado: string) => void): { remove(): void };
    };
    export const PanResponder: {
        create(config: Record<string, any>): { panHandlers: Record<string, any> };
    };
    export const Animated: {
        View: any;
        Text: any;
        Value: new (v: number) => any;
        timing(v: any, config: any): { start(cb?: () => void): void; stop(): void };
        spring(v: any, config: any): { start(cb?: () => void): void; stop(): void };
        loop(anim: any): { start(): void; stop(): void };
        sequence(anims: any[]): any;
        event(mapeamento: any[], config?: any): any;
    };
    export const Linking: { openURL(url: string): Promise<void> };
    export const Share: { share(conteudo: { message?: string; url?: string }): Promise<any> };
    export const Vibration: { vibrate(padrao?: number | number[]): void };
    export const StyleSheet: {
        create<T>(estilos: T): T;
        absoluteFillObject: any;
    };
}

declare module '@expo/vector-icons' {
    export const Ionicons: {
        (props: { name: string; size?: number; color?: string; style?: any }): any;
        glyphMap: Record<string, number>;
    };
}

declare module 'react-native-safe-area-context' {
    export function useSafeAreaInsets(): { top: number; bottom: number; left: number; right: number };
}

declare module '@gorhom/bottom-sheet' {
    // tipo (para useRef) + valor (componente) com o mesmo nome
    export type BottomSheetModal = { present(): void; dismiss(): void };
    export const BottomSheetModal: any;
    export const BottomSheetModalProvider: any;
    export const BottomSheetView: any;
    export const BottomSheetBackdrop: any;
}
