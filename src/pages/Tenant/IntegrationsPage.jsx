import { useState, useEffect, useCallback } from 'react';
// import { Card, CardContent, Typography, Button, CircularProgress, Box, Chip, Alert } from '@mui/material'; // Remover importações MUI não usadas
import { useTenant } from '@/components/tenant/TenantContext';
// import { toast } from 'react-toastify'; // Remover toast de react-toastify
import { httpsCallable } from "firebase/functions"; // <<< MANTER httpsCallable >>>
import { doc, onSnapshot } from "firebase/firestore"; // <<< MANTER doc, onSnapshot >>>
import { db, functions } from '@/lib/firebaseConfig'; // <<< IMPORTAR db e functions >>>
import { Button } from '@/components/ui/button'; // Usar Button de shadcn
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Usar Card de shadcn
import { Loader2 } from 'lucide-react'; // Manter Loader2 se for usado
import { useToast } from "@/components/ui/use-toast"; // Usar useToast de shadcn
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from "@/components/ui/alert" // Renomear para evitar conflito
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// --- Funções Callable (Remover não usadas) ---
// const getWahaSessionStatusCallable = httpsCallable(functions, 'getWahaSessionStatus'); // Ainda não usado
// const getWahaQrCodeCallable = httpsCallable(functions, 'getWahaQrCode'); 
// const startWahaSessionCallable = httpsCallable(functions, 'startWahaSession');
// const stopWahaSessionCallable = httpsCallable(functions, 'stopWahaSession');

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
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false); // <<< ESTADO PARA O DIALOG >>>
    
    // --- NOVO: Efeito Listener do Firestore --- 
    useEffect(() => {
        let isMounted = true; // Flag para evitar updates em componente desmontado

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
                    const firestoreData = snapshot.data();
                    console.log('[Firestore Listener] Data:', firestoreData);

                    // Atualiza o status da sessão sempre
                    if (isMounted) {
                         setSessionStatus(firestoreData.status || 'Desconhecido');
                    }

                    // Lógica para buscar QR Code SE necessário
                    if (firestoreData.status === 'QRCode' && !firestoreData.qrCodeDataUri) {
                         console.log('[Firestore Listener] Status is QRCode and no QR data URI found. Fetching QR...');
                         if(isMounted) { setQrCodeValue(null); }
                         
                         const getWahaQrCodeCallable = httpsCallable(functions, 'getWahaQrCode'); 
                         getWahaQrCodeCallable()
                            .then((result) => {
                                 if (isMounted) {
                                      console.log('[Firestore Listener] QR Code fetched successfully:', result.data);
                                      setQrCodeValue(result.data.qrCodeDataUri);
                                      setError(null); // Limpa erro se buscar com sucesso
                                 }
                            })
                            .catch((callError) => {
                                 if (isMounted) {
                                     console.error('[Firestore Listener] Error fetching QR Code:', callError);
                                     setError(`Falha ao buscar QR Code: ${callError.message}`);
                                     setQrCodeValue(null); // Garante que QR não seja exibido em caso de erro
                                 }
                            });
                    } else if (isMounted) {
                         // Se o status não for QRCode ou se já tiver URI, usa o valor do Firestore
                         setQrCodeValue(firestoreData.qrCodeDataUri || null);
                    }
                } else {
                    console.log('[Firestore Listener] Document does not exist. Setting state to Desconectado.');
                    if (isMounted) {
                        setSessionStatus('Desconectado'); // Assume desconectado se não houver dados
                        setQrCodeValue(null);
                        setError(null);
                    }
                }
                if (isMounted) {
                     setLoadingStatus(false); // Esconde loading após receber dados (ou ausência deles)
                }
            },
            (err) => {
                console.error('[Firestore Listener] Error listening to document:', err);
                if (isMounted) {
                    setError('Erro ao receber atualizações em tempo real. Tente recarregar a página.');
                    setSessionStatus('Erro');
                    setQrCodeValue(null);
                    setLoadingStatus(false);
                }
            }
        );

        // Função de cleanup: Para de ouvir quando o componente desmontar ou tenantId mudar
        return () => {
            console.log(`[Firestore Listener] Cleaning up listener for tenant: ${currentTenant.id}`);
            isMounted = false; // Define a flag como falsa na desmontagem
            unsubscribe();
        };

    }, [currentTenant?.id]); // Dependência: reativa se o tenant mudar

    // --- NOVA FUNÇÃO PARA EXECUTAR A DESCONEXÃO --- 
    const executeDisconnect = async () => {
        console.log('[executeDisconnect] Proceeding with stop session...');
        setError(null);
        setActionLoading(true);
        toast({ title: "Desconectando...", description: "Enviando solicitação para desconectar a sessão." });
        try {
            const stopWahaSessionCallable = httpsCallable(functions, 'stopWahaSession'); 
            const result = await stopWahaSessionCallable();
            if (result?.data?.code === 'not-found') {
                toast({ title: "Sessão Desconectada", description: "A sessão já estava desconectada ou não foi encontrada." });
            } else {
                toast({ title: "Desconexão Solicitada", description: "Solicitação enviada. Aguarde a atualização do status." });
            }
        } catch (callError) {
            console.error('[executeDisconnect] Error stopping session:', callError);
            let errorMessage = 'Erro ao tentar desconectar a sessão.';
            errorMessage = callError?.message || errorMessage;
            setError(errorMessage);
            setSessionStatus('Erro'); 
            toast({ title: "Erro ao Desconectar", description: errorMessage, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    // --- Função para Gerenciar Conexão --- MODIFICADA ---
    const handleManageConnection = useCallback(async () => {
        
        if (sessionStatus === 'Conectado' || sessionStatus === 'QRCode') {
            // --- APENAS ABRIR O DIÁLOGO --- 
            console.log('[handleManageConnection] Opening confirmation dialog...');
            setIsConfirmDialogOpen(true); 
        } else { 
             // --- CHAMAR FUNÇÃO DE CONECTAR (lógica existente) --- 
             setError(null); 
             setActionLoading(true); 
             console.log('[handleManageConnection] Attempting to start session...');
             toast({ title: "Iniciando Conexão...", description: "Enviando solicitação para conectar e obter QR Code." });
            try {
                const startWahaSessionCallable = httpsCallable(functions, 'startWahaSession'); 
                const result = await startWahaSessionCallable();
                if (result?.data?.code === 'already-started') {
                     toast({ title: "Sessão Ativa", description: "A sessão já está em processo de inicialização ou ativa." });
                 } else {
                     toast({ title: "Iniciando", description: "Solicitação enviada. Aguardando QR Code ou conexão..." });
                 }
             } catch (callError) {
                 console.error('[handleManageConnection] Error starting session:', callError);
                 let errorMessage = 'Erro ao tentar iniciar a conexão.';
                 errorMessage = callError?.message || errorMessage;
                 setError(errorMessage);
                 setSessionStatus('Erro'); 
                 toast({ title: "Erro ao Iniciar", description: errorMessage, variant: "destructive" });
             } finally {
                 setActionLoading(false); 
             }
        }

    }, [sessionStatus, toast]); // Dependências atualizadas

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
                            disabled={loadingStatus || actionLoading}
                        >
                             {actionLoading && (sessionStatus === 'Iniciando' || sessionStatus === 'Desconectado' || sessionStatus === 'Erro') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                            {getButtonText(sessionStatus)}
                        </Button>

                        {/* <<< ADICIONAR AlertDialog PARA CONFIRMAÇÃO >>> */}
                        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                            {/* <AlertDialogTrigger> Não precisamos de um gatilho separado, o botão principal controla */}
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Desconexão</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja desconectar a sessão atual do WhatsApp?
                                    Isso interromperá o envio e recebimento de mensagens até que você conecte novamente.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={executeDisconnect} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                                    Confirmar Desconexão
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

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