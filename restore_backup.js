const fs = require('fs');
const path = require('path');

// Caminho do backup
const backupPath = path.join(__dirname, '..', 'vetsystem - Copia');

// Caminho atual do projeto
const currentPath = __dirname;

// Função para copiar diretórios recursivamente
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Copia os arquivos do backup para o diretório atual
  copyDir(backupPath, currentPath);
  console.log('Backup restaurado com sucesso!');
} catch (error) {
  console.error('Erro ao restaurar backup:', error);
} 