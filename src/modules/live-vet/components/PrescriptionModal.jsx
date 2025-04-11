import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import PropTypes from 'prop-types'; // <<< IMPORTAR

// Hook para gerenciar itens dinâmicos (simplificado, sem react-hook-form por agora)
const usePrescriptionItems = (initialItems = [{ itemName: '', details: '', isControlled: false, usage: 'externo' }]) => {
  const [items, setItems] = useState(initialItems);

  const addItem = () => {
    setItems([...items, { itemName: '', details: '', isControlled: false, usage: 'externo' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    console.log(`[PrescriptionModal - usePrescriptionItems] updateItem(${index}, '${field}', '${value}')`); // Log para depuração
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const resetItems = () => {
    setItems([{ itemName: '', details: '', isControlled: false, usage: 'externo' }]);
  }

  return { items, addItem, removeItem, updateItem, resetItems };
};

export function PrescriptionModal({ isOpen, onClose, appointmentId, petId, onSaveSuccess }) {
  const { toast } = useToast();
  const [prescriptionType, setPrescriptionType] = useState('Comum');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const { items, addItem, removeItem, updateItem, resetItems } = usePrescriptionItems();
  const [isSaving, setIsSaving] = useState(false);
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);

  const handleSave = async () => {
    if (!appointmentId || !petId) {
      toast({ title: "Erro", description: "IDs de consulta ou pet ausentes.", variant: "destructive" });
      return;
    }
    if (items.length === 0 || items.every(item => !item.itemName.trim())) {
       toast({ title: "Erro", description: "Adicione pelo menos um item à prescrição.", variant: "destructive" });
       return;
    }

    setIsSaving(true);
    const prescriptionData = {
      appointmentId,
      petId,
      type: prescriptionType,
      items: items.filter(item => item.itemName.trim()),
      observations: generalInstructions.trim(),
      requiresFollowUp: requiresFollowUp,
      // vetInfo será adicionado pelo mock/backend
    };

    console.log("[PrescriptionModal] Dados para salvar (detalhado):", JSON.stringify(prescriptionData, null, 2));
    if (onSaveSuccess) {
        try {
            setIsSaving(true);
            await onSaveSuccess(prescriptionData); // Chama handleSavePrescription
            resetForm();
            onClose(); // Fecha o modal APÓS sucesso
        } catch (error) {
             // Erro já tratado em handleSavePrescription, mas podemos logar aqui também
             console.error("[PrescriptionModal] Erro reportado por onSaveSuccess:", error);
             // Toast de erro já deve ter sido mostrado pelo pai
        } finally {
            setIsSaving(false);
        }
    } else {
        console.error("[PrescriptionModal] Função onSaveSuccess não fornecida!");
        toast({ title: "Erro de Configuração", description: "Não foi possível comunicar o salvamento.", variant: "destructive" });
        setIsSaving(false);
    }
  };

  const resetForm = () => {
    setPrescriptionType('Comum');
    setGeneralInstructions('');
    setRequiresFollowUp(false);
    resetItems();
  }

  // Função para fechar e resetar o formulário
  const handleClose = () => {
      resetForm();
      onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Nova Prescrição</DialogTitle>
          <DialogDescription>
            Preencha os detalhes da prescrição. Clique em salvar quando terminar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Tipo de Prescrição */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prescription-type" className="text-right">
              Tipo
            </Label>
            <Select value={prescriptionType} onValueChange={setPrescriptionType}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Comum">Comum</SelectItem>
                <SelectItem value="Controle Especial">Controle Especial</SelectItem>
                <SelectItem value="Nutricional">Nutricional</SelectItem>
                <SelectItem value="Procedimento">Procedimento/Orientação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Itens Prescritos */}
          <div className="col-span-4">
            <Label className="text-sm font-medium">Itens Prescritos</Label>
            <div className="mt-2 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start border p-3 rounded relative">
                  {/* Col 1-5: Nome */}
                  <div className="col-span-5">
                    <Label htmlFor={`item-name-${index}`} className="text-xs">Medicamento/Produto/Instrução</Label>
                    <Input
                      id={`item-name-${index}`}
                      value={item.itemName}
                      onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                      placeholder="Ex: Amoxicilina 50mg"
                      className="mt-1"
                    />
                  </div>
                  {/* Col 6-9: Detalhes */}
                  <div className="col-span-4">
                    <Label htmlFor={`item-details-${index}`} className="text-xs">Detalhes/Posologia</Label>
                    <Textarea
                      id={`item-details-${index}`}
                      value={item.details}
                      onChange={(e) => updateItem(index, 'details', e.target.value)}
                      placeholder="Ex: 1 comp a cada 12h por 7 dias"
                      rows={2}
                      className="mt-1 text-xs"
                    />
                  </div>
                   {/* Col 10: Controlado */}
                  <div className="col-span-1 flex flex-col items-center pt-5">
                     <Checkbox
                       id={`item-controlled-${index}`}
                       checked={item.isControlled}
                       onCheckedChange={(checked) => updateItem(index, 'isControlled', checked)}
                       className="mt-1"
                     />
                     <Label htmlFor={`item-controlled-${index}`} className="text-xs text-center mt-1">Ctrl?</Label>
                  </div>
                  {/* <<< Col 11: Uso (Interno/Externo) >>> */}
                  <div className="col-span-2 flex flex-col pt-5">
                     <Label htmlFor={`item-usage-${index}`} className="text-xs mb-1 text-center">Uso</Label>
                     <Select
                         value={item.usage}
                         onValueChange={(value) => updateItem(index, 'usage', value)}
                         id={`item-usage-${index}`}
                     >
                         <SelectTrigger className="h-8 text-xs">
                             <SelectValue placeholder="Uso" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value="externo">Externo</SelectItem>
                             <SelectItem value="interno">Interno</SelectItem>
                         </SelectContent>
                     </Select>
                  </div>
                  {/* Col 12: Remover */}
                  {items.length > 1 && (
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => removeItem(index)}
                       className="absolute top-1 right-1 h-6 w-6 text-destructive hover:bg-destructive/10"
                       title="Remover item"
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}>
                <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Item
              </Button>
            </div>
          </div>

          {/* Observações (antes Instruções Gerais) */}
          <div className="col-span-4 mt-2">
             <Label htmlFor="observations">Observações</Label>
             <Textarea
                id="observations"
                value={generalInstructions}
                onChange={(e) => setGeneralInstructions(e.target.value)}
                placeholder="Observações adicionais sobre a prescrição..."
                className="mt-1"
             />
          </div>
          
          {/* Requer Retorno */}
          <div className="col-span-4 flex items-center space-x-2 mt-2">
            <Checkbox 
              id="requires-follow-up" 
              checked={requiresFollowUp}
              onCheckedChange={setRequiresFollowUp}
            />
            <Label htmlFor="requires-follow-up" className="cursor-pointer">
              Requer Retorno?
            </Label>
          </div>

        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
             {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Prescrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// <<< ADICIONAR VALIDAÇÃO DE PROPS >>>
PrescriptionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  appointmentId: PropTypes.string.isRequired,
  petId: PropTypes.string, // Pode ser null/undefined antes de carregar
  onSaveSuccess: PropTypes.func,
};