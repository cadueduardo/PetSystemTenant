import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, X, ChevronsUpDown } from "lucide-react";

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

const OTHER_SPECIALTY_DISPLAY_VALUE = "Outros (Especificar)"; // Label que o usuário vê
// Mantenha um valor interno distinto se precisar diferenciar o label da lógica
// const OTHER_SPECIALTY_INTERNAL_VALUE = "--OTHER--"; 

function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  onOtherToggle, // Nova prop
  className, 
  placeholder = "Selecione...",
  disabled = false 
}) { 
  const [open, setOpen] = React.useState(false);

  // Handler para quando um item é selecionado/desselecionado na lista
  const handleSelect = (optionValue) => { 
    // Verifica se a opção clicada corresponde ao LABEL de "Outros"
    if (optionValue === OTHER_SPECIALTY_DISPLAY_VALUE) {
        // Notifica o componente pai sobre o toggle da opção "Outros"
        if (onOtherToggle) {
            // Precisamos saber o estado *atual* da seleção de "Outros" (que não está em `selected`)
            // Uma forma é verificar se o input está visível (gerenciado pelo pai), mas isso acopla demais.
            // Melhor: o pai controla a visibilidade e passa um estado `isOtherSelected`?
            // OU: Assumimos que se clicou, quer inverter. O Pai decide o que fazer.
            // Vamos pela simplicidade: apenas notifica que foi clicado.
            // O estado `isSelected` será determinado pelo pai baseado na visibilidade do input.
             onOtherToggle(); // Pai decide como interpretar o toggle
             setOpen(false); // <--- ADICIONADO: Fecha o popover ao clicar em Outros
        }
    } else {
        // Lógica normal para outras opções
        let newSelected;
        if (selected.includes(optionValue)) {
             newSelected = selected.filter((value) => value !== optionValue);
        } else {
             newSelected = [...selected, optionValue];
        }
        onChange(newSelected);
    }
  };
  
  // Handler para remover badge
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
            {/* Mapeia APENAS os valores REAIS em `selected` para os badges */}
            {selected.map((value) => (
              <Badge
                variant="secondary"
                key={value}
                className="mr-1 mb-1"
              >
                {value} {/* Mostra o valor real */}
                <X 
                    className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleUnselect(value); // Chama a função de remover badge
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
              {/* Mapeia as `options` (que incluem "Outros (Especificar)") */}
              {options.map((option) => (
                <CommandItem
                  key={option} 
                  value={option} // O valor do CommandItem é o que o usuário vê/busca
                  onSelect={() => handleSelect(option)} // Usa o valor exibido
                >
                  <Checkbox
                    className={cn("mr-2")}
                    // O checked para "Outros" depende do estado do PAI (se o input está visível)
                    // O checked para opções normais depende se está em `selected`
                    checked={option === OTHER_SPECIALTY_DISPLAY_VALUE ? false /* Controlado pelo Pai */ : selected.includes(option)}
                    // Para simplificar, vamos deixar o Checkbox de "Outros" sempre desmarcado aqui
                    // A seleção visual será indicada pelo input aparecendo no pai.
                  />
                  {option} {/* Exibe o nome da opção ou "Outros (Especificar)" */}
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