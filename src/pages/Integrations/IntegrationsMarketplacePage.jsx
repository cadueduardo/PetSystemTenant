import { useState, useEffect } from 'react';
import { useTenant } from '@/components/tenant/TenantContext';
import { useNavigate } from 'react-router-dom';

import { Loader2, MessageSquareText, FileText } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

import IntegrationCard from '@/components/integrations/IntegrationCard';

function IntegrationsMarketplacePage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [wahaStatusText, setWahaStatusText] = useState('Verificando...');
  const [isWahaConfigured, setIsWahaConfigured] = useState(false);
  
  const [nfeStatusText, setNfeStatusText] = useState('Não Configurado');
  const [isNfeConfigured, setIsNfeConfigured] = useState(false);
  
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    setPageLoading(true);
    const timer = setTimeout(() => {
      if (currentTenant?.someWahaFlag) {
        setWahaStatusText('Ativo');
        setIsWahaConfigured(true);
      } else {
        setWahaStatusText('Não Configurado');
        setIsWahaConfigured(false);
      }

      if (currentTenant?.someNFeFlag) {
        setNfeStatusText('Ativo');
        setIsNfeConfigured(true);
      } else {
        setNfeStatusText('Não Configurado');
        setIsNfeConfigured(false);
      }
      setPageLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [currentTenant]);

  const handleWahaNavigation = () => {
    navigate('/tenant/integracoes/waha/setup');
  };

  const handleNFeNavigation = () => {
    navigate('/tenant/integracoes/nfe/setup');
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
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Central de Integrações</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Conecte e gerencie serviços externos para automatizar e expandir as funcionalidades da sua loja.
        </p>
      </header>

      <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        
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

export default IntegrationsMarketplacePage; 