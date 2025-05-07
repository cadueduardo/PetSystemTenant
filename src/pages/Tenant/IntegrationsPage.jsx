import React, { useState, useEffect } from 'react';
import { useTenant } from '@/components/tenant/TenantContext';
import { useNavigate } from 'react-router-dom'; // Para navegação

// Importações de UI (ShadCN/UI)
import { Loader2, MessageSquareText, FileText } from 'lucide-react'; // Ícones
import { useToast } from "@/components/ui/use-toast";

// Firebase - Removido por enquanto, pode ser readicionado se necessário para buscar status GERAIS
// import { httpsCallable } from "firebase/functions"; 
// import { doc, onSnapshot } from "firebase/firestore";
// import { db, functions } from '@/lib/firebaseConfig';

// Novo componente de Card
import IntegrationCard from '@/components/integrations/IntegrationCard';

// REMOVER toda a função WahaConfigForm() e suas constantes relacionadas como FIRESTORE_WAHA_DOC
// A lógica de WahaConfigForm será movida para sua própria página/modal de configuração.
// ... WahaConfigForm code removed ...

function IntegrationsPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Estados simplificados para status das integrações (exemplos)
  const [wahaStatusText, setWahaStatusText] = useState('Verificando...');
  const [isWahaConfigured, setIsWahaConfigured] = useState(false);
  
  const [nfeStatusText, setNfeStatusText] = useState('Não Configurado');
  const [isNfeConfigured, setIsNfeConfigured] = useState(false);
  
  const [pageLoading, setPageLoading] = useState(true);

  // Simular carregamento de dados e status das integrações
  useEffect(() => {
    // TODO: No futuro, buscar o status real das integrações para o tenant.
    // Esta lógica deve ser mais robusta, possivelmente chamando uma função de backend
    // ou lendo de um local centralizado no Firestore que resume os status das integrações.
    setPageLoading(true);
    const timer = setTimeout(() => {
      // Exemplo de como você poderia verificar se está configurado (MUITO SIMPLIFICADO)
      // Para WAHA, você precisaria de uma lógica similar à que existia no WahaConfigForm, 
      // mas provavelmente em uma store global ou em sua página de configuração.
      // Por agora, vamos simular:
      if (currentTenant?.someWahaFlag) { // Substitua someWahaFlag por uma verificação real
        setWahaStatusText('Ativo');
        setIsWahaConfigured(true);
      } else {
        setWahaStatusText('Não Configurado');
        setIsWahaConfigured(false);
      }

      // Para NFe, também simulado:
      if (currentTenant?.someNFeFlag) { // Substitua someNFeFlag por uma verificação real
        setNfeStatusText('Ativo');
        setIsNfeConfigured(true);
      } else {
        setNfeStatusText('Não Configurado');
        setIsNfeConfigured(false);
      }
      setPageLoading(false);
    }, 1200); // Aumentado o tempo para simular melhor
    return () => clearTimeout(timer);
  }, [currentTenant]);

  const handleWahaNavigation = () => {
    // Futuramente, navegar para a página de configuração/gerenciamento do WAHA
    // Ex: navigate('/tenant/integrations/waha-setup');
    toast({ title: 'Integração WhatsApp', description: 'Navegar para a página de configuração do WAHA.' });
  };

  const handleNFeNavigation = () => {
    navigate('/tenant/integrations/nfe-setup');
  };

  if (pageLoading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-10"> {/* Aumentado margin-bottom */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Central de Integrações</h1>
        <p className="text-lg text-muted-foreground mt-2"> {/* Aumentado tamanho e margin-top */}
          Conecte e gerencie serviços externos para automatizar e expandir as funcionalidades da sua loja.
        </p>
      </header>

      <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"> {/* Aumentado gap */}
        
        <IntegrationCard
          icon={<MessageSquareText className="w-full h-full text-green-600" />}
          title="Mensagens via WhatsApp"
          description="Conecte sua conta do WhatsApp para enviar notificações automáticas e interagir com seus clientes."
          statusText={wahaStatusText}
          statusVariant={isWahaConfigured ? "success" : "outline"}
          actionButtonText={isWahaConfigured ? "Gerenciar" : "Configurar"}
          onActionClick={handleWahaNavigation}
        />

        <IntegrationCard
          icon={<FileText className="w-full h-full text-blue-600" />}
          title="Emissão de Nota Fiscal"
          description="Configure a emissão de NF-e e NFS-e para suas vendas e serviços de forma integrada."
          statusText={nfeStatusText}
          statusVariant={isNfeConfigured ? "success" : "outline"}
          actionButtonText={isNfeConfigured ? "Gerenciar" : "Configurar"}
          onActionClick={handleNFeNavigation}
        />

        <IntegrationCard
          icon={<Loader2 className="w-full h-full text-gray-500" />} 
          title="Gateway de Pagamento SuperPay"
          description="Integre com nosso gateway parceiro para processar transações online com segurança."
          actionButtonText="Configurar" 
          onActionClick={() => toast({ title: 'Em Breve!', description: 'Esta integração estará disponível em breve.' })}
          comingSoon={true}
        />
        
        {/* Adicione mais cards de placeholder se desejar */}
        <IntegrationCard
          icon={<Loader2 className="w-full h-full text-gray-500" />} 
          title="ERP MasterControl"
          description="Sincronize seus dados com o sistema de gestão MasterControl."
          actionButtonText="Configurar" 
          onActionClick={() => toast({ title: 'Em Breve!', description: 'Esta integração estará disponível em breve.' })}
          comingSoon={true}
        />

      </div>
    </div>
  );
}

export default IntegrationsPage;