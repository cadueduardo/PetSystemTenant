import { useState, useEffect, useCallback } from 'react';
// import { Card, CardContent, Typography, Button, CircularProgress, Box, Chip, Alert } from '@mui/material'; // Remover importações MUI não usadas
import { useTenant } from '@/components/tenant/TenantContext';
// import { toast } from 'react-toastify'; // Remover toast de react-toastify
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, onSnapshot } from "firebase/firestore"; // Adicionar imports Firestore
import { Button } from '@/components/ui/button'; // Usar Button de shadcn
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Usar Card de shadcn
import { Loader2 } from 'lucide-react'; // Manter Loader2 se for usado
import { useToast } from "@/components/ui/use-toast"; // Usar useToast de shadcn
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from "@/components/ui/alert" // Renomear para evitar conflito

const functions = getFunctions();
const db = getFirestore(); // Inicializar Firestore

// --- Funções Callable (Remover não usadas) ---
// const getWahaSessionStatusCallable = httpsCallable(functions, 'getWahaSessionStatus'); 
// const getWahaQrCodeCallable = httpsCallable(functions, 'getWahaQrCode'); 
const startWahaSessionCallable = httpsCallable(functions, 'startWahaSession');
// TODO: Adicionar callable para stopWahaSession

// --- Constante para nome do documento Firestore --- 
const FIRESTORE_WAHA_DOC = 'wahaIntegration';

