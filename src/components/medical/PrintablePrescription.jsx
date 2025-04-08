import React from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Componente interno para garantir que a ref seja passada corretamente para um componente de classe ou função
// eslint-disable-next-line react/display-name
const PrintablePrescriptionContent = React.forwardRef(({ tenant, pet, customer, items }, ref) => {
  const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });

  const externalItems = items.filter(item => item.usage === 'external');
  const internalItems = items.filter(item => item.usage === 'internal');

  return (
    <div ref={ref} className="printable-prescription p-8 font-sans text-sm bg-white text-black">
      {/* Cabeçalho */}
      <header className="text-center mb-8 border-b pb-4">
        <h1 className="text-xl font-bold mb-1">{tenant?.name || 'Nome da Clínica'}</h1>
        <p className="text-xs">{tenant?.address?.street || 'Endereço não disponível'}</p>
        <p className="text-xs">{tenant?.phone || 'Telefone não disponível'}</p>
        {/* Adicionar mais infos do tenant se necessário: CNPJ, etc. */}
      </header>

      {/* Informações do Paciente */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2 border-b">Receituário Médico Veterinário</h2>
        <div className="grid grid-cols-2 gap-x-4 text-xs">
          <div><strong>Tutor:</strong> {customer?.full_name || 'Não informado'}</div>
          <div><strong>Paciente:</strong> {pet?.name || 'Não informado'}</div>
          <div><strong>Espécie/Raça:</strong> {pet?.species || '-'} / {pet?.breed || '-'}</div>
          <div><strong>Sexo:</strong> {pet?.gender || '-'}</div>
          {/* Adicionar mais infos se relevante: Idade, Peso? */}
          <div><strong>Data:</strong> {currentDate}</div>
        </div>
      </section>

      {/* Itens da Prescrição - Uso Externo */}
      {externalItems.length > 0 && (
          <section className="mb-6">
            <h3 className="text-md font-semibold mb-2">Uso Externo</h3>
            <ol className="list-decimal pl-5 space-y-2">
              {externalItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.medication}</strong> ({item.dosage} - {item.duration})
                  {item.notes && <span className="block text-xs text-gray-700 ml-2">Obs: {item.notes}</span>}
                </li>
              ))}
            </ol>
          </section>
      )}

      {/* Itens da Prescrição - Uso Interno */}
      {internalItems.length > 0 && (
          <section className="mb-6">
            <h3 className="text-md font-semibold mb-2">Uso Interno (Administração na Clínica)</h3>
             <ol className="list-decimal pl-5 space-y-2">
              {internalItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.medication}</strong> ({item.dosage} - {item.duration})
                   {item.notes && <span className="block text-xs text-gray-700 ml-2">Obs: {item.notes}</span>}
                </li>
              ))}
            </ol>
          </section>
      )}

      {/* Rodapé */}
      <footer className="mt-12 pt-8 border-t">
        <div className="text-center">
            <div className="w-64 h-10 border-b border-black mx-auto mb-1"></div>
            <p className="text-xs font-semibold">Assinatura e Carimbo do Médico Veterinário</p>
            <p className="text-xs mt-1">CRMV: [Número CRMV]</p> {/* Idealmente viria do usuário/tenant */} 
        </div>
      </footer>
    </div>
  );
});

PrintablePrescriptionContent.propTypes = {
  tenant: PropTypes.object,
  pet: PropTypes.object,
  customer: PropTypes.object,
  items: PropTypes.array.isRequired,
};

export default PrintablePrescriptionContent; 