/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^expo-file-system/legacy$': '<rootDir>/tests/mocks/expo-file-system.ts',
    '^expo-file-system$': '<rootDir>/tests/mocks/expo-file-system.ts',
    '^expo-print$': '<rootDir>/tests/mocks/expo-print.ts',
    '^expo-image-manipulator$': '<rootDir>/tests/mocks/expo-image-manipulator.ts',
    '^expo-sharing$': '<rootDir>/tests/mocks/expo-sharing.ts',
    '^expo-intent-launcher$': '<rootDir>/tests/mocks/expo-intent-launcher.ts',
    '^react-native$': '<rootDir>/tests/mocks/react-native.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/tests/mocks/async-storage.ts',
  },
  clearMocks: true,
  resetMocks: false,
  verbose: true,
};
