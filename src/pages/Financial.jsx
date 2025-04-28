import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useTenant } from "@/components/tenant/TenantContext";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X, Construction } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import AccountsPayable from "../components/financial/AccountsPayable";
import AccountsReceivable from "../components/financial/AccountsReceivable";
import CashFlow from "../components/financial/CashFlow";

export default function FinancialPage() {
  const navigate = useNavigate();
  const { currentTenant, isLoading: isTenantLoading, error: tenantError } = useTenant();
  const [activeTab, setActiveTab] = useState("cashflow");
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const [transactionForm, setTransactionForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    type: "income",
    category: "sale",
    paymentMethod: "cash",
    status: "completed",
    notes: ""
  });

  useEffect(() => {
    if (!isTenantLoading && currentTenant) {
      if (!currentTenant.selected_modules?.includes("financial")) {
        console.warn("[FinancialPage] Acesso negado: Módulo financeiro não habilitado.");
        setHasAccess(false);
      } else {
        setHasAccess(true);
      }
    } else if (!isTenantLoading && !currentTenant) {
      console.error("[FinancialPage] Tenant não encontrado no contexto.");
      navigate(createPageUrl("Landing"));
    }
  }, [currentTenant, isTenantLoading, navigate]);

  const handleNewTransaction = () => {
    setShowTransactionModal(true);
  };
  
  const handleCloseModal = () => {
    setShowTransactionModal(false);
  };
  
  const handleTransactionFormChange = (e) => {
    const { name, value } = e.target;
    setTransactionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleTransactionTypeChange = (value) => {
    setTransactionForm(prev => ({
      ...prev,
      type: value
    }));
  };
  
  const handleTransactionCategoryChange = (value) => {
    setTransactionForm(prev => ({
      ...prev,
      category: value
    }));
  };
  
  const handlePaymentMethodChange = (value) => {
    setTransactionForm(prev => ({
      ...prev,
      paymentMethod: value
    }));
  };
  
  const handleTransactionStatusChange = (value) => {
    setTransactionForm(prev => ({
      ...prev,
      status: value
    }));
  };
  
  const handleTransactionSubmit = (e) => {
    e.preventDefault();
    
    console.log("Salvando transação:", transactionForm);
    
    toast({
      title: "Transação registrada (Simulação)",
      description: "A funcionalidade de salvar ainda não está implementada."
    });
    
    setShowTransactionModal(false);
    setTransactionForm({
      description: "",
      amount: "",
      date: new Date().toISOString().split('T')[0],
      type: "income",
      category: "sale",
      paymentMethod: "cash",
      status: "completed",
      notes: ""
    });
  };

  if (isTenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (tenantError) {
    return (
      <div className="container mx-auto py-6 text-center text-red-600">
        Erro ao carregar dados do tenant: {tenantError}
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="container mx-auto py-6 text-center text-gray-500">
        Redirecionando...
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-10 flex flex-col items-center justify-center text-center">
        <Construction className="h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Módulo em Desenvolvimento</h1>
        <p className="text-gray-600">O módulo financeiro está sendo preparado e estará disponível em breve.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-gray-500">Gestão financeira do negócio</p>
        </div>
        <Button onClick={handleNewTransaction} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Transação
        </Button>
      </div>

      <Tabs defaultValue="cashflow" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="receivable">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payable">Contas a Pagar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="cashflow" className="mt-0">
          <CashFlow tenantId={currentTenant.id} />
        </TabsContent>
        
        <TabsContent value="receivable" className="mt-0">
          <AccountsReceivable tenantId={currentTenant.id} />
        </TabsContent>
        
        <TabsContent value="payable" className="mt-0">
          <AccountsPayable tenantId={currentTenant.id} />
        </TabsContent>
      </Tabs>

      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Nova Transação</h2>
              <Button variant="ghost" size="icon" onClick={handleCloseModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input 
                  id="description" 
                  name="description" 
                  value={transactionForm.description}
                  onChange={handleTransactionFormChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input 
                  id="amount" 
                  name="amount" 
                  type="number" 
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={handleTransactionFormChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input 
                  id="date" 
                  name="date" 
                  type="date"
                  value={transactionForm.date}
                  onChange={handleTransactionFormChange}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={transactionForm.type} onValueChange={handleTransactionTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={transactionForm.category} onValueChange={handleTransactionCategoryChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionForm.type === "income" ? (
                        <>
                          <SelectItem value="sale">Venda</SelectItem>
                          <SelectItem value="service">Serviço</SelectItem>
                          <SelectItem value="consultation">Consulta</SelectItem>
                          <SelectItem value="other_income">Outros</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="supplier">Fornecedor</SelectItem>
                          <SelectItem value="rent">Aluguel</SelectItem>
                          <SelectItem value="utilities">Utilidades</SelectItem>
                          <SelectItem value="salary">Salário</SelectItem>
                          <SelectItem value="tax">Impostos</SelectItem>
                          <SelectItem value="other_expense">Outros</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                  <Select value={transactionForm.paymentMethod} onValueChange={handlePaymentMethodChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                      <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={transactionForm.status} onValueChange={handleTransactionStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea 
                  id="notes" 
                  name="notes"
                  value={transactionForm.notes}
                  onChange={handleTransactionFormChange}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar Transação
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}