import * as React from "react";
import { cn } from "@/lib/utils";
import { X, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox"; // Usaremos Checkbox dentro do Command
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

// Definindo o tipo para as opções
// type Option = {
//   value: string;
//   label: string;
// };
// Ajustado para aceitar apenas strings (nomes das especialidades)

// Props para o MultiSelect (comentários em vez de interface)
// options: string[]; // Array de strings (nomes das especialidades)
// selected: string[]; // Array das strings selecionadas
// onChange: (selected: string[]) => void; // Função para atualizar a seleção
// onOtherToggle?: (isSelected: boolean) => void; // NOVA PROP
// className?: string;
// placeholder?: string;
// disabled?: boolean;

// Mantenha um valor interno distinto se precisar diferenciar o label da lógica
// const OTHER_SPECIALTY_INTERNAL_VALUE = "--OTHER--"; 

function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  onOtherToggle, 
  otherOptionValue, // <-- Garantir que esta prop seja recebida
  className, 
  placeholder = "Selecione...",
  disabled = false 
}) { 
  const [open, setOpen] = React.useState(false);

  const handleSelect = (optionValue) => { 
    // Verifica se o VALOR clicado corresponde ao VALOR de "Outros"
    if (optionValue === otherOptionValue) { // <-- CORRIGIDO: Comparar com otherOptionValue
        if (onOtherToggle) {
             onOtherToggle(); 
             setOpen(false); 
        }
    } else {
        // Lógica normal para outras opções (já usa optionValue corretamente)
        let newSelected;
        if (selected.includes(optionValue)) {
             newSelected = selected.filter((value) => value !== optionValue);
        } else {
             newSelected = [...selected, optionValue];
        }
        onChange(newSelected);
    }
  };
  
  // Ajustar a renderização do Badge para encontrar o label correspondente
  const getLabelForValue = (value) => {
      const option = options.find(opt => opt.value === value);
      return option ? option.label : value; // Retorna label se encontrado, senão o próprio valor
  };

  // Handler para remover badge (não precisa mudar, já usa o valor)
  const handleUnselect = (valueToRemove) => {
      onChange(selected.filter((value) => value !== valueToRemove));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          style={{ minHeight: '2.5rem' }} 
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length === 0 && placeholder}
            {selected.map((value) => (
              <Badge
                variant="secondary"
                key={value} // Key continua sendo o valor único
                className="mr-1 mb-1"
              >
                {getLabelForValue(value)} {/* <-- CORRIGIDO: Mostrar o label do badge */}
                <X 
                    className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleUnselect(value); 
                    }}
                />
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
        <Command>
          <CommandInput placeholder="Buscar opção..." />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              {/* Mapeia as `options` (que agora são {label, value}) */}
              {options.map((option) => (
                <CommandItem
                  key={option.value} // <-- CORRIGIDO: Usar option.value como key
                  value={option.label} // O valor para BUSCA é o label (o que o usuário digita)
                  onSelect={() => handleSelect(option.value)} // Passa o VALOR real para o handler
                  data-value={option.value} // Adiciona data-value para segurança
                >
                  <Checkbox
                    className={cn("mr-2")}
                    // O checked para "Outros" depende do estado do PAI (se o input está visível)
                    // O checked para opções normais depende se o VALOR está em `selected`
                    checked={option.value === otherOptionValue 
                             ? false // Deixar falso por enquanto, pai controla visibilidade do input
                             : selected.includes(option.value) // <-- CORRIGIDO: Verificar includes com option.value
                            }
                     // Não precisamos de onCheckedChange aqui, pois onSelect do CommandItem cuida disso
                  />
                  {option.label} {/* <-- CORRIGIDO: Exibe o label */}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { MultiSelect }; 