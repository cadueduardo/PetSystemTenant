import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import PropTypes from 'prop-types';

const MAX_RECORDING_MINUTES = 10;
const MAX_RECORDING_MS = MAX_RECORDING_MINUTES * 60 * 1000;

export default function AudioCaptureWidget({ onRecordingComplete, onError }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Refs para visualizador de onda
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  const cleanupAudioContext = useCallback(() => {
    // Parar o loop de animação
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    // Desconectar nós
    sourceRef.current?.disconnect();
    // Fechar AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Erro ao fechar AudioContext", e));
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    dataArrayRef.current = null;

    // Limpar canvas (opcional)
    if (canvasRef.current) {
        const canvasCtx = canvasRef.current.getContext("2d");
        canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current) {
      animationFrameIdRef.current = null; // Parar se algo estiver faltando
      return;
    }

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const dataArray = dataArrayRef.current;
    const canvasCtx = canvas.getContext("2d");

    // Pega dados da forma de onda
    analyser.getByteTimeDomainData(dataArray);

    // Limpa o canvas
    canvasCtx.fillStyle = "rgb(245 245 245)"; // Cor de fundo (ajuste conforme seu tema)
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Configura a linha
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(37 99 235)"; // Cor da linha (azul primário)
    canvasCtx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / analyser.frequencyBinCount;
    let x = 0;

    for (let i = 0; i < analyser.frequencyBinCount; i++) {
      const v = dataArray[i] / 128.0; // Normaliza o valor (0 a 2)
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2); // Linha final até o meio
    canvasCtx.stroke(); // Desenha a linha

    // Continua o loop de animação
    animationFrameIdRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const getMicrophonePermission = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ title: "Erro", description: "API de mídia não suportada neste navegador.", variant: "destructive" });
      onError?.(new Error("MediaDevices API not supported"));
      setPermissionGranted(false);
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      streamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Erro ao obter permissão do microfone:", err);
      let message = "Falha ao obter permissão do microfone.";
      if (err.name === 'NotAllowedError') {
        message = "Permissão do microfone negada. Por favor, habilite nas configurações do navegador.";
      } else if (err.name === 'NotFoundError') {
        message = "Nenhum microfone encontrado.";
      }
      toast({ title: "Erro de Permissão", description: message, variant: "destructive" });
      onError?.(err);
      setPermissionGranted(false);
      return null;
    }
  }, [onError]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    setIsProcessing(false);
    cleanupAudioContext(); // Limpa contexto anterior, se houver

    let stream = streamRef.current;
    if (!stream || permissionGranted !== true) {
        stream = await getMicrophonePermission();
        if (!stream) return;
    }

    try {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        onRecordingComplete?.(audioBlob);
        cleanupAudioContext(); // Limpa o contexto de áudio ao parar
        clearTimeout(timerRef.current);
        setIsRecording(false);
        setIsProcessing(false);
      };
      
      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        toast({ title: "Erro na Gravação", description: `Ocorreu um erro: ${event.error.message}`, variant: "destructive" });
        onError?.(event.error);
        cleanupAudioContext();
        clearTimeout(timerRef.current);
        setIsRecording(false);
        setIsProcessing(false);
      }

      recorder.start();
      setIsRecording(true);

      // Configura o timer para parar após MAX_RECORDING_MS
      timerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
           toast({ title: "Limite Atingido", description: `Gravação parada automaticamente após ${MAX_RECORDING_MINUTES} minutos.` });
           stopRecording();
        }
      }, MAX_RECORDING_MS);

    } catch (err) {
        console.error("Erro ao iniciar MediaRecorder:", err);
        toast({ title: "Erro ao Iniciar Gravação", description: err.message, variant: "destructive" });
        onError?.(err);
        setIsRecording(false);
        return; // Importante sair se MediaRecorder falhar
    }

    // --- Configuração do AudioContext para Visualização ---
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        // Configurações do Analyser (ajuste conforme necessário)
        analyser.fftSize = 2048; // Tamanho da FFT (potência de 2)
        analyser.smoothingTimeConstant = 0.8;

        // Prepara array para dados da onda
        const bufferLength = analyser.frequencyBinCount; // Metade do fftSize
        dataArrayRef.current = new Uint8Array(bufferLength);

        // Conecta os nós: source -> analyser
        // NÃO conectamos ao destination para não ouvir o próprio microfone
        source.connect(analyser);

        // Inicia o loop de desenho
        drawWaveform();

    } catch(err) {
        console.error("Erro ao configurar AudioContext para visualização:", err);
        toast({ title: "Erro no Visualizador", description: "Não foi possível iniciar o visualizador de onda.", variant: "warning" });
        // Não impede a gravação de continuar, apenas a visualização falha
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // onstop será chamado para finalizar gravação e limpeza
    } else {
        // Se recorder já parou mas contexto ainda existe (raro, mas possível)
        cleanupAudioContext();
    }
    clearTimeout(timerRef.current);
  };

  // Limpa tudo ao desmontar
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      clearTimeout(timerRef.current);
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]); // Adiciona cleanupAudioContext como dependência

  const handleButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  // Verifica permissão na montagem inicial (opcional, pode ser feito só no clique)
  // useEffect(() => {
  //   getMicrophonePermission();
  // }, [getMicrophonePermission]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-card">
      <Button
        onClick={handleButtonClick}
        disabled={isProcessing || permissionGranted === false}
        size="lg"
        className={`rounded-full w-16 h-16 flex items-center justify-center transition-colors duration-300 ${ 
          isRecording 
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
        }`}
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isRecording ? (
          <Square className="h-6 w-6" fill="white"/>
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>
      <p className="text-sm text-muted-foreground">
        {isProcessing ? "Processando..." : isRecording ? `Gravando... (limite ${MAX_RECORDING_MINUTES} min)` : permissionGranted === false ? "Microfone indisponível/negado" : "Clique para gravar"}
      </p>
      {/* Canvas para Visualizador de Onda */}
       <canvas 
         ref={canvasRef} 
         width="300" 
         height="60" 
         className={`border rounded-md ${isRecording ? 'block' : 'hidden'} bg-neutral-50`}
       ></canvas>
    </div>
  );
}

AudioCaptureWidget.propTypes = {
  onRecordingComplete: PropTypes.func.isRequired,
  onError: PropTypes.func,
}; 