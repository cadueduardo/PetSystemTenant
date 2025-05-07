import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function NFeSetupPage() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/tenant/integrations');
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurar Emissão de Nota Fiscal</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Configure o certificado digital e os dados da API para começar a emitir notas fiscais.
          </p>
        </div>
        <Button variant="outline" onClick={handleGoBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Integrações
        </Button>
      </header>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Certificado Digital A1</CardTitle>
            <CardDescription>
              Faça o upload do seu arquivo de certificado digital (.pfx) e informe a senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Adicionar formulário de upload do certificado e senha */}
            <p className="text-sm text-muted-foreground">[Formulário para Upload do Certificado e Senha Aqui]</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuração da API (Focus NFe)</CardTitle>
            <CardDescription>
              Informe os dados necessários para conectar com a API da Focus NFe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Adicionar formulário para token da API e ambiente */}
            <p className="text-sm text-muted-foreground">[Formulário para Token da API e Ambiente (Homologação/Produção) Aqui]</p>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-4">
          <Button size="lg">
            {/* TODO: Implementar lógica de salvar */}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NFeSetupPage; 