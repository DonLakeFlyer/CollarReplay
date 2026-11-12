import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    // Inline everything into dist/index.html so the app is one file to upload or open from disk.
    plugins: [viteSingleFile()],
});
