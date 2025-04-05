# C:\Projects\VetMocks\mock_api.py
import asyncio
import os
import tempfile
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# Importa a biblioteca do Google Cloud Speech
from google.cloud import speech_v1p1beta1 as speech # Usando v1p1beta1 para mais recursos, se necessário

app = FastAPI()

# Configuração Essencial do CORS (sem alterações)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transcribe")
async def transcribe_audio_google(audio: UploadFile):
    # **IMPORTANTE: Garanta que a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS
    # está definida no terminal ANTES de rodar o uvicorn!**
    # Ex: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/keyfile.json" (Linux/Mac/Git Bash)
    # Ex: set GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\keyfile.json" (Windows CMD)
    # Ex: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\keyfile.json" (PowerShell)

    try:
        # Instancia o cliente do Google Cloud Speech
        # Ele usará automaticamente as credenciais da variável de ambiente
        client = speech.SpeechClient()

        # Lê o conteúdo do áudio enviado
        content = await audio.read()
        print(f"Recebido áudio: {audio.filename}, tipo: {audio.content_type}, tamanho: {len(content)} bytes")

        # Configura o reconhecimento
        # Precisamos saber ou detectar o formato/encoding.
        # O MediaRecorder no navegador geralmente grava em 'audio/webm;codecs=opus'
        # Google Speech-to-Text suporta WebM/Opus.
        # Se a taxa de amostragem for conhecida, é bom especificar. Senão, deixamos em 0 para autodetecção.
        recognition_config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS, # Tentar WEBM_OPUS
            # Se WEBM_OPUS não funcionar diretamente, pode ser necessário converter ou usar outra encoding
            # como LINEAR16 (requereria conversão/especificação de sample_rate_hertz)
            # Vamos começar sem especificar encoding e sample_rate para ver se a API detecta
            # sample_rate_hertz=0, # 0 para auto-detecção (pode aumentar custo/latência)
            sample_rate_hertz=48000,
            language_code="pt-BR", # Especifica o idioma
            # Habilitar pontuação automática (modelos mais recentes)
            enable_automatic_punctuation=True,
            # Se precisar de diarização (quem falou o quê), configure aqui
            # enable_speaker_diarization=True,
            # diarization_config=speech.SpeakerDiarizationConfig(
            #     enable_speaker_diarization=True,
            #     min_speaker_count=1, # Ajuste conforme necessidade
            #     max_speaker_count=2, # Ajuste conforme necessidade
            # ),
            model="telephony", # Usar modelo padrão (ou especificar outros como 'telephony', 'medical_dictation')
            # 'medical_dictation' pode ser interessante, mas verifique disponibilidade e preço
        )

        recognition_audio = speech.RecognitionAudio(content=content)

        print("Enviando áudio para a API Google Cloud Speech-to-Text...")
        # Realiza a chamada síncrona (para arquivos curtos/médios)
        # Para áudios muito longos (> 1 min), usar recognize_long_running
        response = client.recognize(config=recognition_config, audio=recognition_audio)
        print("Resposta recebida da API Google.")

        # Processa os resultados
        transcript = ""
        if response.results:
            transcript = response.results[0].alternatives[0].transcript
            print(f"Transcrição: {transcript}")
        else:
            print("Nenhuma transcrição retornada pela API Google.")
            transcript = "[Nenhuma transcrição obtida]"


        return {"text": transcript}

    except Exception as e:
        print(f"Erro ao chamar a API Google Cloud Speech: {e}")
        # Considerar retornar um erro mais específico baseado na exceção do Google Cloud
        raise HTTPException(status_code=500, detail=f"Erro na API de transcrição Google: {e}")


@app.get("/")
async def read_root():
    return {"message": "Servidor de Transcrição (Google Cloud) está online!"}

# --- (Linhas para rodar com `python mock_api.py` permanecem comentadas) ---