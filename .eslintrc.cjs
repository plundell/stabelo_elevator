module.exports = {
	root: true,
	env: { node: true },
	parser: "@typescript-eslint/parser",
	plugins: ["@typescript-eslint"],
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended"
	],
	rules: {
		"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
		// "@typescript-eslint/no-unused-vars": "warn"
		, "prefer-const": "warn"
		, "@typescript-eslint/no-extra-semi": "warn"
		, "no-extra-semi": "off" //otherwise duplicate with ^
		, "@typescript-eslint/no-explicit-any": "warn" //explicit is fine, i'm not your babysitter
	}
};