import { useState, useEffect } from "react";
import { PurchaseHistory } from "@/api/entities";
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
import { format } from "date-fns";
import { Search, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const [salesHistory, setSalesHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyData, customersData] = await Promise.all([
        PurchaseHistory.list(),
        Customer.list()
      ]);
      setSalesHistory(historyData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      toast({
          title: "Erro ao carregar histórico",
          description: "Não foi possível buscar o histórico de vendas. Tente novamente.",
          variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSales = salesHistory.filter(sale => {
    const customer = customers.find(c => c.id === sale.customer_id);
    const saleDate = sale.purchase_date ? format(new Date(sale.purchase_date), "dd/MM/yyyy") : "";
    return customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           sale.payment_method?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           saleDate.includes(searchTerm) ||
           sale.id?.toLowerCase().includes(searchTerm.toLowerCase());
  });

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

      if (filteredSales.length === 0) {
          return (
              <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                      Nenhuma venda encontrada{searchTerm ? " para a busca atual" : ""}.
                  </TableCell>
              </TableRow>
          );
      }

      return filteredSales.map((sale) => {
        let formattedDate = "Data inválida";
        try {
            const dateObject = sale.purchase_date?.toDate ? sale.purchase_date.toDate() : new Date(sale.purchase_date);
            if (!isNaN(dateObject.getTime())) {
               formattedDate = format(dateObject, "dd/MM/yyyy HH:mm");
            }
        } catch (e) {
            console.error(`Error formatting date for sale ${sale.id}:`, sale.purchase_date, e);
        }
        
        const customerName = customers.find(c => c.id === sale.customer_id)?.full_name || "Cliente não encontrado";

        return (
            <TableRow key={sale.id}>
                <TableCell>{formattedDate}</TableCell>
                <TableCell>{customerName}</TableCell>
                <TableCell>{sale.items?.length || 0} itens</TableCell>
                <TableCell>
                {sale.total_amount?.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }) || 'N/A'}
                </TableCell>
                <TableCell>
                {sale.payment_method === 'money' ? 'Dinheiro' :
                    sale.payment_method === 'credit' ? 'Cartão de Crédito' :
                    sale.payment_method === 'debit' ? 'Cartão de Débito' :
                    sale.payment_method === 'pix' ? 'PIX' : sale.payment_method || 'N/A'}
                </TableCell>
                <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs ${
                    sale.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                    sale.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                }`}>
                    {sale.payment_status === 'paid' ? 'Pago' :
                    sale.payment_status === 'pending' ? 'Pendente' : sale.payment_status === 'cancelled' ? 'Cancelado' : sale.payment_status || 'N/A'}
                </span>
                </TableCell>
            </TableRow>
        );
      });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tenant/vendas')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Histórico de Vendas</h1>
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
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableContent()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}