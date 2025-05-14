module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "functions/", // Ignora a pasta functions que já tem seu próprio .eslintrc.js
    "src/components/",
    "src/pages/",
    "src/hooks/",
    "src/stores/",
    "src/context/",
    "src/main.jsx",
    "src/App.jsx"
    // Adicionar outros padrões de frontend se necessário
  ],
  rules: {
    // Adicionar regras específicas se necessário
  }
}; 