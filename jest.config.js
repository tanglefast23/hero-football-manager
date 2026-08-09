module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // .tsx too, or a component test would be collected by nothing and silently
  // never run.
  testMatch: ['**/__tests__/**/*.test.@(ts|tsx)'],
  // Transpile-only (no type-checking during the test run) so the acceptance
  // gates parallelize across workers without each one re-typechecking every
  // file it imports. The type gate is npx tsc --noEmit, run separately in CI
  // and before every commit here — this is not a substitute for it.
  transform: {
    // tsconfig.json extends expo/tsconfig.base (module: "preserve", allowJs: true)
    // for Metro's bundler. Two overrides needed only for ts-jest's own transform,
    // the app's real tsconfig is untouched: (1) module: "preserve" isn't runnable
    // CommonJS, which Jest needs; (2) allowJs makes ts-jest default outDir to an
    // internal constant, and TS 6 hard-errors (TS5011) on outDir without an
    // explicit rootDir — set rootDir to the project root to satisfy that.
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', rootDir: '.', isolatedModules: true } },
    ],
  },
  setupFiles: ['<rootDir>/src/i18n/jest-register-catalogs.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/source-contract-matchers.ts'],
  // Metro assets (require('*.wav'/'*.m4a'/'*.txt')) can't load as JS modules under
  // Jest — Metro handles them in the app. Stub them so audio.ts (and its pure
  // event→sound mapping) is importable in tests.
  moduleNameMapper: {
    '\\.(wav|m4a|txt)$':
      '<rootDir>/src/render/__tests__/__mocks__/assetStub.js',
  },
  // Long-running measurement probes are opt-in via `npm run test:probe -- <path>`.
  // Keep the acceptance-seed audit test in the normal suite.
  testPathIgnorePatterns: [
    '<rootDir>/src/audit/__tests__/.*-probe\\.test\\.ts$',
  ],
};
