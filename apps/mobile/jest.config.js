module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
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
