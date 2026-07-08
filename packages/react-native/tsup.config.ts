import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
        'react',
        'react-native',
        'expo-sqlite',
        '@expo/vector-icons',
        '@shopify/flash-list',
        '@livekit/react-native',
        'livekit-client',
        '@livekit/react-native-webrtc',
        'expo-audio',
        'expo-video',
        'expo-image-picker',
        'expo-document-picker',
        'expo-file-system',
    ],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.js' : '.cjs' }),
});
