import React, { useState, useEffect } from "react";
import { PurchaseHistory } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

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
    try {
      const [historyData, customersData] = await Promise.all([
        PurchaseHistory.list(),
        Customer.list()
      ]);
      setSalesHistory(historyData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSales = salesHistory.filter(sale => {
    const customer = customers.find(c => c.id === sale.customer_id);
    return customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           sale.payment_method?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Sales"))}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Histórico de Vendas</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Vendas Realizadas</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                className="pl-10"
                placeholder="Buscar vendas..."
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
                <TableHead>Itens</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {format(new Date(sale.purchase_date), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    {customers.find(c => c.id === sale.customer_id)?.full_name}
                  </TableCell>
                  <TableCell>{sale.items.length} itens</TableCell>
                  <TableCell>
                    {sale.total_amount.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </TableCell>
                  <TableCell>
                    {sale.payment_method === 'money' ? 'Dinheiro' :
                     sale.payment_method === 'credit' ? 'Cartão de Crédito' :
                     sale.payment_method === 'debit' ? 'Cartão de Débito' :
                     sale.payment_method === 'pix' ? 'PIX' : sale.payment_method}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      sale.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      sale.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {sale.payment_status === 'paid' ? 'Pago' :
                       sale.payment_status === 'pending' ? 'Pendente' : 'Cancelado'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}