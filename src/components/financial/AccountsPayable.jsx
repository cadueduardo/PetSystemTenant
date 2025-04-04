import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isAfter, isBefore, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard,
  Search,
  Plus,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Simulação de contas a pagar
const mockPayables = [
  {
    id: "p1",
    description: "Fornecedor de ração",
    amount: 1200.0,
    due_date: "2023-05-15",
    category: "supplies",
    status: "paid",
    payment_date: "2023-05-13",
    payment_method: "bank_transfer",
    document_number: "NF-5512",
    notes: "Pedido mensal de ração premium"
  },
  {
    id: "p2",
    description: "Aluguel da clínica",
    amount: 3500.0,
    due_date: "2023-05-10",
    category: "rent",
    status: "paid",
    payment_date: "2023-05-08",
    payment_method: "bank_transfer",
    document_number: "RC-2023/05",
    notes: "Aluguel do mês de maio"
  },
  {
    id: "p3",
    description: "Conta de energia",
    amount: 450.0,
    due_date: "2023-05-20",
    category: "utilities",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "FT-22345",
    notes: "Conta de energia mês de abril"
  },
  {
    id: "p4",
    description: "Medicamentos veterinários",
    amount: 2300.0,
    due_date: "2023-05-25",
    category: "supplies",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "NF-6723",
    notes: "Pedido mensal de medicamentos"
  },
  {
    id: "p5",
    description: "Manutenção equipamentos",
    amount: 850.0,
    due_date: "2023-06-05",
    category: "maintenance",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "OS-1234",
    notes: "Manutenção preventiva em equipamentos"
  },
  {
    id: "p6",
    description: "Impostos",
    amount: 1800.0,
    due_date: "2023-06-20",
    category: "taxes",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "DARF-202305",
    notes: "Impostos referentes ao mês de abril"
  },
  {
    id: "p7",
    description: "Salários funcionários",
    amount: 8500.0,
    due_date: "2023-06-05",
    category: "payroll",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "FOL-052023",
    notes: "Folha de pagamento maio/2023"
  }
];

export default function AccountsPayable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [payables, setPayables] = useState(mockPayables);
  
  const getStatusBadge = (status, dueDate) => {
    const today = new Date();
    const parsedDueDate = parseISO(dueDate);
    
    if (status === "paid") {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
    } else if (isToday(parsedDueDate)) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Vence hoje</Badge>;
    } else if (isBefore(parsedDueDate, today)) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Atrasado</Badge>;
    } else {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">A vencer</Badge>;
    }
  };
  
  const getCategoryBadge = (category) => {
    const categories = {
      supplies: { label: "Suprimentos", color: "bg-purple-100 text-purple-800 border-purple-200" },
      rent: { label: "Aluguel", color: "bg-blue-100 text-blue-800 border-blue-200" },
      utilities: { label: "Utilidades", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
      maintenance: { label: "Manutenção", color: "bg-amber-100 text-amber-800 border-amber-200" },
      taxes: { label: "Impostos", color: "bg-pink-100 text-pink-800 border-pink-200" },
      payroll: { label: "Folha de pagamento", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
      others: { label: "Outros", color: "bg-gray-100 text-gray-800 border-gray-200" }
    };
    
    const categoryInfo = categories[category] || categories.others;
    return <Badge variant="outline" className={categoryInfo.color}>{categoryInfo.label}</Badge>;
  };
  
  const filterPayables = () => {
    let filtered = [...payables];
    
    // Filtrar por status
    if (activeTab === "pending") {
      filtered = filtered.filter(p => p.status === "pending");
    } else if (activeTab === "paid") {
      filtered = filtered.filter(p => p.status === "paid");
    } else if (activeTab === "overdue") {
      filtered = filtered.filter(p => {
        const today = new Date();
        const dueDate = parseISO(p.due_date);
        return p.status === "pending" && isBefore(dueDate, today);
      });
    }
    
    // Filtrar por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.description.toLowerCase().includes(term) ||
        p.document_number?.toLowerCase().includes(term) ||
        p.notes?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };
  
  const handlePayAccount = (accountId) => {
    const updatedPayables = payables.map(p => {
      if (p.id === accountId) {
        return {
          ...p,
          status: "paid",
          payment_date: format(new Date(), "yyyy-MM-dd")
        };
      }
      return p;
    });
    
    setPayables(updatedPayables);
  };

  const filteredPayables = filterPayables();
  
  const totalPending = payables
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);
    
  const totalPaid = payables
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
    
  const totalOverdue = payables
    .filter(p => {
      const today = new Date();
      const dueDate = parseISO(p.due_date);
      return p.status === "pending" && isBefore(dueDate, today);
    })
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>Contas a Pagar</CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Buscar conta..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">A Pagar</p>
                <p className="text-2xl font-bold">R$ {totalPending.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Atrasadas</p>
                <p className="text-2xl font-bold">R$ {totalOverdue.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Pagas (mês)</p>
                <p className="text-2xl font-bold">R$ {totalPaid.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="overdue">Atrasadas</TabsTrigger>
            <TabsTrigger value="paid">Pagas</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        <p className="text-gray-500">
                          Nenhuma conta a pagar encontrada
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayables.map((payable) => (
                      <TableRow key={payable.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payable.description}</p>
                            <p className="text-xs text-gray-500">
                              {payable.document_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            R$ {payable.amount.toFixed(2).replace(".", ",")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span>
                              {format(parseISO(payable.due_date), "dd/MM/yyyy")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getCategoryBadge(payable.category)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payable.status, payable.due_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <FileText className="mr-2 h-4 w-4" />
                                Ver detalhes
                              </DropdownMenuItem>
                              {payable.status === "pending" && (
                                <DropdownMenuItem onClick={() => handlePayAccount(payable.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Marcar como pago
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Registrar pagamento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}