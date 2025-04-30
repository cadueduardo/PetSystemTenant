import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseConfig";
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
import { toast } from "@/components/ui/use-toast";
import { 
  CreditCard, 
  Banknote, 
  QrCode, 
  Loader2, 
  Check
} from "lucide-react";
import PropTypes from 'prop-types';

export default function PaymentDialog({ open, onOpenChange, cart, customer = null, chargeIds = [], continuedOsIds = [], totalAmount, onSuccess, isAnonymousSale = false }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [changeAmount, setChangeAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [cardInfo, setCardInfo] = useState({
    number: "",
    holder: "",
    expiry: "",
    cvv: ""
  });

  const total = totalAmount || 0;

  useEffect(() => {
    if (open) {
      setPaymentMethod("pix");
      setReceivedAmount("");
      setChangeAmount(0);
      setCardInfo({ number: "", holder: "", expiry: "", cvv: "" });
      setIsProcessing(false);
    } else {
       // Reset pode ser feito ao fechar também, se preferir
       // setPaymentMethod("pix"); ...
    }
  }, [open, total]);

  const calculateChange = (receivedValue) => {
    const received = parseFloat(receivedValue) || 0;
    return received > total ? received - total : 0;
  };

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    setReceivedAmount(""); 
    setChangeAmount(0);
    setCardInfo({ number: "", holder: "", expiry: "", cvv: "" });
  };

  const handleReceivedAmountChange = (e) => {
    const value = e.target.value;
    setReceivedAmount(value);
    setChangeAmount(calculateChange(value));
  };

  const handleCardInfoChange = (e) => {
    const { name, value } = e.target;
    setCardInfo({
      ...cardInfo,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    if (!customer && !isAnonymousSale) {
      toast({
        title: "Cliente obrigatório",
        description: "Selecione um cliente para continuar (ou certifique-se que é uma venda anônima).",
        variant: "destructive"
      });
      return;
    }

    const hasCharges = chargeIds && chargeIds.length > 0;
    if (!hasCharges && total <= 0 && cart.length > 0) {
      toast({
        title: "Valor inválido",
        description: "O total do carrinho não pode ser zero para venda direta.",
        variant: "destructive"
      });
      return;
    }

    if (paymentMethod === "cash" && parseFloat(receivedAmount || "0") < total) {
      toast({
        title: "Valor insuficiente",
        description: "O valor recebido em dinheiro é menor que o total.",
        variant: "destructive"
      });
      return;
    }

    if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && 
        (!cardInfo.number || !cardInfo.holder || !cardInfo.expiry || !cardInfo.cvv)) {
      toast({
        title: "Dados do cartão incompletos",
        description: "Preencha todos os dados do cartão.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    const paymentPayload = {
        chargeIds: chargeIds && chargeIds.length > 0 ? chargeIds : null,
        continuedOsIds: continuedOsIds && continuedOsIds.length > 0 ? continuedOsIds : null,
        cartItems: (chargeIds?.length === 0 && continuedOsIds?.length === 0) ? cart.map(item => ({
            itemId: item.id,
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice || item.price,
            totalPrice: item.totalPrice || (item.price * item.quantity),
            itemType: item.type === 'service' ? 'service' : 'product'
        })) : null,
        paymentMethod: paymentMethod, 
        amountPaid: total,
        customerId: customer ? customer.id : null,
        cardInfo: (paymentMethod === "credit_card" || paymentMethod === "debit_card") ? cardInfo : null,
    };

    console.log("[PaymentDialog] Chamando função 'processPayment' com payload:", paymentPayload);

    try {
      const processPaymentFunction = httpsCallable(functions, 'processPayment');
      const result = await processPaymentFunction(paymentPayload);
      
      console.log("[PaymentDialog] Resultado da função 'processPayment':", result.data);

      if (result.data && result.data.success === true) { 
          toast({
            title: "Pagamento Processado",
            description: result.data.message || "Venda finalizada com sucesso!",
          });
          onSuccess();
      } else {
          throw new Error(result.data?.message || "Falha ao processar pagamento no backend.");
      }

    } catch (error) {
      console.error("[PaymentDialog] Erro ao chamar função processPayment:", error);
      const errorMessage = error.details?.originalError || error.message || "Não foi possível processar o pagamento.";
      toast({
        title: "Erro no Pagamento",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-none">
        <DialogHeader>
          <DialogTitle>Finalizar Pagamento</DialogTitle>
        </DialogHeader>

        {/* Layout principal com grid responsivo (12 colunas em md+) */}
        <div className="grid md:grid-cols-12 gap-6">

          {/* Coluna Esquerda: Cliente e Resumo (Ocupa 8 colunas) */}
          <div className="space-y-4 md:col-span-8">
            <div>
              <h3 className="font-medium mb-2">Cliente</h3>
              <div className="p-3 bg-gray-50 rounded-lg min-h-[60px]">
                {customer ? (
                  <>
                    <p className="font-medium">{customer.full_name}</p>
                    <p className="text-sm text-gray-500">{customer.email}</p>
                  </>
                ) : isAnonymousSale ? (
                   <p className="text-sm text-orange-600">Venda Anônima (Cliente não vinculado)</p>
                ): (
                  <p className="text-red-500">Nenhum cliente selecionado</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Resumo</h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[250px] overflow-y-auto">
                  {cart.map((item, index) => (
                    <div key={`${item.type}-${item.id}-${index}`} className="p-3 flex items-center justify-between border-b last:border-b-0">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} x {(item.unitPrice || item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                      <p className="font-medium">
                        {(item.totalPrice || (item.unitPrice || item.price) * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-gray-50 font-bold flex items-center justify-between">
                  <span>Total a Pagar</span>
                  <span>
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Forma de Pagamento (Ocupa 4 colunas) */}
          <div className="space-y-4 md:col-span-4">
             <div>
                <Label>Forma de pagamento</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  <Card 
                    className={`cursor-pointer ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={() => handlePaymentMethodChange('cash')}
                  >
                    <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                      <Banknote className={`h-6 w-6 mb-1 ${paymentMethod === 'cash' ? 'text-blue-500' : 'text-gray-500'}`} />
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

              {/* --- Renderização Condicional para Pagamento em Dinheiro --- */}
              {paymentMethod === "cash" && (
                <div className="space-y-2 mt-4 border-t pt-4">
                  <div>
                    <Label htmlFor="receivedAmount">Valor Recebido</Label>
                    <Input 
                      id="receivedAmount"
                      name="receivedAmount"
                      type="number" 
                      placeholder="0,00"
                      value={receivedAmount}
                      onChange={handleReceivedAmountChange}
                      className="mt-1"
                      step="0.01"
                      min={total.toFixed(2)} // Opcional: Mínimo é o total
                    />
                  </div>
                  <div>
                    <Label>Troco</Label>
                    <p className="text-lg font-medium mt-1">
                      {changeAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
              )}
              {/* --- Fim da Renderização Condicional --- */}

              {/* --- Renderização Condicional para Pagamento com Cartão --- */}
              {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                <div className="space-y-3 mt-4 border-t pt-4">
                  <div>
                    <Label htmlFor="card-number">Número do cartão</Label>
                    <Input
                      id="card-number"
                      name="number"
                      value={cardInfo.number}
                      onChange={handleCardInfoChange}
                      placeholder="0000 0000 0000 0000"
                      className="mt-1"
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
                      className="mt-1"
                      style={{ textTransform: 'uppercase' }} // Para facilitar a digitação
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="card-expiry">Validade (MM/AA)</Label>
                      <Input
                        id="card-expiry"
                        name="expiry"
                        value={cardInfo.expiry}
                        onChange={handleCardInfoChange}
                        placeholder="MM/AA"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-cvv">CVV</Label>
                      <Input
                        id="card-cvv"
                        name="cvv"
                        type="password" // Mascarar CVV
                        value={cardInfo.cvv}
                        onChange={handleCardInfoChange}
                        placeholder="123"
                        className="mt-1"
                        maxLength={4} // CVV pode ter 3 ou 4 dígitos
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* --- Fim da Renderização Condicional --- */}

            {/* Conditional rendering for PIX payment */}
             {paymentMethod === 'pix' && (
                <div className="p-4 bg-gray-50 rounded-lg flex flex-col items-center mt-4 border-t pt-4">
                  <QrCode className="h-24 w-24 text-blue-500 mb-2" />
                  <p className="text-center text-sm">
                    Use o app do seu banco para escanear o QR code e efetuar o pagamento
                  </p>
                </div>
             )}
          </div>

        </div>

        <DialogFooter className="flex justify-between pt-6">
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
            disabled={isProcessing || 
                      (!customer && !isAnonymousSale) || 
                      (total <= 0 && !(chargeIds && chargeIds.length > 0)) || // Ajustado aqui: desabilitar se total <= 0 E não houver chargeIds
                      (paymentMethod === 'cash' && parseFloat(receivedAmount || "0") < total) ||
                      ((paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (!cardInfo.number || !cardInfo.holder || !cardInfo.expiry || !cardInfo.cvv))
                    }
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

PaymentDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  cart: PropTypes.array.isRequired,
  customer: PropTypes.object,
  chargeIds: PropTypes.arrayOf(PropTypes.string),
  continuedOsIds: PropTypes.arrayOf(PropTypes.string),
  totalAmount: PropTypes.number.isRequired,
  onSuccess: PropTypes.func.isRequired,
  isAnonymousSale: PropTypes.bool
};