
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlayCircle, PauseCircle, StopCircle, Clock } from 'lucide-react';

export default function ServiceTimer({ service, onUpdateStatus, compact = false }) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    if (service && service.start_time) {
      const startTime = new Date(service.start_time);
      const now = new Date();
      let totalPauseTime = 0;

      if (service.pauses && Array.isArray(service.pauses)) {
        service.pauses.forEach(pause => {
          if (pause.start && pause.end) {
            const pauseStart = new Date(pause.start);
            const pauseEnd = new Date(pause.end);
            totalPauseTime += (pauseEnd - pauseStart) / 1000;
          } else if (pause.start && !pause.end) {
            const pauseStart = new Date(pause.start);
            totalPauseTime += (now - pauseStart) / 1000;
          }
        });
      }

      const totalElapsed = (now - startTime) / 1000 - totalPauseTime;
      setElapsedTime(Math.max(0, totalElapsed));

      if (service.status === "in_progress" && !isRunning) {
        startTimer();
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [service]);

  useEffect(() => {
    if (service.status === "in_progress" && !isRunning) {
      startTimer();
    } else if (service.status !== "in_progress" && isRunning) {
      stopTimer();
    }
  }, [service.status]);

  const startTimer = () => {
    setIsRunning(true);
    const id = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    setIntervalId(id);
  };

  const stopTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsRunning(false);
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) {
      return;
    }
    stopTimer();
    await onUpdateStatus("paused", { pauseReason });
    setShowPauseDialog(false);
    setPauseReason("");
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (compact) {
      return `${hours > 0 ? hours + 'h ' : ''}${minutes}m`;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    const expectedDuration = service.service?.duration || 0; // em minutos
    const elapsedMinutes = Math.floor(elapsedTime / 60);
    
    if (elapsedMinutes <= expectedDuration * 0.8) {
      return "bg-green-100 text-green-800";
    } else if (elapsedMinutes <= expectedDuration * 1.2) {
      return "bg-yellow-100 text-yellow-800";
    } else {
      return "bg-red-100 text-red-800";
    }
  };

  if (compact) {
    return (
      <Badge className={getStatusColor()}>
        {formatTime(elapsedTime)}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={getStatusColor()}>
        <Clock className="h-4 w-4 mr-1" />
        {formatTime(elapsedTime)}
      </Badge>

      {service.status === "scheduled" && (
        <Button
          size="sm"
          onClick={() => onUpdateStatus("in_progress")}
        >
          <PlayCircle className="h-4 w-4 mr-2" />
          Iniciar
        </Button>
      )}

      {service.status === "in_progress" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPauseDialog(true)}
          >
            <PauseCircle className="h-4 w-4 mr-2" />
            Pausar
          </Button>
          <Button
            size="sm"
            onClick={() => onUpdateStatus("completed")}
          >
            <StopCircle className="h-4 w-4 mr-2" />
            Concluir
          </Button>
        </>
      )}

      {service.status === "paused" && (
        <Button
          size="sm"
          onClick={() => onUpdateStatus("in_progress")}
        >
          <PlayCircle className="h-4 w-4 mr-2" />
          Retomar
        </Button>
      )}

      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Pausa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                placeholder="Informe o motivo da pausa..."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPauseDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handlePause}>
              Confirmar Pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
