module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': 'off', // Отключаем проверку переносов строк для Windows
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': 'off'
  }
};
