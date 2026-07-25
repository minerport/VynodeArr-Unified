import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientRoot=fileURLToPath(new URL('.',import.meta.url));

export default defineConfig({
  root:clientRoot,
  plugins:[react()],
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{
    minify:'oxc',
    outDir:fileURLToPath(new URL('../public/react/',import.meta.url)),
    emptyOutDir:true,
    lib:{
      entry:fileURLToPath(new URL('./src/react-islands.tsx',import.meta.url)),
      formats:['es'],
      fileName:()=> 'vynodearr-react.js'
    },
    rollupOptions:{
      output:{
        assetFileNames:(asset)=>asset.names.some((name)=>name.endsWith('.css'))
          ?'vynodearr-react.css'
          :'assets/[name]-[hash][extname]'
      }
    }
  }
});
