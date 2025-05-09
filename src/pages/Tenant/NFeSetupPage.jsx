import { useState } from "react";
import { useTenant } from "@/components/tenant/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Loader2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function NFeSetupPage() {
  const { currentTenant, isLoading: isLoadingTenant, error: errorTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [environment, setEnvironment] = useState("homologation");
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getStatusDescription = () => {
    return "Configure a emissão de Notas Fiscais para sua empresa.";
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.name.toLowerCase().endsWith('.pfx')) {
        setCertificateFile(file);
      } else {
        toast({
          title: "Formato Inválido",
          description: "Por favor, selecione um arquivo .pfx.",
          variant: "destructive",
        });
        event.target.value = null;
        setCertificateFile(null);
      }
    }
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    if (!certificateFile || !certificatePassword) {
      toast({
        title: "Campos Obrigatórios",
        description: "Por favor, forneça o arquivo do certificado (.pfx) e a senha.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    let certificateBase64 = null;
    try {
      certificateBase64 = await readFileAsBase64(certificateFile);
    } catch (error) {
      console.error("Erro ao ler o arquivo do certificado:", error);
      toast({
        title: "Erro no Arquivo",
        description: "Não foi possível ler o arquivo do certificado.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const dataToSend = {
      tenantId: currentTenant?.id,
      environment: environment,
      certificatePassword: certificatePassword,
      certificateBase64: certificateBase64,
    };

    if (!dataToSend.tenantId) {
         toast({
            title: "Erro Interno",
            description: "ID do Tenant não encontrado. Recarregue a página.",
            variant: "destructive",
         });
         setIsLoading(false);
         return;
    }

    console.log("Enviando dados para setupNFeIntegration:", {
      ...dataToSend,
      certificateBase64: certificateBase64 ? "[Presente]" : "[Ausente]"
    });

    try {
      const functions = getFunctions();
      const setupNFeIntegration = httpsCallable(functions, 'setupNFeIntegration');
      
      const result = await setupNFeIntegration(dataToSend);

      console.log("Resultado da função setupNFeIntegration:", result.data);

      toast({
        title: "Configuração Enviada",
        description: result.data?.message || "Sua configuração de NF-e foi enviada com sucesso.",
        variant: "success",
      });

    } catch (error) {
      console.error("Erro ao chamar a função setupNFeIntegration:", error);
      toast({
        title: "Erro na Configuração",
        description: error.message || "Ocorreu um erro ao tentar configurar a integração NF-e.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingTenant) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> Carregando...</div>;
  }

  if (errorTenant) {
    return <div className="text-red-600">Erro ao carregar dados do tenant: {errorTenant}</div>;
  }

  if (!currentTenant) {
    return <div className="text-red-600">Tenant não encontrado. Verifique o contexto.</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Button variant="ghost" onClick={() => navigate('/tenant/integracoes')} className="mb-4">
        &larr; Voltar para Central de Integrações
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Nota Fiscal Eletrônica (Focus NFe)</CardTitle>
          <CardDescription>{getStatusDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="bg-muted/40">
              <CardHeader>
                <CardTitle className="text-lg">Dados da Empresa (Somente Leitura)</CardTitle>
                <CardDescription>
                  Estes dados são baseados nas configurações gerais da sua empresa.
                  Para alterá-los, vá para <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/tenant/configuracoes')}>Configurações da Empresa</Button>.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Razão Social:</span> {currentTenant.legal_name || '-'}</div>
                <div><span className="font-semibold">Nome Fantasia:</span> {currentTenant.company_name || '-'}</div>
                <div><span className="font-semibold">CNPJ:</span> {currentTenant.document || '-'}</div>
                <div><span className="font-semibold">Inscrição Estadual:</span> {currentTenant.inscricao_estadual || '-'}</div>
                <div><span className="font-semibold">Inscrição Municipal:</span> {currentTenant.inscricao_municipal || '-'}</div>
                <div><span className="font-semibold">Regime Tributário:</span> {currentTenant.regime_tributario || '-'}</div>
                <div><span className="font-semibold">Email Fiscal:</span> {currentTenant.email || '-'}</div>
                <div className="md:col-span-2"><span className="font-semibold">Endereço Fiscal:</span> {`${currentTenant.address?.street || ''}, ${currentTenant.address?.number || ''} ${currentTenant.address?.complement || ''} - ${currentTenant.address?.neighborhood || ''}, ${currentTenant.address?.city || ''}/${currentTenant.address?.state || ''} - CEP: ${currentTenant.address?.cep || ''}`}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Certificado Digital A1</CardTitle>
                <CardDescription>Faça o upload do seu certificado digital (.pfx) e informe a senha.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="certificate-file">Arquivo do Certificado (.pfx)</Label>
                  <div className="flex items-center space-x-3">
                    <Input
                      id="certificate-file"
                      type="file"
                      accept=".pfx"
                      onChange={handleFileChange}
                      required
                      className="flex-grow"
                    />
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {certificateFile && <p className="text-xs text-muted-foreground mt-1">Arquivo selecionado: {certificateFile.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certificate-password">Senha do Certificado</Label>
                  <Input
                    id="certificate-password"
                    type="password"
                    value={certificatePassword}
                    onChange={(e) => setCertificatePassword(e.target.value)}
                    required
                    placeholder="Digite a senha do seu certificado"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preferências de Emissão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="environment-select">Ambiente de Emissão</Label>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger id="environment-select" className="w-full md:w-[250px]">
                      <SelectValue placeholder="Selecione o ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologation">Homologação (Testes)</SelectItem>
                      <SelectItem value="production">Produção (Real)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione &quot;Homologação&quot; para realizar testes sem valor fiscal. Mude para &quot;Produção&quot; para emitir notas reais.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading || isLoadingTenant}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Salvando..." : "Salvar Configuração NF-e"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 