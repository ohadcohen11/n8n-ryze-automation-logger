module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		project: './tsconfig.json',
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'plugin:n8n-nodes-base/community',
	],
	rules: {
		// Custom rules can be added here
	},
	ignorePatterns: [
		'dist/**',
		'node_modules/**',
		'*.js',
		'gulpfile.js',
	],
};
