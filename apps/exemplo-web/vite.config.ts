import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        // pacotes do workspace mudam a cada build — nunca pré-empacotar/cachear
        exclude: ['@hongayetu/makachat-react', '@hongayetu/honga-hub-core'],
    },
});
