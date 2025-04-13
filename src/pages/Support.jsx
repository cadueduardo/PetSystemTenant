import { useState, useEffect } from "react";
// import { User as UserEntity } from "@/api/entities"; // Removido
// import { SupportTicket } from "@/api/entities"; // Removido
// import { KnowledgeArticle } from "@/api/entities"; // Removido
// import { useNavigate } from "react-router-dom"; // Removido
// import { createPageUrl } from "@/utils"; // Removido
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
   doc, Timestamp, getDoc
} from "firebase/firestore";
import { useTenant } from "@/components/tenant/TenantContext";
import { useToast } from "@/components/ui/use-toast";
// import { getAuth } from "firebase/auth"; // Comentado ou removido
import { db } from "@/lib/firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app"; // Importar getApp para passar para getFunctions

import { Button } from "@/components/ui/button";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Removido
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input"; // Removido
// import { Badge } from "@/components/ui/badge"; // Removido (usado em getStatus/PriorityBadge, mas as chamadas foram removidas)
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table"; // Removido
import {
  // Plus, // Mantido? Usado em Novo Chamado
  // Search, // Removido
  // BookOpen, // Removido
  // MessageSquareMore, // Removido
  // ArrowRight, // Removido
  AlertTriangle, // Mantido (Card Acesso Suporte)
  Clock, // Mantido (Card Acesso Suporte)
  CheckCircle2, // Mantido (Card Acesso Suporte)
  Loader2 // Mantido (Loadings)
} from "lucide-react";

// Remover imports de componentes não usados se as seções foram removidas
// import NewTicketForm from "../components/support/NewTicketForm"; 
// import KnowledgeBaseSearch from "../components/support/KnowledgeBaseSearch";
// import Chatbot from "../components/support/Chatbot";

// const priorityColors = { ... }; // Remover se getPriorityBadge for removido
// const statusColors = { ... }; // Remover se getStatusBadge for removido

// Instanciar Firebase Functions ESPECIFICANDO A REGIÃO
const app = getApp(); // Obter a instância padrão do Firebase App
const functions = getFunctions(app, 'us-central1'); // MUDAR REGIÃO
const manageSupportAccessCallable = httpsCallable(functions, 'manageSupportAccess');

