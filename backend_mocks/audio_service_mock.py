# audio_service_mock.py
import asyncio
import json
import random
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Configuração do CORS (ajuste conforme necessário)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite todas as origens (para desenvolvimento)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simulação de armazenamento de sessões ativas
# Em um cenário real, isso seria mais robusto (e.g., Redis, DB)
active_sessions = {}

# Palavras fictícias para simular transcrição
mock_words = [
    "o", "paciente", "apresenta", "sinais", "de", "melhora", "mas", "ainda",
    "está", "apático", "febre", "persistente", "recomendo", "hemograma",
    "completo", "retorno", "em", "dois", "dias", "aumentar", "dose", "medicação",
    "tutor", "relatou", "vômito", "hoje", "pela", "manhã", "coceira", "intensa",
    "na", "região", "lombar", "examinar", "pele", "cuidadosamente", "diarreia",
    "líquida", "hidratar", "bem", "oferecer", "água", "constantemente", "parou",
    "de", "comer", "investigar", "causa", "urgente",
]

@app.post("/start_recording")
async def start_recording():
    """Inicia uma nova sessão de gravação e retorna um ID de sessão."""
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {"status": "recording", "transcript_parts": []}
    print(f"Sessão iniciada: {session_id}")
    return {"sessionId": session_id}

@app.websocket("/audio_stream/{session_id}")
async def audio_stream(websocket: WebSocket, session_id: str):
    """Recebe stream de áudio e envia chunks de transcrição simulados."""
    if session_id not in active_sessions:
        await websocket.close(code=1008, reason="Invalid session ID")
        print(f"Tentativa de conexão WS com ID inválido: {session_id}")
        return

    await websocket.accept()
    print(f"Cliente WS conectado para sessão: {session_id}")
    session = active_sessions[session_id]

    try:
        while True:
            # 1. Receber dados de áudio (ignoramos no mock)
            try:
                # Espera por dados por um tempo limitado para não bloquear o envio
                audio_data = await asyncio.wait_for(websocket.receive_bytes(), timeout=0.5)
                # print(f"Recebido chunk de áudio ({len(audio_data)} bytes) para sessão {session_id}")
                # Em um app real, processaria audio_data
            except asyncio.TimeoutError:
                # Timeout significa que o cliente pode não estar enviando ativamente,
                # mas continuamos enviando transcrição simulada.
                pass
            except WebSocketDisconnect:
                # Cliente desconectou enquanto esperávamos dados
                print(f"Cliente WS desconectou (recebendo) para sessão: {session_id}")
                raise # Re-levanta para o finally tratar

            # 2. Simular e enviar chunk de transcrição
            await asyncio.sleep(random.uniform(0.3, 1.0)) # Simula tempo de processamento
            mock_chunk = random.choice(mock_words)
            session["transcript_parts"].append(mock_chunk) # Armazena para relatório final

            transcript_message = json.dumps({"transcript_chunk": f"{mock_chunk} "})
            await websocket.send_text(transcript_message)
            # print(f"Enviado chunk de transcrição para sessão {session_id}: {mock_chunk}")

    except WebSocketDisconnect:
        print(f"Cliente WS desconectou (enviando/loop) para sessão: {session_id}")
    except Exception as e:
        print(f"Erro inesperado no WebSocket para sessão {session_id}: {e}")
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        print(f"Fechando conexão WS para sessão: {session_id}")
        # Limpeza pode ocorrer aqui ou no /end_recording dependendo da lógica
        if session_id in active_sessions and active_sessions[session_id].get("status") != "ended":
             # Se a sessão não foi finalizada via /end_recording, marca como desconectada
             active_sessions[session_id]["status"] = "disconnected"


@app.post("/end_recording")
async def end_recording(session_info: dict = Body(...)):
    """Finaliza a sessão de gravação e gera um relatório fictício."""
    session_id = session_info.get("sessionId")
    if not session_id or session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session ID not found or invalid")

    print(f"Finalizando sessão: {session_id}")
    session = active_sessions.pop(session_id) # Remove a sessão das ativas

    # Gerar relatório fictício
    full_transcript = " ".join(session.get("transcript_parts", []))
    report = {
        "sessionId": session_id,
        "status": "completed",
        "duration_seconds": random.randint(15, 120), # Duração simulada
        "final_transcript": full_transcript + ".", # Adiciona ponto final
        "confidence_score": random.uniform(0.75, 0.98), # Confiança simulada
        "detected_keywords": random.sample(mock_words, k=random.randint(0, 4)), # Palavras-chave simuladas
        "report_generated_at": await asyncio.to_thread(lambda: datetime.now().isoformat()), # Usar to_thread para compatibilidade
    }
    print(f"Relatório gerado para sessão {session_id}: {report}")
    return report

# Adicionar import datetime no início do arquivo se não estiver lá
from datetime import datetime

if __name__ == "__main__":
    print("Iniciando Mock Audio Service na porta 8001...")
    # Nota: --reload pode não funcionar bem com WebSockets complexos e estado em memória.
    # Para produção ou testes mais estáveis, rode sem --reload.
    uvicorn.run("audio_service_mock:app", host="127.0.0.1", port=8001, log_level="info", reload=True)
