module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/*.test.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/**/__tests__/**',
	],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
};

