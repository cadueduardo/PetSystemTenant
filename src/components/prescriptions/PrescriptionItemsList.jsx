import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { prescriptionItemService } from '@/api/firebase/prescriptionItemService';
// Importar form de item (a ser criado)
// import { PrescriptionItemForm } from './PrescriptionItemForm';

export function PrescriptionItemsList({ typeId }) {
  const [items, setItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [errorItems, setErrorItems] = useState(null);

  // TODO: Adicionar estados para modal de form de Item
  // const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  // const [editingItem, setEditingItem] = useState(null);

  const loadItems = useCallback(async () => {
    if (!typeId) {
        setItems([]);
        setIsLoadingItems(false);
        return;
    }
    setIsLoadingItems(true);
    setErrorItems(null);
    try {
      // Filtra por prescriptionTypeId ao buscar
      const fetchedItems = await prescriptionItemService.list({ prescriptionTypeId: typeId });
      setItems(fetchedItems);
    } catch (err) {
      console.error(`Erro ao carregar itens para o tipo ${typeId}:`, err);
      setErrorItems("Falha ao carregar os itens de prescrição.");
      // TODO: Usar toast
    } finally {
      setIsLoadingItems(false);
    }
  }, [typeId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]); // Depende de loadItems, que depende de typeId

  const handleAddItem = () => {
    console.log("Adicionar novo item para tipo:", typeId);
    // setEditingItem(null); // Limpa item em edição
    // setIsItemModalOpen(true);
     alert('Funcionalidade Adicionar Item ainda não implementada.');
  };

  const handleEditItem = (item, event) => {
    event.stopPropagation();
    console.log("Editar item:", item);
    // setEditingItem(item);
    // setIsItemModalOpen(true);
     alert('Funcionalidade Editar Item ainda não implementada.');
  };

  const handleDeleteItem = async (itemId, event) => {
    event.stopPropagation(); 
    console.log("Deletar item:", itemId);
    if (window.confirm("Tem certeza que deseja deletar este item de prescrição?")) {
        try {
            await prescriptionItemService.delete(itemId);
            // TODO: Usar toast
            alert("Item deletado com sucesso!");
            loadItems(); // Recarrega a lista de itens
        } catch (error) {
            console.error("Erro ao deletar item:", error);
            alert(`Erro ao deletar item: ${error.message}`);
        }
    }
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Itens Disponíveis</h3>
            <Button variant="outline" size="sm" onClick={handleAddItem} disabled={!typeId}> 
                {/* Só habilita adicionar se um tipo PAI do tenant estiver selecionado */} 
                {/* TODO: Refinar essa lógica se quisermos permitir adicionar a tipos compartilhados (mas salvando no tenant) */}
                <PlusCircle className="h-4 w-4 mr-2" />
                Adicionar Item
            </Button>
        </div>

        {isLoadingItems && <Loader2 className="h-6 w-6 animate-spin mx-auto my-4" />}
        {errorItems && <p className="text-red-500 text-center my-4">{errorItems}</p>}
        {!isLoadingItems && !errorItems && (
            <ul className="space-y-2">
            {items.map((item) => (
                <li 
                key={item.id} 
                className="flex items-center justify-between p-3 rounded-md border bg-card text-card-foreground"
                >
                 <div className="flex-1 mr-2">
                    <p className="font-medium truncate">{item.nome}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.detalhes || 'Sem detalhes'}</p>
                    {/* Opcional: Mostrar outros campos como dose, frequencia, valor */}
                    {item.valorAdministracao > 0 && (
                         <p className="text-sm text-blue-600">Valor Adm: R$ {item.valorAdministracao.toFixed(2)}</p>
                    )}
                 </div>
                
                {/* Só permite editar/deletar itens que pertencem ao tenant */}
                {item.tenant_id && (
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleEditItem(item, e)} title="Editar Item">
                        <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(e) => handleDeleteItem(item.id, e)} title="Deletar Item">
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                 {!item.tenant_id && (
                    <span className="text-xs text-muted-foreground mr-2">(Padrão)</span>
                )}
                </li>
            ))}
            {items.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum item encontrado para este tipo.</p>}
            </ul>
        )}

        {/* TODO: Adicionar Modal para Form de Item */}
        {/* {isItemModalOpen && ( <PrescriptionItemForm item={editingItem} typeId={typeId} onClose={() => setIsItemModalOpen(false)} onSave={loadItems} /> )} */}
    </div>
  );
}

// Add PropTypes validation
PrescriptionItemsList.propTypes = {
  typeId: PropTypes.string, // Can be null or string
}; 