
import React, { useState } from "react";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import {
  Shield,
  Lock,
  Smartphone,
  Key,
  Clock,
  AlertTriangle,
  Loader2,
  QrCode
} from "lucide-react";

export default function SecuritySettings({ user }) {
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.two_factor_enabled || false);
  const [isLoading, setIsLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const enable2FA = async () => {
    setIsLoading(true);
    try {
      setShowQRCode(true);
      toast({
        title: "Configuração de 2FA iniciada",
        description: "Siga as instruções para ativar a autenticação de dois fatores"
      });
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      toast({
        title: "Erro ao ativar 2FA",
        description: "Não foi possível iniciar a configuração de 2FA",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FACode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Por favor, insira um código de 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      setIs2FAEnabled(true);
      setShowQRCode(false);
      setVerificationCode("");
      
      toast({
        title: "2FA ativado com sucesso",
        description: "A autenticação de dois fatores foi habilitada para sua conta"
      });
    } catch (error) {
      console.error("Error verifying 2FA code:", error);
      toast({
        title: "Erro na verificação",
        description: "Código inválido ou expirado",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disable2FA = async () => {
    setIsLoading(true);
    try {
      setIs2FAEnabled(false);
      
      toast({
        title: "2FA desativado",
        description: "A autenticação de dois fatores foi desabilitada"
      });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      toast({
        title: "Erro ao desativar 2FA",
        description: "Não foi possível desativar a autenticação de dois fatores",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Segurança
          </CardTitle>
          <CardDescription>
            Configure a segurança da sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Autenticação de Dois Fatores</Label>
                <p className="text-sm text-gray-500">
                  Adicione uma camada extra de segurança à sua conta
                </p>
              </div>
              <Switch
                checked={is2FAEnabled}
                onCheckedChange={is2FAEnabled ? disable2FA : enable2FA}
                disabled={isLoading || showQRCode}
              />
            </div>

            {showQRCode && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Configure seu Autenticador</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      1. Abra seu aplicativo de autenticação<br />
                      2. Escaneie o QR Code abaixo<br />
                      3. Digite o código gerado para confirmar
                    </p>
                  </div>
                </div>

                <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
                  <QrCode className="w-32 h-32 text-gray-800" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Código de Verificação</Label>
                  <div className="flex gap-2">
                    <Input
                      id="verification-code"
                      placeholder="000000"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <Button 
                      onClick={verify2FACode}
                      disabled={isLoading || verificationCode.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        "Verificar"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {is2FAEnabled && (
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                <Lock className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800">2FA está ativo</h4>
                  <p className="text-sm text-green-700">
                    Sua conta está protegida com autenticação de dois fatores
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Histórico de Sessões
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <Key className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-blue-800">Sessão Atual</h4>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Ativa
                    </Badge>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Chrome em Windows • São Paulo, Brasil
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Key className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">iPhone • iOS 15</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Último acesso: há 2 dias • São Paulo, Brasil
                  </p>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Ver Todas as Sessões
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-500" />
              Recomendações de Segurança
            </h3>

            <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Aumente sua segurança</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Recomendamos ativar a autenticação de dois fatores para maior proteção
                  da sua conta.
                </p>
                {!is2FAEnabled && (
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={enable2FA}
                    disabled={isLoading}
                  >
                    Ativar 2FA
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
