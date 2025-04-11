import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CancellationReason } from '@/api/entities';
import { toast } from "@/components/ui/use-toast";
import PropTypes from 'prop-types';

export default function RemoveFromQueueModal({ isOpen, onClose, onConfirm, item }) {
  const [reasons, setReasons] = useState([]);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Carrega os motivos do Firebase quando o modal abre
      const loadReasons = async () => {
        setIsLoadingReasons(true);
        try {
          const tenantId = localStorage.getItem('current_tenant');
          if (!tenantId) {
             console.error("Tenant ID not found for loading reasons.");
             toast({ title: "Erro", description: "ID da clínica não encontrado.", variant: "destructive" });
             setReasons([]);
             return;
          }
          const loadedReasons = await CancellationReason.list(tenantId);
          // Ensure loadedReasons is an array before setting
          setReasons(Array.isArray(loadedReasons) ? loadedReasons : []);
        } catch (error) {
           console.error("Error loading cancellation reasons:", error);
           toast({ title: "Erro", description: "Não foi possível carregar os motivos.", variant: "destructive" });
           setReasons([]); // Set empty on error
        } finally {
            setIsLoadingReasons(false);
        }
      };
      loadReasons();
      
      // Reseta os estados
      setSelectedReason('');
      setOtherReason('');
      setShowOtherInput(false);
    }
  }, [isOpen]);

  const handleReasonChange = (value) => {
    setSelectedReason(value);
    if (value === '__other__') {
      setShowOtherInput(true);
    } else {
      setShowOtherInput(false);
      setOtherReason(''); // Limpa o campo "outro" se uma razão existente for selecionada
    }
  };

  const handleConfirmClick = () => {
    if (showOtherInput) {
      if (!otherReason.trim()) {
        // Adicionar alguma validação/feedback para o usuário aqui se necessário
        alert("Por favor, especifique o motivo em 'Outros'.");
        return;
      }
      // Passa "__other__" como marcador e o texto do novo motivo
      onConfirm("__other__", otherReason.trim());
    } else {
      if (!selectedReason) {
        alert("Por favor, selecione um motivo.");
        return;
      }
      // Passa o motivo selecionado
      onConfirm(selectedReason);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}> 
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover Item da Fila</DialogTitle>
          <DialogDescription>
            Selecione o motivo para remover o atendimento de {''}
            <strong>{item?.pet?.name || 'Pet não encontrado'}</strong> da fila.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason-select">Motivo da Remoção</Label>
            <Select value={selectedReason} onValueChange={handleReasonChange} disabled={isLoadingReasons}>
              <SelectTrigger id="reason-select">
                <SelectValue placeholder={isLoadingReasons ? "Carregando motivos..." : "Selecione um motivo..."} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reasonDoc) => (
                  <SelectItem key={reasonDoc.id} value={reasonDoc.reason}>
                    {reasonDoc.reason}
                  </SelectItem>
                ))}
                <SelectItem value="__other__">Outros...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showOtherInput && (
            <div className="space-y-2">
              <Label htmlFor="other-reason">Especificar Motivo</Label>
              <Input 
                id="other-reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Digite o novo motivo..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmClick} 
            disabled={!selectedReason || (selectedReason === '__other__' && !otherReason.trim())}
          >
            Confirmar Remoção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

RemoveFromQueueModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    item: PropTypes.shape({
        pet: PropTypes.shape({
            name: PropTypes.string
        })
        // Add other expected properties of item if needed
    })
}; 