import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Import DialogClose for the cancel button
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { useToast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Trash2, Check, ChevronsUpDown } from 'lucide-react'; // Import icons
import { save as saveTemplate } from '@/api/mock/prescriptionTemplateService'; // Import the save function from the service
import { formatCurrency } from '@/utils/formatCurrency'; // May need this if adding value fields later
import { Product } from '@/api/entities'; // Import the Product entity (uses ProductMock)
import { cn } from "@/lib/utils"; // For Popover styling
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command" // Import Command components
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover" // Import Popover components

const defaultItem = { 
    id: null, // Store product ID when selected
    itemName: '', 
    details: '', 
    isControlled: false, 
    usage: 'externo', 
    valorAdministracao: null // Add field to track admin price
};
// Define default state specifically for the template details
const defaultTemplateDetails = { 
    name: '', 
    type: 'Comum', 
    observations: ''
};

// Internal hook similar to usePrescriptionItems
const useTemplateItems = (initialItems = [defaultItem]) => {
    const [items, setItems] = useState(initialItems);
  
    const addItem = () => {
      setItems([...items, { ...defaultItem }]);
    };
  
    const removeItem = (index) => {
      setItems(items.filter((_, i) => i !== index));
    };
  
    const updateItem = (index, field, value) => {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], [field]: value };
      setItems(newItems);
    };
  
    // Function to directly set items (needed for loading template data)
    const setItemsState = (newItems) => {
        // Ensure at least one item exists, even if empty
        setItems(newItems && newItems.length > 0 ? newItems : [defaultItem]);
    };

    return { items, addItem, removeItem, updateItem, setItemsState };
};

