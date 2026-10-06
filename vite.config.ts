import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

// Siddhānta-Yantra build configuration.
// vite-plugin-glsl lets every shader in src/shaders be imported as a raw string module.
export default defineConfig({
  base: './',
  plugins: [
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      warnDuplicatedImports: true,
      minify: false,
    }),
  ],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});
