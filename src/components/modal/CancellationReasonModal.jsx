import { useState } from 'react';
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

// Props esperadas:
// - isOpen: boolean
// - onClose: () => void
// - onConfirm: (originalItemId: string, originalDocumentId: string, reason: string) => Promise<void>
// - item: { cartItemId: string, id: string, name: string, originalDocumentId: string, ... } (Objeto do item do carrinho com id original)
export default function CancellationReasonModal({ isOpen, onClose, onConfirm, item }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um motivo para o cancelamento.",
        variant: "destructive",
      });
      return;
    }

    if (!item || !item.id || !item.originalDocumentId) {
        toast({ title: "Erro Interno", description: "Item inválido ou sem referência ao documento original para cancelamento.", variant: "destructive" });
        console.error("[CancellationReasonModal] Item inválido:", item);
        onClose(); // Fecha o modal em caso de erro grave
        return;
    }

    setIsSubmitting(true);
    try {
      // Chama a função onConfirm passada como prop (que chamará o backend)
      await onConfirm(item.id, item.originalDocumentId, reason); 
      // O toast de sucesso pode ser movido para quem chama o onConfirm (Cashier.jsx)
      // toast({ title: "Sucesso", description: `Item "${item.name}" marcado para cancelamento.` });
      setReason(''); // Limpa o campo
      onClose(); // Fecha o modal APÓS sucesso
    } catch (error) {
      console.error("[CancellationReasonModal] Erro ao confirmar cancelamento:", error);
      // O toast de erro já deve ser mostrado pela função que chamou onConfirm (ou pelo backend)
      // toast({
      //   title: "Erro",
      //   description: error.message || "Falha ao solicitar cancelamento.",
      //   variant: "destructive",
      // });
      // Não fechar o modal em caso de erro, permite tentar novamente.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return; // Previne fechar durante o envio
    setReason(''); // Limpa o campo ao fechar
    onClose();
  };

  // Só renderiza o conteúdo se o item existir, para evitar erros
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
            <Label htmlFor="reason" className="text-right col-span-1">
              Motivo*
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="col-span-3"
              placeholder="Ex: Cliente desistiu, Item incorreto"
              disabled={isSubmitting}
            />
          </div>
          {/* Poderíamos adicionar mais campos aqui se necessário, como senha de supervisor */}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Voltar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting || !reason.trim()}>
            {isSubmitting ? 'Processando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 