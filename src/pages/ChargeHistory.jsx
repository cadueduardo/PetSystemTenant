import { useState, useEffect } from "react";
import { Customer } from "@/api/entities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Search, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useTenant } from '@/components/tenant/TenantContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { functions } from '@/lib/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

export default function ChargeHistoryPage() { 
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const [paidCharges, setPaidCharges] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [isEmittingNFe, setIsEmittingNFe] = useState(null);

  useEffect(() => {
    if (currentTenant?.id) {
      loadData(currentTenant.id);
    } else {
      setPaidCharges([]);
      setCustomers([]);
      setIsLoading(false);
    }
  }, [currentTenant]);

  const loadData = async (tenantId) => {
    console.log(`[ChargeHistory] Loading data for tenant: ${tenantId}`);
    setIsLoading(true);
    try {
      const chargesRef = collection(db, 'tenants', tenantId, 'charges');
      const q = query(
        chargesRef, 
        where('status', '==', 'paid'),
        orderBy('createdAt', 'desc')
      );
      const chargesSnapshot = await getDocs(q);
      const chargesData = chargesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("[ChargeHistory] Paid charges fetched:", chargesData);
      setPaidCharges(chargesData);

      const customersData = await Customer.list();
      console.log("[ChargeHistory] Customers fetched:", customersData);
      setCustomers(customersData);

    } catch (error) {
      console.error("Erro ao carregar histórico de cobranças:", error);
      toast({
          title: "Erro ao carregar histórico",
          description: "Não foi possível buscar o histórico de cobranças. Tente novamente.",
          variant: "destructive"
      });
      setPaidCharges([]);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmitNFe = async (chargeId) => {
    if (!chargeId) {
      toast({
        title: "Erro",
        description: "ID da cobrança não encontrado.",
        variant: "destructive",
      });
      return;
    }

    setIsEmittingNFe(chargeId);
    try {
      const emitNFeFunction = httpsCallable(functions, 'emitNFe');
      // @ts-ignore
      const result = await emitNFeFunction({ tenantId: currentTenant.id, chargeId });
      
      console.log("Resultado da emissão da NF-e:", result);
      
      if (result.data?.success) {
        toast({
          title: "NF-e emitida com sucesso!",
          description: `Nota Fiscal ${result.data.nfeId || ''} gerada.`,
        });
      } else {
        throw new Error(result.data?.message || "Erro desconhecido ao emitir NF-e");
      }
    } catch (error) {
      console.error("Erro ao emitir NF-e:", error);
      toast({
        title: "Erro ao emitir NF-e",
        description: error.message || "Não foi possível gerar a NF-e. Verifique os logs.",
        variant: "destructive",
      });
    } finally {
      setIsEmittingNFe(null);
    }
  };

  const filteredCharges = paidCharges.filter(charge => {
    const customer = customers.find(c => c.id === charge.tutorId);
    const chargeDate = charge.createdAt?.toDate ? format(charge.createdAt.toDate(), "dd/MM/yyyy") : "";
    return customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           chargeDate.includes(searchTerm) ||
           charge.id?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredCharges.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCharges = filteredCharges.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  const renderTableContent = () => {
      if (isLoading) {
          return (
              <TableRow>
                  <TableCell colSpan={6} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/> Carregando histórico...
                  </TableCell>
              </TableRow>
          );
      }

      if (paginatedCharges.length === 0) {
          return (
              <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500">
                      Nenhuma cobrança encontrada{searchTerm ? " para a busca atual" : ""}.
                  </TableCell>
              </TableRow>
          );
      }

      return paginatedCharges.map((charge) => {
        let formattedDate = "Data inválida";
        try {
            const dateSource = charge.paidAt || charge.createdAt;
            const dateObject = dateSource?.toDate ? dateSource.toDate() : (dateSource ? new Date(dateSource) : null);
            if (dateObject && !isNaN(dateObject.getTime())) {
               formattedDate = format(dateObject, "dd/MM/yyyy HH:mm");
            }
        } catch (e) {
            console.error(`Error formatting date for charge ${charge.id}:`, charge.paidAt || charge.createdAt, e);
        }
        
        const customerName = customers.find(c => c.id === charge.tutorId)?.full_name || "Cliente não encontrado";

        return (
            <TableRow key={charge.id}>
                <TableCell>{formattedDate}</TableCell>
                <TableCell>{customerName}</TableCell>
                <TableCell className="text-xs text-gray-600">
                    {charge.episodeId && (
                      <>
                        {charge.prontuarioId && <div>PT: {charge.prontuarioId}</div>}
                        <div>EP: {charge.episodeId}</div>
                      </>
                    )}
                    {charge.osNumber && (
                      <div>OS: {charge.osNumber}</div>
                    )}
                    {!charge.episodeId && !charge.osNumber && (
                        charge.sourceType === 'cashier_direct' ? <div>Venda Direta</div> : <div>-</div>
                    )}
                </TableCell>
                <TableCell className="text-center">{charge.items?.length || 0}</TableCell>
                <TableCell className="text-right">
                {charge.totalAmount?.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }) || 'N/A'}
                </TableCell>
                <TableCell>
                {charge.paymentMethod === 'cash' ? 'Dinheiro' :
                    charge.paymentMethod === 'credit_card' ? 'Crédito' :
                    charge.paymentMethod === 'debit_card' ? 'Débito' :
                    charge.paymentMethod === 'pix' ? 'PIX' :
                    charge.paymentMethod === 'bank_transfer' ? 'Transferência' :
                    charge.paymentMethod === 'check' ? 'Cheque' :
                    charge.paymentMethod === 'other' ? 'Outro' :
                     charge.paymentMethod || 'N/A'}
                </TableCell>
                <TableCell className="text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    charge.status === 'paid' ? 'bg-green-100 text-green-800' :
                    charge.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    charge.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' :
                    charge.status === 'canceled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                }`}>
                    {charge.status === 'paid' ? 'Pago' :
                    charge.status === 'pending' ? 'Pendente' :
                    charge.status === 'partially_paid' ? 'Parcial' :
                    charge.status === 'canceled' ? 'Cancelado' :
                    charge.status || 'N/A'}
                </span>
                </TableCell>
                <TableCell className="text-center">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEmitNFe(charge.id)}
                        disabled={isEmittingNFe === charge.id}
                    >
                        {isEmittingNFe === charge.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Gerar NF
                    </Button>
                </TableCell>
            </TableRow>
        );
      });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tenant/caixa')}> 
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Histórico de Cobranças</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                className="pl-10"
                placeholder="Buscar cliente, data, método..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Pagamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-right">Total Pago</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableContent()}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Linhas por página:</span>
                  <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                      <SelectTrigger className="w-[70px]">
                          <SelectValue placeholder={rowsPerPage} />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                  </span>
                  <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                  >
                      <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                  >
                      <ChevronRight className="h-4 w-4" />
                  </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 