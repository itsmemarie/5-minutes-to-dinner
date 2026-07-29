import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build of the reusable UI primitives (src/components/index.js),
// separate from the app build (vite.config.js). Produces an ES module with
// named component exports for the design-sync tool.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      entry: 'src/components/index.js',
      formats: ['es'],
      fileName: () => 'index.es.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
})
