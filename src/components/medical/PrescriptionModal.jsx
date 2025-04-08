import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from 'lucide-react';
import { generateUniqueId } from '@/api/mockData'; // Para gerar IDs únicos para itens

const PrescriptionItem = ({ item, index, onChange, onRemove }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-end border-b pb-3 mb-3">
      <div className="col-span-1 md:col-span-1">
        <Label htmlFor={`medication-${index}`}>Medicação</Label>
        <Input 
          id={`medication-${index}`} 
          value={item.medication}
          onChange={(e) => onChange(index, 'medication', e.target.value)} 
          placeholder="Nome do medicamento"
        />
      </div>
      <div className="col-span-1 sm:col-span-1/2 md:col-span-auto">
        <Label htmlFor={`dosage-${index}`}>Dosagem</Label>
        <Input 
          id={`dosage-${index}`} 
          value={item.dosage}
          onChange={(e) => onChange(index, 'dosage', e.target.value)}
          placeholder="Ex: 5mg, 1 comp."
        />
      </div>
      <div className="col-span-1 sm:col-span-1/2 md:col-span-auto">
        <Label htmlFor={`duration-${index}`}>Duração/Frequência</Label>
        <Input 
          id={`duration-${index}`} 
          value={item.duration}
          onChange={(e) => onChange(index, 'duration', e.target.value)}
          placeholder="Ex: 7 dias, BID"
        />
      </div>
       <div className="col-span-1 md:col-span-1">
         <Label htmlFor={`notes-${index}`}>Observações</Label>
         <Input
           id={`notes-${index}`}
           value={item.notes}
           onChange={(e) => onChange(index, 'notes', e.target.value)}
           placeholder="Observações adicionais"
         />
      </div>
      <div className="flex items-center space-x-2 col-span-1 sm:col-span-1/2 md:col-span-auto justify-self-start md:justify-self-center">
         <Checkbox 
            id={`internal-${index}`}
            checked={item.usage === 'internal'}
            onCheckedChange={(checked) => onChange(index, 'usage', checked ? 'internal' : 'external')} 
          />
        <Label htmlFor={`internal-${index}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap">
          Uso Interno
        </Label>
      </div>
      <div className="col-span-1 sm:col-span-1/2 md:col-span-auto justify-self-end md:justify-self-center">
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

PrescriptionItem.propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default function PrescriptionModal({ isOpen, onClose, onSave, initialItems }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Reseta ou inicializa os itens quando o modal abre ou initialItems muda
    if (isOpen) {
      setItems(initialItems && initialItems.length > 0 
        ? initialItems.map(item => ({ ...item, id: item.id || generateUniqueId() })) // Garante ID
        : [{ id: generateUniqueId(), medication: '', dosage: '', duration: '', notes: '', usage: 'external' }]);
    }
  }, [isOpen, initialItems]);

  const handleAddItem = () => {
    setItems([...items, { id: generateUniqueId(), medication: '', dosage: '', duration: '', notes: '', usage: 'external' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return; // Não permite remover o último item
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleChangeItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSaveClick = () => {
    // Validação básica (ex: verificar se a medicação foi preenchida)
    const isValid = items.every(item => item.medication && item.medication.trim() !== '');
    if (!isValid) {
      // Poderia adicionar um toast de erro aqui
      alert("Por favor, preencha o nome da medicação para todos os itens.");
      return;
    }
    onSave({ items }); // Passa o array de itens
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[80%]">
        <DialogHeader>
          <DialogTitle>Prescrição Médica</DialogTitle>
          <DialogDescription>
            Adicione os medicamentos e detalhes da prescrição.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {items.map((item, index) => (
            <PrescriptionItem 
              key={item.id} // Usa o ID gerado como chave
              item={item} 
              index={index} 
              onChange={handleChangeItem} 
              onRemove={handleRemoveItem} 
            />
          ))}
          <Button variant="outline" onClick={handleAddItem} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Adicionar Item
          </Button>
        </div>

        <DialogFooter>
           <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
           </DialogClose>
          <Button type="button" onClick={handleSaveClick}>Salvar Prescrição</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

PrescriptionModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialItems: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    medication: PropTypes.string,
    dosage: PropTypes.string,
    duration: PropTypes.string,
    notes: PropTypes.string,
    usage: PropTypes.oneOf(['internal', 'external'])
  })),
}; 