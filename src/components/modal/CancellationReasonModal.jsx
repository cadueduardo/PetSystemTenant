import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, functions } from '@/lib/firebaseConfig';
import { useTenant } from '@/components/tenant/TenantContext';
import { httpsCallable } from "firebase/functions";

// Props esperadas:
// - isOpen: boolean
// - onClose: () => void
// - onConfirm: (originalItemId: string, originalDocumentId: string, reason: string) => Promise<void>
// - item: { cartItemId: string, id: string, name: string, originalDocumentId: string, ... } (Objeto do item do carrinho com id original)
export default function CancellationReasonModal({ isOpen, onClose, onConfirm, item }) {
  const { currentTenant } = useTenant();
  const [reasonsList, setReasonsList] = useState([]);
  const [isLoadingReasons, setIsLoadingReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentTenant?.id) {
      fetchReasons(currentTenant.id);
      setSelectedReason('');
      setOtherReasonText('');
      setShowOtherInput(false);
    } else if (!isOpen) {
      setReasonsList([]);
    }
  }, [isOpen, currentTenant]);

  const fetchReasons = async (tenantId) => {
    setIsLoadingReasons(true);
    try {
      console.log(`[CancellationReasonModal] Buscando motivos para tenant: ${tenantId}`);
      const reasonsRef = collection(db, 'tenants', tenantId, 'cancellation_reasons');
      const q = query(reasonsRef, orderBy('reasonText', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedReasons = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("[CancellationReasonModal] Motivos buscados:", fetchedReasons);
      
      const standardOptions = [
        { id: 'placeholder', reasonText: '[ Selecione um motivo ]' },
        { id: 'other', reasonText: 'Outros...' }
      ];
      const combined = [...standardOptions, ...fetchedReasons.map(r => ({ id: r.id, reasonText: r.reasonText }))];
      const uniqueReasons = Array.from(new Map(combined.map(item => [item.reasonText, item])).values());

      setReasonsList(uniqueReasons);
    } catch (error) {
      console.error("[CancellationReasonModal] Erro ao buscar motivos:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os motivos de cancelamento.", variant: "destructive"});
      setReasonsList([{ id: 'error', reasonText: '[ Erro ao carregar ]' }, { id: 'other', reasonText: 'Outros...' }]);
    } finally {
      setIsLoadingReasons(false);
    }
  };

  const saveOtherReason = async (reasonText) => {
    if (!currentTenant?.id || !reasonText.trim()) return;
    setIsSubmitting(true);
    try {
      console.log(`[CancellationReasonModal] Tentando salvar novo motivo: "${reasonText}"`);
      const addReasonFunction = httpsCallable(functions, 'addCancellationReason');
      const result = await addReasonFunction({ reasonText });
      console.log("[CancellationReasonModal] Resultado da função addCancellationReason:", result.data);
      if (result.data?.success) {
        toast({ title: "Motivo Salvo", description: "Novo motivo adicionado à lista." });
        fetchReasons(currentTenant.id);
      } else {
        throw new Error(result.data?.message || 'Falha ao salvar motivo no backend.');
      }
    } catch (error) {
      console.error("[CancellationReasonModal] Erro ao salvar novo motivo:", error);
      toast({ title: "Erro", description: `Não foi possível salvar o novo motivo: ${error.message}`, variant: "destructive" });
    }
  };

  const handleConfirm = async () => {
    let finalReason = '';
    let reasonToAdd = null;

    if (selectedReason === 'other') {
      if (!otherReasonText.trim()) {
        toast({ title: "Erro", description: "Por favor, digite o motivo no campo 'Outro Motivo'.", variant: "destructive" });
        return;
      }
      finalReason = otherReasonText.trim();
      const exists = reasonsList.some(r => r.reasonText.toLowerCase() === finalReason.toLowerCase() && r.id !== 'other');
      if (!exists) {
          reasonToAdd = finalReason;
      }
    } else if (selectedReason) {
      const selected = reasonsList.find(r => r.id === selectedReason);
      finalReason = selected?.reasonText || '';
    } else {
      toast({ title: "Erro", description: "Por favor, selecione um motivo da lista.", variant: "destructive" });
      return;
    }

    if (!finalReason) {
        toast({ title: "Erro", description: "Motivo inválido selecionado.", variant: "destructive" });
        return;
    }

    if (!item || !item.id || !item.originalDocumentId) {
        toast({ title: "Erro Interno", description: "Item inválido ou sem referência ao documento original para cancelamento.", variant: "destructive" });
        console.error("[CancellationReasonModal] Item inválido:", item);
        onClose();
        return;
    }

    setIsSubmitting(true);
    try {
      if (reasonToAdd) {
        await saveOtherReason(reasonToAdd);
      }

      console.log(`[CancellationReasonModal] Chamando onConfirm com: item.id=${item.id}, originalDocumentId=${item.originalDocumentId}, reason="${finalReason}"`);
      await onConfirm(item.id, item.originalDocumentId, finalReason);
      
      setSelectedReason('');
      setOtherReasonText('');
      setShowOtherInput(false);
      onClose();

    } catch (error) {
      console.error("[CancellationReasonModal] Erro ao confirmar cancelamento:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedReason('');
    setOtherReasonText('');
    setShowOtherInput(false);
    onClose();
  };

  const handleReasonChange = (value) => {
    setSelectedReason(value);
    if (value === 'other') {
      setShowOtherInput(true);
    } else {
      setShowOtherInput(false);
      setOtherReasonText('');
    }
  };

  if (!item) return null; 

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancelar Item da Cobrança</DialogTitle>
          <DialogDescription>
            Insira um motivo para remover o item <strong>"{item.name}"</strong> da cobrança original. Esta ação não pode ser desfeita facilmente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reason-select" className="text-right col-span-1">
              Motivo*
            </Label>
            <Select
              value={selectedReason}
              onValueChange={handleReasonChange}
              disabled={isLoadingReasons || isSubmitting}
            >
              <SelectTrigger id="reason-select" className="col-span-3">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingReasons ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : (
                  reasonsList.map((reasonOpt) => (
                    <SelectItem key={reasonOpt.id || reasonOpt.reasonText} value={reasonOpt.id} disabled={!reasonOpt.id || reasonOpt.id === 'placeholder' || reasonOpt.id === 'error'}>
                      {reasonOpt.reasonText}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {showOtherInput && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="other-reason" className="text-right col-span-1">
                Outro Motivo*
              </Label>
              <Input
                id="other-reason"
                value={otherReasonText}
                onChange={(e) => setOtherReasonText(e.target.value)}
                className="col-span-3"
                placeholder="Digite o novo motivo..."
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Voltar
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirm} 
            disabled={isSubmitting || !selectedReason || selectedReason === 'placeholder' || selectedReason === 'error' || (selectedReason === 'other' && !otherReasonText.trim())}
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 