function WahaConfigForm() {
    const { currentTenant } = useTenant();
    const { toast } = useToast(); // Obter toast do hook shadcn
    const [sessionStatus, setSessionStatus] = useState('Desconhecido');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [qrCodeValue, setQrCodeValue] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // --- NOVO: Efeito Listener do Firestore --- 
    useEffect(() => {
        // Se não houver ID do tenant, não faz nada e limpa o estado
        if (!currentTenant?.id) {
            setSessionStatus('Desconhecido');
            setQrCodeValue(null);
            setError(null);
            setLoadingStatus(false);
            console.log('[Firestore Listener] No Tenant ID, clearing state.');
            return;
        }

        console.log(`[Firestore Listener] Setting up listener for tenant: ${currentTenant.id}`);
        setLoadingStatus(true); // Mostra loading enquanto busca o primeiro snapshot
        setError(null); // Limpa erros ao iniciar listener

        const docPath = `tenants/${currentTenant.id}/integrations/${FIRESTORE_WAHA_DOC}`;
        const docRef = doc(db, docPath);

        // Configura o listener onSnapshot
        const unsubscribe = onSnapshot(docRef, 
            (snapshot) => {
                console.log('[Firestore Listener] Snapshot received.');
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    console.log('[Firestore Listener] Data:', data);
                    setSessionStatus(data.status || 'Desconhecido');
                    setQrCodeValue(data.qrCodeDataUri || null);
                    // Não setar erro aqui, deixa o webhook/outras funções tratarem
                    // setError(null); 
                } else {
                    console.log('[Firestore Listener] Document does not exist. Setting state to Desconectado.');
                    setSessionStatus('Desconectado'); // Assume desconectado se não houver dados
                    setQrCodeValue(null);
                }
                setLoadingStatus(false); // Esconde loading após receber dados (ou ausência deles)
            },
            (err) => {
                console.error('[Firestore Listener] Error listening to document:', err);
                setError('Erro ao receber atualizações em tempo real. Tente recarregar a página.');
                setSessionStatus('Erro');
                setQrCodeValue(null);
                setLoadingStatus(false);
            }
        );

        // Função de cleanup: Para de ouvir quando o componente desmontar ou tenantId mudar
        return () => {
            console.log(`[Firestore Listener] Cleaning up listener for tenant: ${currentTenant.id}`);
            unsubscribe();
        };

    }, [currentTenant?.id]); // Dependência: reativa se o tenant mudar

    // --- Função para Gerenciar Conexão (Super Simplificada) ---
    const handleManageConnection = useCallback(async () => {
        setError(null); 
        // Não precisa limpar QR code aqui, o listener vai atualizar
        
        if (sessionStatus === 'QRCode' || sessionStatus === 'Conectado') {
             // Se estiver com QR ou Conectado, a ação é Desconectar (ou reiniciar?)
             // TODO: Implementar Desconexão/Logout via API WAHA
             console.log('TODO: Implementar lógica de desconexão/logout.');
             toast({ title: "Ação Pendente", description: "Função de desconectar ainda não implementada." });
             return; 
        }

        if (sessionStatus === 'Desconectado' || sessionStatus === 'Erro' || sessionStatus === 'Desconhecido' || sessionStatus === 'Iniciando') {
             // A única ação aqui é TENTAR iniciar a sessão
            // O listener do Firestore cuidará de mostrar o QR ou o status Conectado.
            console.log('[handleManageConnection] Attempting to start session...');
            setActionLoading(true); 
            try {
                // Apenas chama a função para iniciar
                const result = await startWahaSessionCallable();
                
                // Verifica se o resultado indica que já estava iniciado (código nosso)
                if (result?.data?.code === 'already-started') {
                     toast({ title: "Sessão Ativa", description: "A sessão já está em processo de inicialização ou ativa." });
                     // O listener deve pegar o status correto (QRCode ou Conectado) em breve
                 } else {
                     toast({ title: "Iniciando", description: "Solicitação enviada. Aguardando QR Code ou conexão..." });
                     // Define status localmente para 'Iniciando' para feedback imediato?
                     setSessionStatus('Iniciando'); 
                 }
                 // Não precisa fazer mais nada aqui, o listener e o webhook cuidam do resto

            } catch (startError) {
                 console.error('[handleManageConnection] Error starting session:', startError);
                 let errorMessage = 'Erro ao tentar iniciar a conexão.';
                 // Tenta extrair mensagem de HttpsError
                 errorMessage = startError?.message || errorMessage;
                 setError(errorMessage);
                 setSessionStatus('Erro'); // Define como erro se start falhar
                 toast({ title: "Erro ao Iniciar", description: errorMessage, variant: "destructive" });
            } finally {
                 setActionLoading(false);
            }
        } 
        // Remover else if 'Iniciando' - a lógica acima já cobre

    }, [sessionStatus, toast]); // Remover dependências não usadas

    // Adaptação para Status 
    const getStatusClasses = (status) => {
        switch (status) {
            case 'Conectado': return 'text-green-600 font-semibold';
            case 'QRCode': return 'text-yellow-600 font-semibold';
            case 'Iniciando': return 'text-blue-600 font-semibold';
            case 'Desconectado':
            case 'Erro':
            case 'Desconhecido':
            default: return 'text-red-600 font-semibold';
        }
    };

    // Texto do ÚNICO botão principal
    const getButtonText = (status) => {
         switch (status) {
             case 'Conectado': return 'Desconectar WhatsApp'; // Implementar Stop
             case 'QRCode': return 'Cancelar / Desconectar'; // Ou talvez apenas 'Desconectar'?
             case 'Iniciando': return 'Iniciando Conexão...';
             case 'Desconectado':
             case 'Erro':
             case 'Desconhecido':
             default: return 'Conectar WhatsApp / Obter QR Code';
         }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Conexão WhatsApp (WAHA)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Loading inicial da UI (antes do primeiro snapshot) */}
                {loadingStatus ? (
                   <div className="flex items-center gap-2">
                       <Loader2 className="h-5 w-5 animate-spin" />
                       <span>Verificando status...</span>
                   </div>
                ) : (
                    <div className="space-y-4">
                         <div className="flex items-center gap-2">
                            <span>Status:</span>
                             {/* Loader apenas se a AÇÃO do botão estiver rodando */} 
                             {actionLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                            {/* Não precisa mais do qrCodeLoading aqui */}
                            <span className={getStatusClasses(sessionStatus)}>{sessionStatus}</span>
                        </div>

                        {/* Exibir erro geral */} 
                        {error && (
                            <ShadcnAlert variant="destructive">
                              <AlertTitle>Erro</AlertTitle>
                              <AlertDescription>{error}</AlertDescription>
                            </ShadcnAlert>
                        )}

                        {/* Área do QR Code */} 
                        {sessionStatus === 'QRCode' && (
                            <div className="mt-2 p-4 border rounded-md text-center space-y-2">
                                <p className="text-sm font-medium">
                                    Escaneie o código abaixo com o seu WhatsApp para conectar:
                                    {/* Remover aviso de atualização automática */}
                                </p>
                                {/* Simplificado: Mostra QR se tiver, senão mostra aviso */} 
                                {qrCodeValue ? (
                                    <img 
                                        src={qrCodeValue} 
                                        alt="QR Code WhatsApp" 
                                        className="mx-auto w-48 h-48 md:w-60 md:h-60" 
                                    />
                                ) : (
                                     <ShadcnAlert variant="warning">
                                       <AlertTitle>Aguardando QR Code</AlertTitle>
                                       <AlertDescription>
                                           O QR code será exibido aqui assim que estiver disponível.
                                           <Loader2 className="inline-block h-4 w-4 animate-spin ml-2" />
                                       </AlertDescription>
                                     </ShadcnAlert>
                                )}
                            </div>
                        )}

                        {/* Botão de Ação Principal */} 
                        <Button
                            onClick={handleManageConnection}
                            // Desabilitar apenas durante a ação de iniciar/parar ou carregamento inicial
                            disabled={loadingStatus || actionLoading}
                        >
                             {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                            {getButtonText(sessionStatus)}
                        </Button>

                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Manter a estrutura da página IntegrationsPage
function IntegrationsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Integrações</h1>
      <WahaConfigForm />
    </div>
  );
}

export default IntegrationsPage; 