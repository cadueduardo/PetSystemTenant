# backend_mocks/audio_service_mock.py
import asyncio
import json
import os
import random
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import google.generativeai as genai
from dotenv import load_dotenv # Para carregar variáveis de ambiente de um arquivo .env (opcional)

# Carrega variáveis de ambiente do arquivo .env (se existir)
# Crie um arquivo .env na mesma pasta com GEMINI_API_KEY=SUA_CHAVE
load_dotenv()

app = FastAPI()

# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurar a API do Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("ERRO: Variável de ambiente GEMINI_API_KEY não definida.")
    # Poderia sair ou continuar sem a funcionalidade Gemini
    # exit() # Descomente se quiser que o servidor pare se a chave não for encontrada
genai.configure(api_key=GEMINI_API_KEY)

# Modelo Gemini a ser usado (ex: gemini-1.5-flash é rápido e eficiente)
gemini_model = genai.GenerativeModel('gemini-1.5-flash')

# Simulação de armazenamento de sessões ativas
active_sessions = {}

# --- Função para chamar a API do Gemini ---
async def get_gemini_suggestions(transcript: str):
    if not GEMINI_API_KEY:
         return {"error": "API Key do Gemini não configurada."}
    if not transcript or not transcript.strip():
        return {"suggestions": [], "error": "Transcrição vazia."}

    print(f"\n--- Chamando API Gemini para transcrição: ---\n{transcript}\n--------------------------------------------")

    prompt = f"""
    Você é um assistente veterinário experiente. Analise a seguinte transcrição da conversa entre um veterinário e um tutor de pet durante uma consulta.
    Com base APENAS na transcrição fornecida, sugira:
    1. Uma lista curta (máximo 5) de possíveis hipóteses diagnósticas diferenciais relevantes. Liste apenas os nomes das condições.
    2. Uma lista curta (máximo 3) de perguntas de acompanhamento importantes que o veterinário poderia fazer para esclarecer o caso.

    Transcrição:
    ---
    {transcript}
    ---

    Formato da Resposta Esperada (JSON):
    {{
      "possible_diagnoses": ["Diagnóstico 1", "Diagnóstico 2", ...],
      "follow_up_questions": ["Pergunta 1?", "Pergunta 2?", ...]
    }}

    Se a transcrição for muito curta ou não contiver informações clínicas suficientes, retorne listas vazias.
    """

    try:
        # Chamada assíncrona para a API
        response = await gemini_model.generate_content_async(prompt)

        # Extrair e tentar parsear a resposta JSON
        response_text = response.text.strip()
        print(f"--- Resposta Bruta da API Gemini: ---\n{response_text}\n-----------------------------------")

        # Tenta limpar e extrair o JSON da resposta (às vezes a API inclui ```json ... ```)
        json_response = None
        if "```json" in response_text:
            try:
                json_str = response_text.split("```json")[1].split("```")[0].strip()
                json_response = json.loads(json_str)
            except Exception as e:
                print(f"Erro ao extrair/parsear JSON demarcado: {e}")
                # Tenta parsear o texto completo como fallback
                try:
                    json_response = json.loads(response_text)
                except json.JSONDecodeError:
                     print("Falha ao parsear a resposta completa como JSON também.")
                     json_response = None
        else:
             # Se não tem a demarcação, tenta parsear diretamente
            try:
                 json_response = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"Erro ao parsear a resposta direta como JSON: {e}")
                json_response = None

        if json_response and isinstance(json_response, dict):
            # Valida se as chaves esperadas existem, mesmo que vazias
            diagnoses = json_response.get("possible_diagnoses", [])
            questions = json_response.get("follow_up_questions", [])

            # Garante que são listas
            if not isinstance(diagnoses, list): diagnoses = []
            if not isinstance(questions, list): questions = []

            return {
                "possible_diagnoses": diagnoses,
                "follow_up_questions": questions
            }
        else:
             print("Resposta da API Gemini não estava no formato JSON esperado.")
             # Retorna uma estrutura vazia como fallback
             return {
                 "possible_diagnoses": [],
                 "follow_up_questions": [],
                 "error": "Formato de resposta inválido da API Gemini."
             }

    except Exception as e:
        print(f"ERRO ao chamar a API Gemini: {e}")
        # Verificar se o erro é específico de segurança/bloqueio
        error_message = f"Erro na comunicação com a API Gemini: {e}"
        try:
             if response.prompt_feedback.block_reason:
                 error_message = f"Chamada bloqueada pela API Gemini. Razão: {response.prompt_feedback.block_reason}"
                 print(f"BLOCK REASON: {response.prompt_feedback.block_reason}")
        except Exception:
             pass # Ignora se não conseguir acessar feedback
        return {"error": error_message}


