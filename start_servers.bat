@echo off
echo Iniciando todos os servidores...

:: Inicia o servidor de desenvolvimento (npm run dev)
start cmd /k "echo Iniciando servidor de desenvolvimento... && npm run dev"

:: Inicia o servidor Python na porta 8000
start cmd /k "cd backend_mocks && echo Iniciando servidor Python na porta 8000... && python -m uvicorn mock_api:app --port=8000 --reload"

:: Inicia o servidor Python na porta 8001
start cmd /k "cd backend_mocks && echo Iniciando servidor de áudio na porta 8001... && python audio_service_mock.py"

echo Todos os servidores foram iniciados!
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul 