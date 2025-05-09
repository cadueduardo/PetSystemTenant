import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/components/tenant/TenantContext';
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FIRESTORE_WAHA_DOC = 'wahaIntegration';

function WahaConfigForm() {
    const { currentTenant } = useTenant();
    const { toast } = useToast();
    const [sessionStatus, setSessionStatus] = useState('Desconhecido');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [qrCodeValue, setQrCodeValue] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    
    useEffect(() => {
        let isMounted = true;

        if (!currentTenant?.id) {
            setSessionStatus('Desconhecido');
            setQrCodeValue(null);
            setError(null);
            setLoadingStatus(false);
            console.log('[Firestore Listener] No Tenant ID, clearing state.');
            return;
        }

        console.log(`[Firestore Listener] Setting up listener for tenant: ${currentTenant.id}`);
        setLoadingStatus(true);
        setError(null);

        const docPath = `tenants/${currentTenant.id}/integrations/${FIRESTORE_WAHA_DOC}`;
        const docRef = doc(db, docPath);

        const unsubscribe = onSnapshot(docRef, 
            (snapshot) => {
                console.log('[Firestore Listener] Snapshot received.');
                if (snapshot.exists()) {
                    const firestoreData = snapshot.data();
                    console.log('[Firestore Listener] Data:', firestoreData);

                    if (isMounted) {
                         setSessionStatus(firestoreData.status || 'Desconhecido');
                    }

                    if (firestoreData.status === 'QRCode' && !firestoreData.qrCodeDataUri) {
                         console.log('[Firestore Listener] Status is QRCode and no QR data URI found. Fetching QR...');
                         if(isMounted) { setQrCodeValue(null); }
                         
                         const getWahaQrCodeCallable = httpsCallable(functions, 'getWahaQrCode'); 
                         getWahaQrCodeCallable()
                            .then((result) => {
                                 if (isMounted) {
                                      console.log('[Firestore Listener] QR Code fetched successfully:', result.data);
                                      setQrCodeValue(result.data.qrCodeDataUri);
                                      setError(null);
                                 }
                            })
                            .catch((callError) => {
                                 if (isMounted) {
                                     console.error('[Firestore Listener] Error fetching QR Code:', callError);
                                     setError(`Falha ao buscar QR Code: ${callError.message}`);
                                     setQrCodeValue(null);
                                 }
                            });
                    } else if (isMounted) {
                         setQrCodeValue(firestoreData.qrCodeDataUri || null);
                    }
                } else {
                    console.log('[Firestore Listener] Document does not exist. Setting state to Desconectado.');
                    if (isMounted) {
                        setSessionStatus('Desconectado');
                        setQrCodeValue(null);
                        setError(null);
                    }
                }
                if (isMounted) {
                     setLoadingStatus(false);
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

        return () => {
            console.log(`[Firestore Listener] Cleaning up listener for tenant: ${currentTenant.id}`);
            isMounted = false;
            unsubscribe();
        };

    }, [currentTenant?.id]);

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

    const handleManageConnection = useCallback(async () => {
        if (sessionStatus === 'Conectado' || sessionStatus === 'QRCode') {
            console.log('[handleManageConnection] Opening confirmation dialog...');
            setIsConfirmDialogOpen(true); 
        } else { 
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
    }, [sessionStatus, toast]);

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

    const getButtonText = (status) => {
         switch (status) {
             case 'Conectado': return 'Desconectar WhatsApp';
             case 'QRCode': return 'Cancelar / Desconectar';
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
                <CardTitle>Configurar Conexão WhatsApp (WAHA)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {loadingStatus ? (
                   <div className="flex items-center gap-2">
                       <Loader2 className="h-5 w-5 animate-spin" />
                       <span>Verificando status...</span>
                   </div>
                ) : (
                    <div className="space-y-4">
                         <div className="flex items-center gap-2">
                            <span>Status:</span>
                             {actionLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                            <span className={getStatusClasses(sessionStatus)}>{sessionStatus}</span>
                        </div>
                        {error && (
                            <ShadcnAlert variant="destructive">
                              <AlertTitle>Erro</AlertTitle>
                              <AlertDescription>{error}</AlertDescription>
                            </ShadcnAlert>
                        )}
                        {sessionStatus === 'QRCode' && (
                            <div className="mt-2 p-4 border rounded-md text-center space-y-2">
                                <p className="text-sm font-medium">
                                    Escaneie o código abaixo com o seu WhatsApp para conectar:
                                </p>
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
                        <Button
                            onClick={handleManageConnection}
                            disabled={loadingStatus || actionLoading}
                        >
                             {actionLoading && (sessionStatus === 'Iniciando' || sessionStatus === 'Desconectado' || sessionStatus === 'Erro') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                            {getButtonText(sessionStatus)}
                        </Button>
                        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
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

function WahaSetupPage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <Button variant="outline" onClick={() => navigate('/tenant/integracoes')} className="mb-4">
          &larr; Voltar para Central de Integrações
        </Button>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
          Configuração da Integração WhatsApp
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Gerencie a conexão da sua conta do WhatsApp para enviar notificações e interagir com seus clientes.
        </p>
      </header>
      <WahaConfigForm />
    </div>
  );
}

export default WahaSetupPage; 