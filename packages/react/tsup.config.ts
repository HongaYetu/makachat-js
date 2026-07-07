import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'livekit-client'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.js' : '.cjs' }),
});