export default function SupportPage() {
  // const navigate = useNavigate(); // Removido
  // const [showNewTicket, setShowNewTicket] = useState(false); // Remover se botão Novo Chamado for removido
  // const [tickets, setTickets] = useState([]); 
  // const [articles, setArticles] = useState([]); 
  // const [isLoading, setIsLoading] = useState(true); // Removido (usaremos isSupportAccessLoading)
  // const [searchTerm, setSearchTerm] = useState(""); // Remover se busca for removida
  // const [showChatbot, setShowChatbot] = useState(false); // Remover se botão Chatbot for removido
  const [isSupportAccessLoading, setIsSupportAccessLoading] = useState(true);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [supportAccessGranted, setSupportAccessGranted] = useState(false);
  const [supportAccessExpiresAt, setSupportAccessExpiresAt] = useState(null);
  const { toast } = useToast();

  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  useEffect(() => {
    if (tenantId) {
    loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) {
       console.log("Support.jsx - loadData: tenantId is null/undefined. Skipping fetch.");
       setIsSupportAccessLoading(false);
       return; 
    }

    console.log(`Support.jsx - loadData: START - Fetching data for tenant ID: ${tenantId}`);
    setIsSupportAccessLoading(true);
    setSupportAccessGranted(false);
    setSupportAccessExpiresAt(null);
    let success = false;
    
    try {
      console.log(`Support.jsx - loadData: Getting tenant document ref...`);
      const tenantRef = doc(db, "tenants", tenantId);
      console.log(`Support.jsx - loadData: Attempting getDoc...`);
      const tenantSnap = await getDoc(tenantRef);
      console.log(`Support.jsx - loadData: getDoc finished. Exists: ${tenantSnap.exists()}`);
      
      if (!tenantSnap.exists()) {
          console.error("Support.jsx - loadData: Tenant document not found for ID:", tenantId);
          toast({ title: "Erro", description: "Documento do tenant não encontrado.", variant: "destructive" });
          return; 
      }
      
      console.log(`Support.jsx - loadData: Tenant document found. Processing data...`);
      const tenantData = tenantSnap.data();
      let currentGranted = tenantData.supportAccessGranted || false;
      let currentExpires = tenantData.supportAccessExpiresAt || null;
          
      if (currentGranted && currentExpires && currentExpires.toMillis() < Date.now()) {
          console.log(`Support.jsx - loadData: Support access found but expired.`);
          currentGranted = false; 
          currentExpires = null;
      }
      
      setSupportAccessGranted(currentGranted);
      setSupportAccessExpiresAt(currentExpires);
      console.log(`Support.jsx - loadData: Support status set - Granted: ${currentGranted}, Expires: ${currentExpires?.toDate()}`);
      success = true;

    } catch (error) {
      success = false;
      console.error("Support.jsx - loadData: ERROR during fetch:", error);
      toast({ title: "Erro ao Carregar Dados", description: error.message || "Falha ao buscar informações.", variant: "destructive" });
      setSupportAccessGranted(false);
      setSupportAccessExpiresAt(null);
    } finally {
      setIsSupportAccessLoading(false);
      console.log(`Support.jsx - loadData: FINALLY block executed. Loadings set to false. Success: ${success}`);
    }
  };

  const grantSupportAccess = async () => {
    if (!tenantId) {
      console.error("Grant Access Error: Tenant ID inválido.");
      toast({ title: "Erro", description: "ID do Tenant inválido.", variant: "destructive" });
      return;
    }
    setIsUpdatingAccess(true);
    try {
      console.log("[grantSupportAccess] Calling Cloud Function 'manageSupportAccess' with action: grant");
      const result = await manageSupportAccessCallable({ action: 'grant' });
      console.log("[grantSupportAccess] Cloud Function result:", result);
      
      const resultData = result.data;

      if (resultData?.success) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 1);
        setSupportAccessGranted(true);
        setSupportAccessExpiresAt(Timestamp.fromDate(expirationDate));
        
        toast({ title: "Sucesso", description: resultData.message || "Acesso concedido." });
      } else {
        toast({ title: "Erro Inesperado", description: resultData?.message || "Falha ao conceder acesso.", variant: "destructive" });
      }

    } catch (error) {
      console.error("Erro ao chamar a função manageSupportAccess (grant):", error);
      const message = error.message || "Falha ao comunicar com o servidor para conceder acesso.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const revokeSupportAccess = async () => {
    if (!tenantId) {
      console.error("Revoke Access Error: Tenant ID inválido.");
      toast({ title: "Erro", description: "ID do Tenant inválido.", variant: "destructive" });
      return;
    }
    setIsUpdatingAccess(true);
    try {
      console.log("[revokeSupportAccess] Calling Cloud Function 'manageSupportAccess' with action: revoke");
      const result = await manageSupportAccessCallable({ action: 'revoke' });
      console.log("[revokeSupportAccess] Cloud Function result:", result);

      const resultData = result.data;

       if (resultData?.success) {
        setSupportAccessGranted(false);
        setSupportAccessExpiresAt(null);
        toast({ title: "Sucesso", description: resultData.message || "Acesso revogado." });
       } else {
         toast({ title: "Erro Inesperado", description: resultData?.message || "Falha ao revogar acesso.", variant: "destructive" });
       }

    } catch (error) {
      console.error("Erro ao chamar a função manageSupportAccess (revoke):", error);
      const message = error.message || "Falha ao comunicar com o servidor para revogar acesso.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const formattedExpiration = supportAccessExpiresAt 
    ? format(supportAccessExpiresAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })
    : null;

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Suporte</h1>
          <p className="text-gray-500">Acesso Remoto para Suporte</p>
        </div>
      </div>

      <Card className="mb-6 bg-amber-50 border-amber-200">
          <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-5 h-5" />
            Acesso Remoto para Suporte
          </CardTitle>
          </CardHeader>
          <CardContent>
          {isSupportAccessLoading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando status do acesso...
                </div>
          ) : supportAccessGranted ? (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-green-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Acesso ao suporte CONCEDIDO.
                </p>
                <p className="text-sm text-gray-600">
                  A equipe de suporte pode acessar sua conta para diagnóstico até {formattedExpiration}.
                </p>
              </div>
              <Button 
                variant="destructive"
                onClick={revokeSupportAccess}
                disabled={isUpdatingAccess}
              >
                {isUpdatingAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Revogar Acesso
              </Button>
                </div>
              ) : (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div>
                <p className="text-red-700 font-medium flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Acesso ao suporte NÃO concedido.
                </p>
                <p className="text-sm text-gray-600">
                  Conceda acesso temporário (24h) para que nossa equipe possa investigar problemas em sua conta.
                                </p>
                              </div>
                              <Button
                variant="default" 
                className="bg-amber-600 hover:bg-amber-700"
                onClick={grantSupportAccess}
                disabled={isUpdatingAccess}
              >
                 {isUpdatingAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Conceder Acesso (24h)
                              </Button>
                </div>
              )}
            </CardContent>
          </Card>
    </div>
  );
}
