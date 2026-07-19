import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    // deps do SDK como external: se bundladas, duplicariam o Contexto do
    // HongaHubProvider e os tipos/classes do core — quebrando a herança.
    external: ['react', 'livekit-client', '@hongayetu/makachat-core', '@hongayetu/honga-hub-react'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.js' : '.cjs' }),
});
