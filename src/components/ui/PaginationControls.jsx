// import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PropTypes from 'prop-types';

const PaginationControls = ({
  currentPage = 1, // Ou talvez baseado nos docs
  pageSize = 10,
  availablePageSizes = [10, 25, 50, 100],
  totalItems = 0, // Opcional
  onPageChange, // Função chamada com 'prev' ou 'next'
  onPageSizeChange, // Função chamada com novo tamanho
  hasNextPage = false, // Pode ser usado em vez de totalPages
  hasPreviousPage = false, // Pode ser usado em vez de totalPages
  itemCountOnPage = 0, // Número de itens na página atual
  isLoading = false // Para desabilitar controles durante carregamento
}) => {
  
  const handlePrevious = () => {
    if (hasPreviousPage && onPageChange) {
      onPageChange('prev');
    }
  };

  const handleNext = () => {
    if (hasNextPage && onPageChange) {
      onPageChange('next');
    }
  };

  const handleSizeChange = (value) => {
    if (onPageSizeChange) {
      onPageSizeChange(Number(value));
    }
  };

  // Calcular itens exibidos (ex: 1-10 de 55)
  const firstItemNum = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItemNum = totalItems > 0 ? Math.min(currentPage * pageSize, totalItems) : itemCountOnPage; // Ajuste se totalItems não for conhecido

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t">
      {/* Info de Itens (Opcional) */}
      <div className="text-sm text-muted-foreground">
        {totalItems > 0 
          ? `${firstItemNum}-${lastItemNum} de ${totalItems}` 
          : itemCountOnPage > 0 ? `${itemCountOnPage} itens nesta página` : 'Nenhum item'}
      </div>

      <div className="flex items-center space-x-6 lg:space-x-8">
        {/* Seletor de Tamanho da Página */}
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Itens por página</p>
          <Select
            value={`${pageSize}`}
            onValueChange={handleSizeChange}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {availablePageSizes.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Controles Anterior/Próximo */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handlePrevious}
            disabled={!hasPreviousPage || isLoading}
            aria-label="Ir para página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={handleNext}
            disabled={!hasNextPage || isLoading}
            aria-label="Ir para próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Add PropTypes validation
PaginationControls.propTypes = {
  currentPage: PropTypes.number,
  pageSize: PropTypes.number,
  availablePageSizes: PropTypes.arrayOf(PropTypes.number),
  totalItems: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  hasNextPage: PropTypes.bool,
  hasPreviousPage: PropTypes.bool,
  itemCountOnPage: PropTypes.number,
  isLoading: PropTypes.bool
};

export default PaginationControls; 