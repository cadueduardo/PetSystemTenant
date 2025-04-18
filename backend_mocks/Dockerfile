# Use uma imagem base oficial do Python
# Escolha uma versão compatível com suas dependências (ex: 3.10, 3.11)
FROM python:3.10-slim

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia o arquivo de dependências para o diretório de trabalho
COPY requirements.txt .

# Instala as dependências
# --no-cache-dir economiza espaço na imagem
# --upgrade pip garante que o pip está atualizado
RUN pip install --no-cache-dir --upgrade pip -r requirements.txt

# Copia o restante do código da aplicação para o diretório de trabalho
# (Inclui .py, .env se você usar, etc.)
COPY . .

# Expõe a porta que o Cloud Run espera (mesma que o getenv usa)
# Embora o Cloud Run injete a variável PORT, é boa prática expor.
EXPOSE 8080

# Comando para executar a aplicação quando o contêiner iniciar
# Usa uvicorn diretamente, como no seu script original, mas sem o if __name__
# O Cloud Run passará a variável PORT correta automaticamente.
CMD ["uvicorn", "audio_service_mock:app", "--host", "0.0.0.0", "--port", "8080"] 