// --- Item Search ComboBox Component (Internal to this file for simplicity) ---
function ItemSearchComboBox({ value, onSelect, placeholder = "Buscar produto/serviço..." }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItemName, setSelectedItemName] = useState("");

  // Debounce search function
  const debounceSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Use Product.filter (which points to ProductMock.filter)
        const results = await Product.filter({ name: query }); 
        setSearchResults(results || []);
      } catch (error) {
        console.error("Error searching products:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300), // 300ms debounce delay
    []
  );

  useEffect(() => {
    // Find the name of the currently selected item ID for display
    if (value) {
        Product.get(value).then(product => {
            if (product) setSelectedItemName(product.name);
            else setSelectedItemName("");
        });
    } else {
        setSelectedItemName("");
    }
  }, [value]);

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setIsLoading(true); // Show loading immediately while debouncing
    debounceSearch(query);
  };

  const handleSelect = (product) => {
    onSelect(product); // Pass the whole product object back
    setSelectedItemName(product.name);
    setOpen(false);
    setSearchQuery(""); // Clear search
    setSearchResults([]); // Clear results
  };

  // Simple debounce implementation
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 text-xs font-normal" // Adjusted style
        >
          {selectedItemName || placeholder}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
        <Command shouldFilter={false}> {/* Disable default filtering */} 
          <CommandInput 
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={handleSearchChange} 
            className="h-8 text-xs"
          />
           <CommandList>
                <CommandEmpty>
                {isLoading ? "Buscando..." : (searchQuery.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum produto encontrado.")}
                </CommandEmpty>
                <CommandGroup>
                {searchResults.map((product) => (
                    <CommandItem
                    key={product.id}
                    value={product.id} // Use ID for CommandItem value
                    onSelect={() => handleSelect(product)} // Pass product on select
                    className="text-xs"
                    >
                    <Check
                        className={cn(
                        "mr-2 h-3 w-3",
                        value === product.id ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {product.name}
                    </CommandItem>
                ))}
                </CommandGroup>
            </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
ItemSearchComboBox.propTypes = {
    value: PropTypes.string, // Expecting product ID
    onSelect: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
};

// --- End ItemSearchComboBox ---

export function PrescriptionTemplateForm({ isOpen, onClose, template, onSaveSuccess }) {
    const { toast } = useToast();
    // Use the correctly structured default state
    const [templateDetails, setTemplateDetails] = useState(defaultTemplateDetails); 
    const { items, addItem, removeItem, updateItem, setItemsState } = useTemplateItems();
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = Boolean(template);

    // Corrected useEffect logic
    useEffect(() => {
        // Only set the initial state when the modal opens (isOpen becomes true)
        // or when the template being edited changes.
        if (isOpen) {
            if (isEditing) {
                // Populate form for editing mode
                setTemplateDetails({
                    id: template.id,
                    name: template.name || '',
                    type: template.type || 'Comum',
                    observations: template.observations || '',
                });
                setItemsState(template.items);
            } else {
                 // Reset form for creating mode (only when opening)
                setTemplateDetails(defaultTemplateDetails);
                setItemsState([defaultItem]);
            }
        }
        // No need for an else block here, state persists until next open
    }, [isOpen, template]); // Dependencies that trigger initial state setting
                                // isEditing is derived from template
                                // setItemsState is stable (should be useCallback in hook)

    const handleDetailChange = (e) => {
        const { name, value } = e.target;
        setTemplateDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (value) => {
        setTemplateDetails(prev => ({ ...prev, type: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Log the items state directly from the hook at the time handleSave is called
        console.log("[PrescriptionTemplateForm] Hook 'items' state at start of handleSave:", JSON.stringify(items));
        const formData = { ...templateDetails, items }; 
        console.log("[PrescriptionTemplateForm] Attempting to save:", formData);

        // --- Validation --- 
        if (!formData.name.trim()) {
            toast({ title: "Erro de Validação", description: "O nome do modelo é obrigatório.", variant: "destructive" });
            setIsSaving(false);
            return;
        }

        // --- Detailed Item Validation --- 
        console.log("[PrescriptionTemplateForm] Items before validation:", JSON.stringify(formData.items));
        const hasValidItem = formData.items && formData.items.length > 0 && formData.items.some((item, idx) => {
            const hasName = item.itemName?.trim();
            console.log(`[PrescriptionTemplateForm] Validating item ${idx}: itemName='${item.itemName}', hasName=${!!hasName}`);
            return hasName;
        });

        if (!hasValidItem) {
            console.log("[PrescriptionTemplateForm] Validation failed: No item has a valid itemName.");
            toast({ title: "Erro de Validação", description: "Adicione pelo menos um item ao modelo.", variant: "destructive" });
            setIsSaving(false);
            return;
        } else {
            console.log("[PrescriptionTemplateForm] Item name validation passed.");
        }
        // --- End Detailed Item Validation ---
        
        // Filter out potentially empty items added by user but left blank before saving
        const finalFormData = {
             ...formData,
             items: formData.items.filter(item => item.itemName?.trim())
        };
        
        // Ensure there are still items after filtering empty ones (edge case)
        if (finalFormData.items.length === 0) {
             toast({ title: "Erro de Validação", description: "O modelo precisa conter pelo menos um item válido.", variant: "destructive" });
             setIsSaving(false);
             return;
        }

        // --- End Validation --- 

        console.log("[PrescriptionTemplateForm] Validation passed. Preparing to call saveTemplate with:", finalFormData);
        try {
            const savedData = await saveTemplate(finalFormData);
            console.log("[PrescriptionTemplateForm] saveTemplate call finished. Response:", savedData);
            toast({ title: "Sucesso", description: `Modelo "${savedData.name}" ${formData.id ? 'atualizado' : 'criado'} com sucesso.` });
            onSaveSuccess();
        } catch (error) {
            console.error("[PrescriptionTemplateForm] Error saving:", error);
            toast({ title: "Erro ao Salvar", description: error.message || "Ocorreu um erro inesperado.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    // Handler for closing the dialog (resets form if not editing)
    const handleOpenChange = (open) => {
        if (!open) {
            onClose(); // Call the onClose passed from parent
        }
    };

    // --- Item Handling Updates ---
    const handleItemSelect = (index, product) => {
        if (!product) return;

        let adminPrice = null;
        // Ensure prices are treated as numbers
        const administrationPriceNum = parseFloat(product.administrationPrice);
        const priceNum = parseFloat(product.price);

        if (product.allowInternalUse) {
            // Use administrationPrice if available and > 0, otherwise use price
            adminPrice = administrationPriceNum > 0 ? administrationPriceNum : (priceNum > 0 ? priceNum : null);
        }
        
        // Log the type and value being passed to updateItem
        console.log(`[handleItemSelect] Preparing to update item ${index} - ID: ${product.id}, Name: ${product.name}, AdminPrice:`, adminPrice, `(Type: ${typeof adminPrice})`);

        // Use functional update form of setItems to ensure atomic update
        setItemsState(prevItems => {
            const newItems = [...prevItems];
            if (newItems[index]) {
                newItems[index] = {
                    ...newItems[index],
                    id: product.id,
                    itemName: product.name,
                    valorAdministracao: adminPrice
                };
            }
            return newItems;
        });

        // updateItem(index, 'id', product.id); // Store selected product ID - Removed
        // updateItem(index, 'itemName', product.name); // Removed
        // updateItem(index, 'valorAdministracao', adminPrice); // adminPrice is now guaranteed to be a number or null - Removed
        // Optional: maybe clear details or set default usage based on product?
        // updateItem(index, 'details', ''); 
        // updateItem(index, 'usage', product.allowInternalUse ? 'interno' : 'externo');
    };
    // --- End Item Handling Updates ---

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[800px]"> {/* Further increased width */}
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Editar Modelo' : 'Novo Modelo'} de Prescrição</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Modifique os detalhes do modelo.' : 'Preencha os detalhes para criar um novo modelo.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4"> {/* Increased height, added right padding */}
                    {/* Nome do Modelo */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Nome*</Label>
                        <Input
                            id="name"
                            name="name"
                            value={templateDetails.name}
                            onChange={handleDetailChange}
                            className="col-span-3"
                            placeholder="Ex: Modelo Dermatite Atópica"
                            required
                        />
                    </div>

                    {/* Tipo de Prescrição */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">Tipo</Label>
                        <Select value={templateDetails.type} onValueChange={handleSelectChange}>
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

                    {/* Items Section Updated */}
                    <div className="col-span-4 border-t pt-4 mt-2">
                        <h4 className="text-md font-semibold mb-3">Itens do Modelo</h4>
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-x-2 gap-y-1 items-start border p-3 rounded relative bg-muted/20">
                                    {/* Col 1-5: Use ComboBox for Item Name */}
                                    <div className="col-span-12 md:col-span-5">
                                        <Label htmlFor={`item-name-${index}`} className="text-xs font-medium">Medicamento/Produto/Instrução*</Label>
                                        <ItemSearchComboBox 
                                            value={item.id} // Pass product ID if available
                                            onSelect={(product) => handleItemSelect(index, product)} 
                                            placeholder="Buscar e selecionar item..."
                                        />
                                        {/* Optional: Keep a hidden input or display name for reference? */}
                                    </div>
                                    {/* Col 6-9: Detalhes */}
                                    <div className="col-span-12 md:col-span-4">
                                        <Label htmlFor={`item-details-${index}`} className="text-xs font-medium">Detalhes/Posologia</Label>
                                        <Textarea
                                            id={`item-details-${index}`}
                                            value={item.details}
                                            onChange={(e) => updateItem(index, 'details', e.target.value)} // Update details directly
                                            placeholder="Ex: 1 comp a cada 12h por 7 dias"
                                            rows={2}
                                            className="mt-1 text-xs"
                                        />
                                    </div>
                                    {/* Col 10: Controlado */}
                                    <div className="col-span-6 md:col-span-1 flex flex-col items-center justify-end pb-1">
                                        <Checkbox
                                            id={`item-controlled-${index}`}
                                            checked={item.isControlled}
                                            onCheckedChange={(checked) => updateItem(index, 'isControlled', checked)}
                                            className="mt-1"
                                        />
                                        <Label htmlFor={`item-controlled-${index}`} className="text-xs text-center mt-1 cursor-pointer">Controlado?</Label>
                                    </div>
                                    {/* Col 11-12: Uso */}
                                    <div className="col-span-6 md:col-span-2 flex flex-col justify-end pb-1">
                                        <Label htmlFor={`item-usage-${index}`} className="text-xs font-medium mb-1 text-center">Uso</Label>
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
                                        {/* Display Admin Value if applicable */}
                                        {item.usage === 'interno' && item.valorAdministracao > 0 && (
                                            <div className="text-xs text-center mt-1 text-blue-600 font-medium">
                                                Admin: {formatCurrency(item.valorAdministracao)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Absolute positioned Remove Button */} 
                                    {items.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeItem(index)}
                                            className="absolute top-1 right-1 h-6 w-6 text-destructive hover:bg-destructive/10"
                                            title="Remover este item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={addItem} className="mt-4">
                            <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Item ao Modelo
                        </Button>
                    </div>

                    {/* Observações */}
                    <div className="grid grid-cols-4 items-start gap-4 border-t pt-4 mt-4">
                        <Label htmlFor="observations" className="text-right pt-2">Observações Gerais</Label>
                        <Textarea
                            id="observations"
                            name="observations"
                            value={templateDetails.observations}
                            onChange={handleDetailChange}
                            className="col-span-3"
                            placeholder="Instruções gerais, retornos, etc."
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? 'Salvar Alterações' : 'Criar Modelo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

PrescriptionTemplateForm.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    template: PropTypes.object, // Optional: Template object for editing
    onSaveSuccess: PropTypes.func.isRequired,
}; 