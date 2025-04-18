import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react"; // Icons for trigger

// TODO: Consider adding indeterminate state to "Todos" checkbox

const ProfessionalMultiSelectFilter = ({
  professionals = [], 
  selectedIds = [], 
  onChange, 
  className
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // --- Lógica de seleção/deseleção ---
  const handleSelectAll = (checked) => {
    onChange(checked ? professionals.map(p => p.id) : []);
  };

  const handleSelectProfessional = (professionalId, checked) => {
    if (checked) {
      onChange([...selectedIds, professionalId]);
    } else {
      onChange(selectedIds.filter(id => id !== professionalId));
    }
  };

  // --- Lógica de exibição no botão ---
  const triggerLabel = useMemo(() => {
    if (selectedIds.length === 0 || (selectedIds.length === professionals.length && professionals.length > 0)) {
      return "Todos Profissionais";
    }
    if (selectedIds.length === 1) {
      const selectedProf = professionals.find(p => p.id === selectedIds[0]);
      return selectedProf?.title || "1 selecionado";
    }
    return `${selectedIds.length} selecionados`;
  }, [selectedIds, professionals]);

  // --- Filtrar profissionais para a lista com base na busca ---
   const filteredProfessionals = useMemo(() => {
        if (!search) return professionals;
        return professionals.filter(prof => 
            prof.title.toLowerCase().includes(search.toLowerCase())
        );
    }, [search, professionals]);


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[250px] justify-between", className)} // Adjust width as needed
        >
          {triggerLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start"> 
        <Command>
          <CommandInput 
            placeholder="Buscar profissional..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
            <CommandGroup>
                {/* Item "Todos" */}
                <CommandItem
                    key="select-all"
                    // Prevent closing popover on select for checkboxes
                    onSelect={() => { 
                      handleSelectAll(!(selectedIds.length === professionals.length && professionals.length > 0));
                    }}
                    className="cursor-pointer"
                >
                    <Checkbox
                        id="select-all-prof"
                        checked={selectedIds.length === professionals.length && professionals.length > 0}
                        // Consider adding: indeterminate={selectedIds.length > 0 && selectedIds.length < professionals.length}
                        onCheckedChange={handleSelectAll}
                        className="mr-2"
                        aria-label="Selecionar todos"
                    />
                    <label htmlFor="select-all-prof" className="flex-1 cursor-pointer">Todos</label>
                </CommandItem>

                {/* Itens de Profissionais Filtrados */}
                {filteredProfessionals.map((prof) => (
                    <CommandItem
                        key={prof.id}
                        value={prof.title} // Value for Command filtering/selection
                        // Prevent closing popover on select for checkboxes
                        onSelect={() => {
                            handleSelectProfessional(prof.id, !selectedIds.includes(prof.id))
                        }}
                        className="cursor-pointer"
                    >
                        <Checkbox
                            id={`prof-${prof.id}`}
                            checked={selectedIds.includes(prof.id)}
                            onCheckedChange={(checked) => handleSelectProfessional(prof.id, !!checked)}
                             className="mr-2"
                             aria-label={`Selecionar ${prof.title}`}
                        />
                         <label htmlFor={`prof-${prof.id}`} className="flex-1 cursor-pointer">{prof.title}</label>
                    </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

ProfessionalMultiSelectFilter.propTypes = {
  professionals: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  })),
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default ProfessionalMultiSelectFilter; 