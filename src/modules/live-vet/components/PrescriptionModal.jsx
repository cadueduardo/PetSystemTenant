import { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Trash2, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import PropTypes from 'prop-types';
import { formatCurrency } from '@/utils/formatCurrency';
import { list as listTemplates } from '@/api/mock/prescriptionTemplateService';
import { Product } from '@/api/entities';
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// --- ItemSearchComboBox Component ---
// Add initialName prop
function ItemSearchComboBox({ value, onSelect, placeholder = "Buscar produto/serviço...", initialName = "" }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // Use initialName if provided and no value (ID) exists initially
  const [selectedItemName, setSelectedItemName] = useState(value ? "" : initialName);

  const debounceSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSearchResults([]); setIsLoading(false); return;
      }
      setIsLoading(true);
      try {
        const results = await Product.filter({ name: query }); 
        setSearchResults(results || []);
      } catch (error) {
        console.error("Error searching products:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    // If value (ID) exists, fetch the name
    if (value) {
        Product.get(value).then(product => {
            if (product) {
                 setSelectedItemName(product.name);
            } else {
                 // If ID is invalid or product not found, maybe fallback to initialName or clear?
                 setSelectedItemName(initialName || ""); 
            }
        });
    } else {
        // If no value (ID), rely on initialName passed via props
        setSelectedItemName(initialName || "");
    }
    // Depend on initialName as well, in case the item row itself changes
  }, [value, initialName]);

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    setIsLoading(true);
    debounceSearch(query);
  };

  const handleSelect = (product) => {
    onSelect(product);
    setSelectedItemName(product.name);
    setOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => { clearTimeout(timeout); func(...args); };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9 font-normal">
                 {/* Display selectedItemName which now considers initialName */}
                {selectedItemName || placeholder} 
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
            <Command shouldFilter={false}>
                <CommandInput placeholder={placeholder} value={searchQuery} onValueChange={handleSearchChange} />
                <CommandList>
                    <CommandEmpty>{isLoading ? "Buscando..." : (searchQuery.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum produto encontrado.")}</CommandEmpty>
                    <CommandGroup>
                        {searchResults.map((product) => (
                            <CommandItem key={product.id} value={product.id} onSelect={() => handleSelect(product)}>
                                <Check className={cn("mr-2 h-4 w-4", value === product.id ? "opacity-100" : "opacity-0")} />
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
    value: PropTypes.string,
    onSelect: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    initialName: PropTypes.string, // Add prop type for initialName
};
// --- End ItemSearchComboBox ---

// Default item structure now includes ID and valorAdministracao
const defaultItem = { id: null, itemName: '', details: '', isControlled: false, usage: 'externo', valorAdministracao: null };

// Hook usePrescriptionItems (already includes setItemsState)
const usePrescriptionItems = (initialItems = [defaultItem]) => {
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
  const setItemsState = (newItems) => {
    const validItems = Array.isArray(newItems) ? newItems : [];
    setItems(validItems.length > 0 ? validItems : [defaultItem]);
  };
  const resetItems = () => {
    setItems([defaultItem]);
  }
  return { items, addItem, removeItem, updateItem, resetItems, setItemsState }; 
};

export function PrescriptionModal({ isOpen, onClose, appointmentId, petId, onSaveSuccess }) {
  const { toast } = useToast();
  const [prescriptionType, setPrescriptionType] = useState('Comum');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const { items, addItem, removeItem, updateItem, resetItems, setItemsState } = usePrescriptionItems();
  const [isSaving, setIsSaving] = useState(false);
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);

  // State for template loading
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(''); // Store selected template ID

  // Load templates when the modal opens
  useEffect(() => {
    const loadTemplates = async () => {
      if (isOpen) {
        setIsLoadingTemplates(true);
        setSelectedTemplateId(''); // Reset selection when modal opens
        try {
          const fetchedTemplates = await listTemplates();
          setTemplates(fetchedTemplates);
        } catch (error) {
          console.error("[PrescriptionModal] Error loading templates:", error);
          toast({ title: "Erro", description: "Falha ao carregar modelos de prescrição.", variant: "destructive" });
          setTemplates([]); // Clear templates on error
        } finally {
          setIsLoadingTemplates(false);
        }
      }
    };
    loadTemplates();
  }, [isOpen, toast]);

  // Handle template selection - UPDATED LOGIC
  const handleTemplateSelect = async (templateId) => {
    setSelectedTemplateId(templateId);
    const selectedTemplate = templates.find(t => t.id === templateId);

    if (selectedTemplate) {
      console.log("[PrescriptionModal] Applying template:", selectedTemplate);
      setPrescriptionType(selectedTemplate.type || 'Comum');
      setGeneralInstructions(selectedTemplate.observations || '');

      // Process template items to fetch admin prices if needed
      setIsLoadingTemplates(true); // Show loading indicator while processing
      try {
        const processedItems = await Promise.all((selectedTemplate.items || []).map(async (templateItem) => {
            // Use the value from the template as the initial/fallback value
            let finalValorAdmin = templateItem.valorAdministracao !== undefined ? templateItem.valorAdministracao : null;
            const productIdToFetch = templateItem.id || templateItem.productId; // Check both possible fields for compatibility

            // If a product ID exists in the template item, try fetching the current product data
            if (productIdToFetch) { 
                try {
                    console.log(`[PrescriptionModal] Template item '${templateItem.itemName}' has linked product ID: ${productIdToFetch}. Fetching product...`);
                    const product = await Product.get(productIdToFetch);
                    if (product) {
                         console.log(`[PrescriptionModal] Product ${productIdToFetch} fetched:`, product);
                        if (product.allowInternalUse) {
                            // Calculate admin price based on CURRENT product data, potentially overwriting template value
                            const currentAdminPriceNum = parseFloat(product.administrationPrice);
                            const currentPriceNum = parseFloat(product.price);
                            const calculatedAdminPrice = currentAdminPriceNum > 0 
                                                ? currentAdminPriceNum 
                                                : (currentPriceNum > 0 ? currentPriceNum : null);
                            console.log(`[PrescriptionModal] Calculated admin price from fetched product: ${calculatedAdminPrice}`);
                            finalValorAdmin = calculatedAdminPrice; // Overwrite with fetched value if applicable
                        } else {
                             console.log(`[PrescriptionModal] Fetched product ${productIdToFetch} does not allow internal use. Keeping template admin price: ${finalValorAdmin}`);
                        }
                    } else {
                         console.warn(`[PrescriptionModal] Product ${productIdToFetch} not found. Keeping template admin price: ${finalValorAdmin}`);
                    }
                } catch (productError) {
                    console.error(`[PrescriptionModal] Error fetching product ${productIdToFetch} for template item:`, productError);
                    // Keep template admin price if product fetch fails
                     console.log(`[PrescriptionModal] Fetch failed. Keeping template admin price: ${finalValorAdmin}`);
                }
            } else {
                console.log(`[PrescriptionModal] Template item '${templateItem.itemName}' has no linked product ID. Using template admin price: ${finalValorAdmin}`);
            }
            
            // Return the item structure expected by usePrescriptionItems state
            return {
                 id: productIdToFetch, // Use the ID found (either .id or .productId)
                 itemName: templateItem.itemName || '', 
                 details: templateItem.details || '', 
                 isControlled: templateItem.isControlled || false, 
                 usage: templateItem.usage || 'externo', 
                 valorAdministracao: typeof finalValorAdmin === 'string' ? parseFloat(finalValorAdmin) : finalValorAdmin // Ensure it's a number or null
            };
        }));
        
        // Use setItemsState with the processed items
        setItemsState(processedItems);
        toast({ title: "Modelo Carregado", description: `Itens do modelo "${selectedTemplate.name}" foram aplicados.` });

      } catch (processingError) {
          console.error("[PrescriptionModal] Error processing template items:", processingError);
          toast({ title: "Erro ao Carregar Modelo", description: "Não foi possível processar os itens do modelo.", variant: "destructive" });
          // Maybe reset items to default empty state on error?
          resetItems(); 
      } finally {
          setIsLoadingTemplates(false);
      }

    } else {
       console.warn(`[PrescriptionModal] Template with ID ${templateId} not found.`);
       // Reset form if template selection is cleared or invalid
       resetItems();
       setPrescriptionType('Comum');
       setGeneralInstructions('');
    }
  };

  // --- Item Handling Update for Product Search ---
  const handleItemSelect = (index, product) => {
    if (!product) return;
    let adminPrice = null;
    if (product.allowInternalUse) {
      adminPrice = product.administrationPrice > 0 ? product.administrationPrice : (product.price > 0 ? product.price : null);
    }
    updateItem(index, 'id', product.id);
    updateItem(index, 'itemName', product.name);
    updateItem(index, 'valorAdministracao', adminPrice);
  };
  // --- End Item Handling Update ---

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
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nova Prescrição</DialogTitle>
          <DialogDescription>
            Preencha os detalhes da prescrição. Clique em salvar quando terminar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
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

          {/* Added Template Loader Section */}
          <div className="grid grid-cols-4 items-center gap-4 pt-2 pb-4 border-b">
            <Label htmlFor="template-loader" className="text-right text-sm font-medium">
                Carregar Modelo
            </Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={handleTemplateSelect}
              disabled={isLoadingTemplates} // Disable during template item processing too
            >
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={isLoadingTemplates ? "Carregando/Processando..." : "Selecione um modelo para carregar..."} />
                </SelectTrigger>
                <SelectContent>
                    {isLoadingTemplates ? (
                        <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : templates.length > 0 ? (
                        templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                                {template.name} ({template.items?.length || 0} itens)
                            </SelectItem>
                        ))
                    ) : (
                        <div className="px-4 py-2 text-sm text-muted-foreground">Nenhum modelo salvo encontrado.</div>
                    )}
                </SelectContent>
            </Select>
          </div>

          {/* Itens Prescritos - Updated */}
          <div className="col-span-4">
            <Label className="text-sm font-medium">Itens Prescritos</Label>
            <div className="mt-2 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start border p-3 rounded relative">
                  {/* Col 1-5: Use ComboBox - Pass initialName */} 
                  <div className="col-span-12 sm:col-span-5">
                    <Label htmlFor={`item-name-${index}`} className="text-xs">Medicamento/Produto/Instrução*</Label>
                     <ItemSearchComboBox 
                        value={item.id} 
                        initialName={item.itemName} // <<< Pass itemName here
                        onSelect={(product) => handleItemSelect(index, product)} 
                        placeholder="Buscar item..."
                    />
                  </div>
                  {/* Col 6-9: Detalhes */}
                  <div className="col-span-12 sm:col-span-4">
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
                  <div className="col-span-4 sm:col-span-1 flex flex-col items-center pt-5">
                     <Checkbox
                       id={`item-controlled-${index}`}
                       checked={item.isControlled}
                       onCheckedChange={(checked) => updateItem(index, 'isControlled', checked)}
                       className="mt-1"
                     />
                     <Label htmlFor={`item-controlled-${index}`} className="text-xs text-center mt-1">Ctrl?</Label>
                  </div>
                  {/* Col 11-12: Uso */}
                  <div className="col-span-8 sm:col-span-2 flex flex-col pt-5">
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
                     {/* Display Admin Value */}
                     {item.usage === 'interno' && item.valorAdministracao > 0 && (
                         <div className="text-xs text-center mt-1 text-blue-600 font-medium">
                            Admin: {formatCurrency(item.valorAdministracao)}
                         </div>
                     )}
                  </div>
                  {/* Col 13: Remover */}
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