# --- Endpoints da API Mock (Atualizados) ---

@app.post("/start_recording")
async def start_recording():
    session_id = str(uuid.uuid4())
    # Armazena apenas o necessário para o fluxo
    active_sessions[session_id] = {"status": "recording", "full_transcript": ""}
    print(f"Sessão iniciada: {session_id}")
    return {"sessionId": session_id}

@app.websocket("/audio_stream/{session_id}")
async def audio_stream(websocket: WebSocket, session_id: str):
    if session_id not in active_sessions:
        await websocket.close(code=1008, reason="Invalid session ID")
        return
    await websocket.accept()
    print(f"Cliente WS conectado para sessão: {session_id}")
    session = active_sessions[session_id]

    try:
        while True:
            audio_data = await websocket.receive_bytes()
            # print(f"Recebido chunk de áudio ({len(audio_data)} bytes) para sessão {session_id}")
            # Em um mock, não fazemos transcrição real aqui.
            # Poderíamos simular chunks de transcrição como antes, se quiséssemos UI em tempo real AINDA.
            # Por agora, vamos focar na chamada final ao Gemini.
            # Opcional: Enviar confirmação de recebimento?
            # await websocket.send_text(json.dumps({"status": "chunk_received"}))

    except WebSocketDisconnect:
        print(f"Cliente WS desconectou para sessão: {session_id}")
    except Exception as e:
        print(f"Erro inesperado no WebSocket para sessão {session_id}: {e}")
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        print(f"Fechando conexão WS para sessão: {session_id}")
        if session_id in active_sessions:
             active_sessions[session_id]["status"] = "disconnected" # Marca como desconectado

@app.post("/end_recording")
async def end_recording(session_info: dict = Body(...)):
    session_id = session_info.get("sessionId")
    # << Adicionado: Receber a transcrição final do frontend >>
    final_transcript_from_client = session_info.get("finalTranscript", "")

    if not session_id or session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session ID not found or invalid")

    print(f"Finalizando sessão: {session_id}")
    session = active_sessions.pop(session_id) # Remove a sessão das ativas

    # Usa a transcrição enviada pelo cliente
    full_transcript = final_transcript_from_client.strip()
    print(f"Transcrição final recebida do cliente para sessão {session_id}: {full_transcript}")

    # << Chama a API do Gemini >>
    gemini_results = await get_gemini_suggestions(full_transcript)

    # Gerar relatório final
    report = {
        "sessionId": session_id,
        "status": "completed",
        "final_transcript": full_transcript,
        "gemini_analysis": gemini_results, # Inclui as sugestões ou erro da Gemini
        "report_generated_at": datetime.now().isoformat(),
    }
    print(f"Relatório gerado para sessão {session_id}: {json.dumps(report, indent=2)}")
    return report


if __name__ == "__main__":
    port = 8001 # Mantém a porta 8001 para este serviço
    print(f"Iniciando Mock Audio Service com Integração Gemini na porta {port}...")
    if not GEMINI_API_KEY:
         print("AVISO: GEMINI_API_KEY não definida. As sugestões do Gemini não funcionarão.")
    # Roda sem reload para estabilidade com chamadas de API e estado em memória
    uvicorn.run("audio_service_mock:app", host="127.0.0.1", port=port, log_level="info")