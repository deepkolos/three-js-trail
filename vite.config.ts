import { UserConfig } from 'vite';

export default {
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Trail',
      fileName: 'Trail',
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['three'],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: { three: 'THREE' },
      },
    },
  },
} satisfies UserConfig;
