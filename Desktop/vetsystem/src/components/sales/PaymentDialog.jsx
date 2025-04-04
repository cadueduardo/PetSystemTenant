import React, { useState } from "react";
import { PurchaseHistory } from "@/api/entities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { 
  CreditCard, 
  Banknote, 
  QrCode, 
  Loader2, 
  Receipt,
  Check
} from "lucide-react";

export default function PaymentDialog({ open, onOpenChange, cart, customer, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("money");
  const [changeAmount, setChangeAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [cardInfo, setCardInfo] = useState({
    number: "",
    holder: "",
    expiry: "",
    cvv: ""
  });

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const calculateChange = () => {
    const received = parseFloat(receivedAmount) || 0;
    return received > total ? received - total : 0;
  };

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
  };

  const handleReceivedAmountChange = (e) => {
    const value = e.target.value;
    setReceivedAmount(value);
    setChangeAmount(calculateChange());
  };

  const handleCardInfoChange = (e) => {
    const { name, value } = e.target;
    setCardInfo({
      ...cardInfo,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    if (!customer) {
      toast({
        title: "Cliente obrigatório",
        description: "Selecione um cliente para continuar.",
        variant: "destructive"
      });
      return;
    }

    if (paymentMethod === "money" && parseFloat(receivedAmount) < total) {
      toast({
        title: "Valor insuficiente",
        description: "O valor recebido é menor que o total da compra.",
        variant: "destructive"
      });
      return;
    }

    if (paymentMethod === "credit_card" || paymentMethod === "debit_card") {
      if (!cardInfo.number || !cardInfo.holder || !cardInfo.expiry || !cardInfo.cvv) {
        toast({
          title: "Dados do cartão incompletos",
          description: "Preencha todos os dados do cartão.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      const purchaseData = {
        customer_id: customer.id,
        purchase_date: new Date().toISOString(),
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: "paid",
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        })),
        tenant_id: localStorage.getItem('current_tenant')
      };

      await PurchaseHistory.create(purchaseData);

      toast({
        title: "Venda finalizada",
        description: "Pagamento processado com sucesso!",
      });

      onSuccess();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o pagamento.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Finalizar Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Cliente</h3>
            <div className="p-3 bg-gray-50 rounded-lg">
              {customer ? (
                <>
                  <p className="font-medium">{customer.full_name}</p>
                  <p className="text-sm text-gray-500">{customer.email}</p>
                </>
              ) : (
                <p className="text-red-500">Nenhum cliente selecionado</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Resumo da compra</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[200px] overflow-y-auto">
                {cart.map(item => (
                  <div key={`${item.type}-${item.id}`} className="p-3 flex items-center justify-between border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} x {item.price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </p>
                    </div>
                    <p className="font-medium">
                      {(item.price * item.quantity).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-gray-50 font-bold flex items-center justify-between">
                <span>Total</span>
                <span>
                  {total.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-4 gap-2">
              <Card 
                className={`cursor-pointer ${paymentMethod === 'money' ? 'border-blue-500 bg-blue-50' : ''}`}
                onClick={() => handlePaymentMethodChange('money')}
              >
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <Banknote className={`h-6 w-6 mb-1 ${paymentMethod === 'money' ? 'text-blue-500' : 'text-gray-500'}`} />
                  <span className="text-sm">Dinheiro</span>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer ${paymentMethod === 'credit_card' ? 'border-blue-500 bg-blue-50' : ''}`}
                onClick={() => handlePaymentMethodChange('credit_card')}
              >
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <CreditCard className={`h-6 w-6 mb-1 ${paymentMethod === 'credit_card' ? 'text-blue-500' : 'text-gray-500'}`} />
                  <span className="text-sm">Crédito</span>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer ${paymentMethod === 'debit_card' ? 'border-blue-500 bg-blue-50' : ''}`}
                onClick={() => handlePaymentMethodChange('debit_card')}
              >
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <CreditCard className={`h-6 w-6 mb-1 ${paymentMethod === 'debit_card' ? 'text-blue-500' : 'text-gray-500'}`} />
                  <span className="text-sm">Débito</span>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer ${paymentMethod === 'pix' ? 'border-blue-500 bg-blue-50' : ''}`}
                onClick={() => handlePaymentMethodChange('pix')}
              >
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <QrCode className={`h-6 w-6 mb-1 ${paymentMethod === 'pix' ? 'text-blue-500' : 'text-gray-500'}`} />
                  <span className="text-sm">PIX</span>
                </CardContent>
              </Card>
            </div>
          </div>

          {paymentMethod === 'money' && (
            <div className="space-y-2">
              <Label htmlFor="received">Valor recebido</Label>
              <Input
                id="received"
                type="number"
                min={total}
                step="0.01"
                value={receivedAmount}
                onChange={handleReceivedAmountChange}
                placeholder="0,00"
              />
              {parseFloat(receivedAmount) > total && (
                <div className="p-2 bg-green-50 text-green-700 rounded flex items-center">
                  <Receipt className="h-4 w-4 mr-2" />
                  <span>Troco: {changeAmount.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}</span>
                </div>
              )}
            </div>
          )}

          {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="card-number">Número do cartão</Label>
                <Input
                  id="card-number"
                  name="number"
                  value={cardInfo.number}
                  onChange={handleCardInfoChange}
                  placeholder="0000 0000 0000 0000"
                />
              </div>
              <div>
                <Label htmlFor="card-holder">Nome do titular</Label>
                <Input
                  id="card-holder"
                  name="holder"
                  value={cardInfo.holder}
                  onChange={handleCardInfoChange}
                  placeholder="NOME COMO ESTÁ NO CARTÃO"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="card-expiry">Validade</Label>
                  <Input
                    id="card-expiry"
                    name="expiry"
                    value={cardInfo.expiry}
                    onChange={handleCardInfoChange}
                    placeholder="MM/AA"
                  />
                </div>
                <div>
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input
                    id="card-cvv"
                    name="cvv"
                    value={cardInfo.cvv}
                    onChange={handleCardInfoChange}
                    placeholder="123"
                  />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'pix' && (
            <div className="p-4 bg-gray-50 rounded-lg flex flex-col items-center">
              <QrCode className="h-24 w-24 text-blue-500 mb-2" />
              <p className="text-center text-sm">
                Use o app do seu banco para escanear o QR code e efetuar o pagamento
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing || !customer}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Finalizar Venda
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}