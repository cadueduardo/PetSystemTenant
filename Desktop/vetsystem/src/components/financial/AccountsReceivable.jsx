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
  DollarSign,
  Search,
  Plus,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  MoreHorizontal,
  User
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Simulação de contas a receber
const mockReceivables = [
  {
    id: "r1",
    description: "Consulta veterinária",
    customer_name: "Maria Silva",
    amount: 150.0,
    due_date: "2023-05-15",
    category: "service",
    status: "received",
    payment_date: "2023-05-15",
    payment_method: "credit_card",
    document_number: "REC-001",
    notes: "Consulta de rotina"
  },
  {
    id: "r2",
    description: "Exame de sangue",
    customer_name: "João Pereira",
    amount: 120.0,
    due_date: "2023-05-10",
    category: "exam",
    status: "received",
    payment_date: "2023-05-10",
    payment_method: "cash",
    document_number: "REC-002",
    notes: "Exame completo"
  },
  {
    id: "r3",
    description: "Vacina antirrábica",
    customer_name: "Ana Sousa",
    amount: 85.0,
    due_date: "2023-05-20",
    category: "vaccine",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "REC-003",
    notes: "Vacina anual"
  },
  {
    id: "r4",
    description: "Banho e tosa",
    customer_name: "Carlos Oliveira",
    amount: 90.0,
    due_date: "2023-05-25",
    category: "grooming",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "REC-004",
    notes: "Tosa higiênica + banho especial"
  },
  {
    id: "r5",
    description: "Cirurgia castração",
    customer_name: "Amanda Costa",
    amount: 450.0,
    due_date: "2023-06-05",
    category: "surgery",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "REC-005",
    notes: "Valor parcial, 50% já pago"
  },
  {
    id: "r6",
    description: "Tratamento dentário",
    customer_name: "Roberto Santos",
    amount: 320.0,
    due_date: "2023-06-20",
    category: "dental",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "REC-006",
    notes: "Limpeza dentária completa"
  },
  {
    id: "r7",
    description: "Medicamentos",
    customer_name: "Fernanda Lima",
    amount: 180.0,
    due_date: "2023-06-05",
    category: "medicine",
    status: "pending",
    payment_date: null,
    payment_method: null,
    document_number: "REC-007",
    notes: "Antibióticos e anti-inflamatórios"
  }
];

export default function AccountsReceivable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [receivables, setReceivables] = useState(mockReceivables);
  
  const getStatusBadge = (status, dueDate) => {
    const today = new Date();
    const parsedDueDate = parseISO(dueDate);
    
    if (status === "received") {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Recebido</Badge>;
    } else if (isToday(parsedDueDate)) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Vence hoje</Badge>;
    } else if (isBefore(parsedDueDate, today)) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Atrasado</Badge>;
    } else {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">A receber</Badge>;
    }
  };
  
  const getCategoryBadge = (category) => {
    const categories = {
      service: { label: "Consulta", color: "bg-purple-100 text-purple-800 border-purple-200" },
      exam: { label: "Exame", color: "bg-blue-100 text-blue-800 border-blue-200" },
      vaccine: { label: "Vacina", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
      grooming: { label: "Banho & Tosa", color: "bg-amber-100 text-amber-800 border-amber-200" },
      surgery: { label: "Cirurgia", color: "bg-pink-100 text-pink-800 border-pink-200" },
      dental: { label: "Odontologia", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
      medicine: { label: "Medicamentos", color: "bg-green-100 text-green-800 border-green-200" },
      others: { label: "Outros", color: "bg-gray-100 text-gray-800 border-gray-200" }
    };
    
    const categoryInfo = categories[category] || categories.others;
    return <Badge variant="outline" className={categoryInfo.color}>{categoryInfo.label}</Badge>;
  };
  
  const filterReceivables = () => {
    let filtered = [...receivables];
    
    // Filtrar por status
    if (activeTab === "pending") {
      filtered = filtered.filter(r => r.status === "pending");
    } else if (activeTab === "received") {
      filtered = filtered.filter(r => r.status === "received");
    } else if (activeTab === "overdue") {
      filtered = filtered.filter(r => {
        const today = new Date();
        const dueDate = parseISO(r.due_date);
        return r.status === "pending" && isBefore(dueDate, today);
      });
    }
    
    // Filtrar por termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.description.toLowerCase().includes(term) ||
        r.customer_name.toLowerCase().includes(term) ||
        r.document_number?.toLowerCase().includes(term) ||
        r.notes?.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };
  
  const handleReceivePayment = (receivableId) => {
    const updatedReceivables = receivables.map(r => {
      if (r.id === receivableId) {
        return {
          ...r,
          status: "received",
          payment_date: format(new Date(), "yyyy-MM-dd"),
          payment_method: "cash" // valor padrão para demonstração
        };
      }
      return r;
    });
    
    setReceivables(updatedReceivables);
  };

  const filteredReceivables = filterReceivables();
  
  const totalPending = receivables
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + r.amount, 0);
    
  const totalReceived = receivables
    .filter(r => r.status === "received")
    .reduce((sum, r) => sum + r.amount, 0);
    
  const totalOverdue = receivables
    .filter(r => {
      const today = new Date();
      const dueDate = parseISO(r.due_date);
      return r.status === "pending" && isBefore(dueDate, today);
    })
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>Contas a Receber</CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Buscar recebimento..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Recebimento
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">A Receber</p>
                <p className="text-2xl font-bold">R$ {totalPending.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Atrasados</p>
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
                <p className="text-sm font-medium text-gray-500">Recebidos (mês)</p>
                <p className="text-2xl font-bold">R$ {totalReceived.toFixed(2).replace(".", ",")}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="overdue">Atrasados</TabsTrigger>
            <TabsTrigger value="received">Recebidos</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceivables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        <p className="text-gray-500">
                          Nenhuma conta a receber encontrada
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReceivables.map((receivable) => (
                      <TableRow key={receivable.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{receivable.description}</p>
                            <p className="text-xs text-gray-500">
                              {receivable.document_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span>{receivable.customer_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            R$ {receivable.amount.toFixed(2).replace(".", ",")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span>
                              {format(parseISO(receivable.due_date), "dd/MM/yyyy")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getCategoryBadge(receivable.category)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(receivable.status, receivable.due_date)}
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
                              {receivable.status === "pending" && (
                                <DropdownMenuItem onClick={() => handleReceivePayment(receivable.id)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Registrar recebimento
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Estornar recebimento
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