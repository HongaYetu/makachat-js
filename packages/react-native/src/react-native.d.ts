/**
 * Tipos mínimos do react-native (peerDependency — não instalado no monorepo).
 * A app consumidora usa os tipos reais; aqui só precisamos de compilar.
 */
declare module 'react-native' {
    export const View: any;
    export const Text: any;
    export const FlatList: any;
    export const TextInput: any;
    export const TouchableOpacity: any;
    export const Image: any;
    export const KeyboardAvoidingView: any;
    export const Platform: { OS: string };
    export const ActivityIndicator: any;
    export const StyleSheet: { create<T>(estilos: T): T };
}
