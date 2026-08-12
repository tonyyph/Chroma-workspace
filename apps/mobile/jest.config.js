module.exports = {
  preset: 'jest-expo',
  // Mirrors the `paths` in tsconfig.json. The app spells the workspace packages
  // `@cw/*`; the packages themselves keep their published `@chromawave/*` names,
  // and `@chromawave/analytics` reaches the domain by that name, so both
  // spellings have to resolve — to the same file, or the domain loads twice.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cw/analytics$': '<rootDir>/../../packages/analytics/src/index.ts',
    '^@cw/domain$': '<rootDir>/../../packages/domain/src/index.ts',
    '^@cw/tokens$': '<rootDir>/../../packages/design-tokens/src/index.ts',
    '^@chromawave/analytics$': '<rootDir>/../../packages/analytics/src/index.ts',
    '^@chromawave/design-tokens$': '<rootDir>/../../packages/design-tokens/src/index.ts',
    '^@chromawave/domain$': '<rootDir>/../../packages/domain/src/index.ts',
    '^@react-native/assets-registry/registry$':
      '<rootDir>/node_modules/@react-native/assets-registry/registry.js',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/_layout.tsx'],
};
