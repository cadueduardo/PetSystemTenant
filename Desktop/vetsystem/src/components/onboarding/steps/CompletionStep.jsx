import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { TenantUser } from "@/api/entities";
import { Customization } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { SendEmail } from "@/api/integrations";
import { SendSMS } from "@/api/integrations";
import { SupportTicket } from "@/api/entities"; 
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  Users,
  Building,
  Lock,
  Loader2,
  ArrowRight,
  ArrowLeft
} from "lucide-react";

export default function CompletionStep({ tenant, onComplete, onBack }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({
    customization: null,
    users: [],
    permissionGroups: {
      admin: 0,
      manager: 0,
      veterinarian: 0,
      receptionist: 0,
      groomer: 0,
      accountant: 0,
      staff: 0
    }
  });

  useEffect(() => {
    loadSummaryData();
  }, []);

  const loadSummaryData = async () => {
    try {
      const customizations = await Customization.filter({ tenant_id: tenant.id });
      const users = await TenantUser.filter({ tenant_id: tenant.id });
      
      const permissionGroups = {
        admin: 0,
        manager: 0,
        veterinarian: 0,
        receptionist: 0,
        groomer: 0,
        accountant: 0,
        staff: 0
      };
      
      users.forEach(user => {
        if (permissionGroups.hasOwnProperty(user.role)) {
          permissionGroups[user.role]++;
        }
      });
      
      setSummary({
        customization: customizations[0] || null,
        users,
        permissionGroups
      });
      
    } catch (error) {
      console.error("Erro ao carregar dados do resumo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o resumo das configurações.",
        variant: "destructive"
      });
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: "Administrador",
      manager: "Gerente",
      veterinarian: "Veterinário",
      receptionist: "Recepcionista",
      groomer: "Tosador/Banhista",
      accountant: "Financeiro",
      staff: "Funcionário"
    };
    
    return labels[role] || role;
  };

  const handleFinish = async () => {
    setIsLoading(true);
    
    try {
      await Tenant.update(tenant.id, {
        setup_status: "completed"
      });
      
      const users = summary.users;
      
      for (const user of users) {
        try {
          await SendEmail({
            to: user.email,
            subject: `Bem-vindo ao ${tenant.company_name} - Acesso ao Sistema`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a56db;">Olá ${user.full_name},</h2>
                
                <p>Seja bem-vindo ao sistema da <strong>${tenant.company_name}</strong>! Você foi cadastrado como <strong>${getRoleLabel(user.role)}</strong>.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1a56db; margin-top: 0;">📱 Acesso ao Sistema</h3>
                  <p><strong>Link de Acesso:</strong><br>
                    <a href="https://app.petclinic.com/${tenant.access_url}" style="color: #2563eb;">https://app.petclinic.com/${tenant.access_url}</a>
                  </p>
                  <p><strong>Seu usuário:</strong> ${user.email}</p>
                </div>

                <div style="margin: 20px 0;">
                  <h3 style="color: #1a56db;">🚀 Primeiros Passos</h3>
                  <ul style="padding-left: 20px;">
                    <li>Acesse o sistema com seu email</li>
                    <li>Complete seu perfil</li>
                    <li>Explore as funcionalidades disponíveis</li>
                    <li>Verifique suas permissões de acesso</li>
                  </ul>
                </div>

                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1a56db; margin-top: 0;">💬 Suporte</h3>
                  <p>Precisa de ajuda? Nossa equipe está à disposição:</p>
                  <ul style="padding-left: 20px;">
                    <li>Email: suporte@petclinic.com</li>
                    <li>WhatsApp: (11) 99999-9999</li>
                    <li>Horário: Segunda a Sexta, 8h às 18h</li>
                  </ul>
                </div>

                <p>Estamos felizes em ter você conosco!</p>
                <p>Atenciosamente,<br>Equipe PetClinic</p>
              </div>
            `
          });

          await SendSMS({
            to: user.phone,
            body: `Olá ${user.full_name}! Bem-vindo ao sistema da ${tenant.company_name}. Acesse: https://app.petclinic.com/${tenant.access_url}. Dúvidas? WhatsApp: (11) 99999-9999`
          });

        } catch (notificationError) {
          console.error("Erro ao enviar notificação:", notificationError);
        }
      }

      await SupportTicket.create({
        title: "Boas-vindas - Nova Clínica Ativada",
        description: `Nova clínica ativada: ${tenant.company_name}\nTotal de usuários: ${users.length}\nMódulos ativos: ${tenant.selected_modules.join(", ")}`,
        priority: "high",
        category: "onboarding",
        status: "open",
        created_by_email: users.find(u => u.role === "admin")?.email || users[0].email,
        tenant_id: tenant.id
      });
      
      handleSendWelcomeEmail();
      handleSendSMS();
      
      onComplete();
      
      toast({
        title: "Configuração concluída!",
        description: "Sua clínica foi ativada com sucesso. Enviamos as instruções de acesso para todos os usuários.",
      });
      
      navigate(createPageUrl("Dashboard"));
      
    } catch (error) {
      console.error("Erro ao finalizar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível concluir a configuração. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendWelcomeEmail = async () => {
    try {
      const userData = await User.me();
      
      if (!userData || !userData.email) {
        console.error("Dados do usuário não encontrados ou sem email");
        return;
      }

      await SendEmail({
        to: userData.email,
        subject: "Bem-vindo ao PetClinic - Seu sistema está pronto!",
        body: `
          <h1>Parabéns, ${userData.full_name || ""}!</h1>
          <p>Seu sistema PetClinic foi configurado com sucesso e está pronto para uso.</p>
          <p>Aqui estão alguns recursos para você começar:</p>
          <ul>
            <li>Adicione seus clientes e seus pets</li>
            <li>Configure sua agenda de atendimentos</li>
            <li>Explore o catálogo de produtos e serviços</li>
          </ul>
          <p>Se precisar de ajuda, entre em contato com nosso suporte.</p>
        `
      });

      toast({
        title: "Email enviado!",
        description: "Um email de boas-vindas foi enviado para você."
      });
    } catch (error) {
      console.error("Erro ao enviar email:", error);
    }
  };

  const handleSendSMS = async () => {
    try {
      const userData = await User.me();
      const tenantData = await Tenant.filter({ status: "active" });
      
      if (!userData || !tenantData || tenantData.length === 0 || !tenantData[0].phone) {
        console.error("Dados insuficientes para enviar SMS");
        return;
      }
      
      const phoneNumber = tenantData[0].phone.replace(/\D/g, "");
      if (!phoneNumber || phoneNumber.length < 10) {
        console.error("Número de telefone inválido");
        return;
      }

      await SendSMS({
        to: phoneNumber,
        body: `Olá ${userData.full_name || ""}! Seu sistema PetClinic está configurado e pronto para uso. Acesse agora para começar a gerenciar sua clínica.`
      });

      toast({
        title: "SMS enviado!",
        description: "Uma mensagem de boas-vindas foi enviada para seu celular."
      });
    } catch (error) {
      console.error("Erro ao enviar SMS:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Resumo da Configuração</h2>
        <p className="text-gray-600">
          Revise as configurações antes de finalizar a ativação da sua clínica.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Building className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Informações da Clínica</h3>
                <p className="text-sm text-gray-500">{tenant.company_name}</p>
              </div>
            </div>
            {summary.customization && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Cores da Marca</p>
                  <div className="flex gap-2 mt-1">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: summary.customization.primary_color }}></div>
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: summary.customization.secondary_color }}></div>
                  </div>
                </div>
                {summary.customization.company_logo_url && (
                  <div>
                    <p className="text-sm font-medium">Logo</p>
                    <div className="mt-1">
                      <img src={summary.customization.company_logo_url} alt="Logo" className="h-8 object-contain" />
                    </div>
                </div>
              )}
            </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Equipe</h3>
                <p className="text-sm text-gray-500">{summary.users.length} usuários cadastrados</p>
              </div>
                      </div>
            <div className="mt-4 space-y-3">
              {Object.entries(summary.permissionGroups).map(([role, count]) => count > 0 && (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm">{getRoleLabel(role)}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Lock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Módulos Ativos</h3>
                <p className="text-sm text-gray-500">{tenant.selected_modules?.length || 0} módulos selecionados</p>
              </div>
            </div>
            {tenant.selected_modules && tenant.selected_modules.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tenant.selected_modules.map((module) => (
                  <div key={module} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                    {module}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between pt-6">
        <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={handleFinish} disabled={isLoading} className="flex items-center gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finalizando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Finalizar Configuração
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

