import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-native'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.js' : '.cjs' }),
});
