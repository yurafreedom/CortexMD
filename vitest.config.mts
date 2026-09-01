import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.ts',
      'tests/components/**/*.test.tsx',
      'tests/api/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/pharmacology.ts',
        'src/lib/sigma1.ts',
        'src/lib/indicators/**/*.ts',
        'src/components/Drugs/{DrugCatalog,ActiveScheme}.tsx',
        'src/components/Panels/{BottomBar,RightPanel,ZonePopup}.tsx',
        'src/components/Presets/PresetComparisonModal.tsx',
        'src/components/Sigma1/CascadeOverlay.tsx',
        'src/components/GlutamateCascade/GlutamateCascadeOverlay.tsx',
      ],
    },
  },
});
