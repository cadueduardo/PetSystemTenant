import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ban, CheckCheck, Trash2, MessageSquareText, X } from 'lucide-react';

// Componente do Menu de Contexto
export function AppointmentContextMenu({
  x,
  y,
  eventId,
  eventStatus,
  onClose,
  onSendWahaConfirmation,
  onUpdateStatus,
  onDelete,
  open,
  onOpenChange,
}) {
  const menuRef = useRef(null);

  // Lógica para fechar ao clicar fora (mantida)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && event.button !== 2) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!eventId) return null;

  // --- LÓGICA PARA MOSTRAR ITENS (Restaurada) ---
  const showConfirmWaha = eventStatus === 'scheduled';
  const showCancel = eventStatus === 'scheduled' || eventStatus === 'pending_confirmation' || eventStatus === 'confirmed';
  const showConfirmManual = eventStatus === 'scheduled' || eventStatus === 'pending_confirmation';
  const showDelete = true; 

  // --- DEBUG: Renderizar um div simples em vez do DropdownMenu --- (REMOVIDO)

  // --- Retornar APENAS DropdownMenuContent dentro do div posicionado --- 
  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="absolute z-50"
    >
      <DropdownMenu 
        open={open}
        onOpenChange={onOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }} />
        </DropdownMenuTrigger>

        <DropdownMenuContent 
          ref={menuRef}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-56" 
        >
          <button 
            onClick={onClose}
            className="absolute top-1 right-1 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
          
          <span className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 block">
            Ações Rápidas
          </span>
          <DropdownMenuSeparator />

          {/* Ação: Confirmação WhatsApp */}
          {showConfirmWaha && (
            <DropdownMenuItem onClick={() => onSendWahaConfirmation(eventId)}>
              <MessageSquareText className="mr-2 h-4 w-4 text-blue-500" />
              <span>Confirmação WhatsApp</span>
            </DropdownMenuItem>
          )}
          
          {/* Ação: Confirmar Manualmente */}
          {showConfirmManual && (
             <DropdownMenuItem onClick={() => onUpdateStatus(eventId, 'confirmed')}>
               <CheckCheck className="mr-2 h-4 w-4 text-green-500" />
               <span>Confirmar Agendamento</span>
             </DropdownMenuItem>
          )}

          {/* Ação: Cancelar Agendamento */}
          {showCancel && (
            <DropdownMenuItem onClick={() => onUpdateStatus(eventId, 'canceled')}>
              <Ban className="mr-2 h-4 w-4 text-red-500" />
              <span>Cancelar Agendamento</span>
            </DropdownMenuItem>
          )}

          {/* Separador antes de ações destrutivas */}
          {(showConfirmWaha || showCancel || showConfirmManual) && showDelete && <DropdownMenuSeparator />}

          {/* Ação: Remover Agendamento */}
          {showDelete && (
            <DropdownMenuItem 
              className="text-red-600 focus:bg-red-50 focus:text-red-700" 
              onClick={() => onDelete(eventId)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Remover</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Validação de PropTypes (mantida)
AppointmentContextMenu.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  eventId: PropTypes.string,
  eventStatus: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSendWahaConfirmation: PropTypes.func.isRequired,
  onUpdateStatus: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
}; 