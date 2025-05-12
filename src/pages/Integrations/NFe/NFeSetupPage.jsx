import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/components/tenant/TenantContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

// Mock data for regimes tributários - idealmente viria de uma constante ou API
const regimesTributarios = [
  { value: "1", label: "Simples Nacional" },
  { value: "2", label: "Simples Nacional – excesso de sublimite de receita bruta" },
  { value: "3", label: "Regime Normal – Lucro Presumido" },
  { value: "4", label: "Regime Normal – Lucro Real" },
  { value: "mei", label: "MEI - Microempreendedor Individual" },
];

function NFeSetupPage() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  // Estados para os campos do formulário
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [regimeTributario, setRegimeTributario] = useState('');
  const [incentivadorCultural, setIncentivadorCultural] = useState(false);
  const [emailComercial, setEmailComercial] = useState('');
  const [telefoneComercial, setTelefoneComercial] = useState('');
  const [cnaePrincipal, setCnaePrincipal] = useState('');

  // Endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('');
  const [codigoMunicipioIBGE, setCodigoMunicipioIBGE] = useState('');

  // Certificado Digital
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  
  const [habilitaNFe, setHabilitaNFe] = useState(true);
  const [habilitaNFSe, setHabilitaNFSe] = useState(true);
  const [environment, setEnvironment] = useState('homologation');

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      setRazaoSocial(currentTenant.legal_name || currentTenant.company_name || '');
      setNomeFantasia(currentTenant.company_name || '');
      setCnpj(currentTenant.document || '');
      setEmailComercial(currentTenant.email || '');
      setTelefoneComercial(currentTenant.phone || '');
      
      if (currentTenant.address) {
        setCep(currentTenant.address.cep || '');
        setLogradouro(currentTenant.address.street || '');
        setNumero(currentTenant.address.number || '');
        setComplemento(currentTenant.address.complement || '');
        setBairro(currentTenant.address.neighborhood || '');
        setMunicipio(currentTenant.address.city || '');
        setUf(currentTenant.address.state || '');
        setCodigoMunicipioIBGE(currentTenant.address.ibge_code || '');
      }
      setInscricaoEstadual(currentTenant.inscricao_estadual || '');
      setInscricaoMunicipal(currentTenant.inscricao_municipal || '');
      setRegimeTributario(currentTenant.regime_tributario || '');
      setIncentivadorCultural(currentTenant.incentivador_cultural || false);
      setCnaePrincipal(currentTenant.cnae_principal || '');
    }
  }, [currentTenant]);

  const handleCertificadoChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setCertificateFile(event.target.files[0]);
    }
  };

  // Função para ler arquivo como Base64
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result?.toString().split(',')[1]; // Remove o prefixo data:application/octet-stream;base64,
        if (base64String) {
          resolve(base64String);
        } else {
          reject(new Error("Falha ao ler o arquivo como Base64."));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    if (!currentTenant?.id) {
      toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (!certificateFile) {
      toast({ title: "Erro", description: "O arquivo do certificado é obrigatório.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (certificatePassword === "") {
      toast({ title: "Erro", description: "A senha do certificado é obrigatória.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    let base64Cert = null;
    try {
      base64Cert = await readFileAsBase64(certificateFile);
      if (!base64Cert) {
        throw new Error("Não foi possível ler o arquivo do certificado.");
      }
    } catch (error) {
      toast({ title: "Erro de Certificado", description: error.message || "Falha ao converter certificado.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const dataToSend = {
        tenantId: currentTenant.id,
        environment: environment,
        certificatePassword: certificatePassword,
        certificateBase64: base64Cert,
    };

    console.log("[NFeSetupPage] Final data being sent to setupNFeIntegration:", {
        tenantId: dataToSend.tenantId,
        environment: dataToSend.environment,
        isCertificatePasswordString: typeof dataToSend.certificatePassword === 'string',
        certificateBase64Length: dataToSend.certificateBase64?.length
    });

    try {
      const app = getApp();
      const firebaseFunctionsInstance = getFunctions(app, "southamerica-east1");
      const setupNFeIntegrationCallable = httpsCallable(firebaseFunctionsInstance, 'setupNFeIntegration');
      
      const result = await setupNFeIntegrationCallable(dataToSend);

      if (result.data.success) {
        toast({
          title: "Sucesso!",
          description: result.data.message || "Integração NF-e configurada com sucesso.",
          variant: "success"
        });
      } else {
        throw new Error(result.data.message || "Falha ao configurar a integração NF-e.");
      }
    } catch (error) {
      console.error("Erro ao chamar a função setupNFeIntegration ou tratar sua resposta:", error);
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (error.message && error.code) {
         errorMessage = error.message;
      }

      toast({
        title: "Erro ao Configurar NF-e",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <Button variant="outline" onClick={() => navigate('/tenant/integracoes')} className="mb-4">
          &larr; Voltar para Central de Integrações
        </Button>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
          Configuração da Emissão de Nota Fiscal (NF-e/NFS-e)
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Verifique os dados da sua empresa, faça o upload do seu certificado digital A1 e defina as preferências de emissão.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa (Conforme Configurações Gerais)</CardTitle>
              <CardDescription>
                Estas informações são carregadas das configurações da sua empresa. 
                Para editá-las, acesse a seção {/**/"Configurações"/**/} no menu principal.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label htmlFor="razaoSocial" className="text-sm font-medium text-gray-500">Razão Social</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{razaoSocial || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="nomeFantasia" className="text-sm font-medium text-gray-500">Nome Fantasia</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{nomeFantasia || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cnpj" className="text-sm font-medium text-gray-500">CNPJ</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{cnpj || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="inscricaoEstadual" className="text-sm font-medium text-gray-500">Inscrição Estadual (IE)</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{inscricaoEstadual || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cnaePrincipalDisplay" className="text-sm font-medium text-gray-500">CNAE Principal</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{cnaePrincipal || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="inscricaoMunicipal" className="text-sm font-medium text-gray-500">Inscrição Municipal (IM)</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{inscricaoMunicipal || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="regimeTributarioDisplay" className="text-sm font-medium text-gray-500">Regime Tributário</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{regimesTributarios.find(r => r.value === regimeTributario)?.label || regimeTributario || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="incentivadorCulturalDisplay" className="text-sm font-medium text-gray-500">Incentivador Cultural</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{incentivadorCultural ? "Sim" : "Não"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="emailComercialDisplay" className="text-sm font-medium text-gray-500">Email Comercial</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{emailComercial || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefoneComercialDisplay" className="text-sm font-medium text-gray-500">Telefone Comercial</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{telefoneComercial || "-"}</p>
              </div>
              <div className="md:col-span-2 mt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/tenant/configuracoes')} className="w-full md:w-auto">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Verificar/Editar Dados Completos da Empresa em Configurações
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endereço Fiscal (Conforme Configurações Gerais)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label htmlFor="cepDisplay" className="text-sm font-medium text-gray-500">CEP</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{cep || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="logradouroDisplay" className="text-sm font-medium text-gray-500">Logradouro</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{logradouro || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="numeroDisplay" className="text-sm font-medium text-gray-500">Número</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{numero || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="complementoDisplay" className="text-sm font-medium text-gray-500">Complemento</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{complemento || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="bairroDisplay" className="text-sm font-medium text-gray-500">Bairro</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{bairro || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="municipioDisplay" className="text-sm font-medium text-gray-500">Município</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{municipio || "-"}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ufDisplay" className="text-sm font-medium text-gray-500">UF</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{uf || "-"}</p>
              </div>
               <div className="space-y-1">
                <Label htmlFor="codigoMunicipioIBGEDisplay" className="text-sm font-medium text-gray-500">Código do Município (IBGE)</Label>
                <p className="text-gray-800 p-2 border rounded-md bg-gray-50 min-h-[38px]">{codigoMunicipioIBGE || "-"}</p>
              </div>
            </CardContent>
          </Card>
          
          <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <AlertDescription>
              Certifique-se de que todos os dados da empresa e endereço fiscal estejam corretos e completos na seção {/**/"Configurações"/**/} antes de prosseguir.
              A Focus NFe pode exigir o Código IBGE do Município para emissão de NFS-e.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Certificado Digital A1</CardTitle>
              <CardDescription>Faça o upload do seu arquivo .pfx e informe a senha. Este arquivo não fica armazenado no seu navegador.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="certificateFile">Arquivo do Certificado (.pfx) *</Label>
                <Input id="certificateFile" type="file" accept=".pfx" onChange={handleCertificadoChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificatePassword">Senha do Certificado *</Label>
                <Input id="certificatePassword" type="password" value={certificatePassword} onChange={(e) => setCertificatePassword(e.target.value)} required />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Emissão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="environment">Ambiente de Emissão (Focus NFe)</Label>
                    <Select value={environment} onValueChange={setEnvironment}>
                        <SelectTrigger id="environment">
                            <SelectValue placeholder="Selecione o ambiente" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="homologation">Homologação (Testes)</SelectItem>
                            <SelectItem value="production">Produção (Real)</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Selecione {/**/"Homologação"/**/} para realizar testes de emissão sem validade fiscal.</p>
                </div>
                <div className="flex items-center space-x-2 pt-4">
                    <input type="checkbox" id="habilitaNFe" checked={habilitaNFe} onChange={(e) => setHabilitaNFe(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600" />
                    <Label htmlFor="habilitaNFe" className="text-sm font-medium">Habilitar emissão de NF-e (Produtos)</Label>
                </div>
                <div className="flex items-center space-x-2">
                     <input type="checkbox" id="habilitaNFSe" checked={habilitaNFSe} onChange={(e) => setHabilitaNFSe(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-600" />
                    <Label htmlFor="habilitaNFSe" className="text-sm font-medium">Habilitar emissão de NFS-e (Serviços)</Label>
                </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e Configurar Emissão de NF
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default NFeSetupPage; 