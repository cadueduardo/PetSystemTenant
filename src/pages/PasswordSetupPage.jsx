import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth, confirmPasswordReset, signInWithCustomToken, updatePassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Lock, Key, CheckCircle } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const auth = getAuth();

export default function PasswordSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Log IMEDIATAMENTE ao renderizar, ANTES do useEffect
  console.log('>>> PasswordSetupPage rendering. Location object:', location);

  const [token, setToken] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [oobCode, setOobCode] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    console.log('PasswordSetupPage useEffect running. Location.search:', location.search);
    const params = new URLSearchParams(location.search);
    
    // Verificar se temos um código oobCode (fluxo padrão do Firebase)
    const code = params.get('oobCode');
    
    // OU verificar se temos um token personalizado (nosso fluxo customizado)
    const customToken = params.get('token');
    const email = params.get('email');
    
    if (code) {
      // Fluxo tradicional com oobCode
      setOobCode(code);
      console.log('PasswordSetupPage: oobCode found:', code);
    } 
    else if (customToken && email) {
      // Novo fluxo com token customizado
      setToken(customToken);
      setUserEmail(email);
      console.log('PasswordSetupPage: Custom token flow detected for email:', email);
    }
    else {
      console.error('PasswordSetupPage: Nem oobCode nem token personalizado foram encontrados na URL.');
      setError("Código de configuração inválido ou ausente. Por favor, use o link recebido no email.");
    }
  }, [location.search, navigate]);

  const handlePasswordSetupSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Limpa erros anteriores

    if (!newPassword || !confirmNewPassword) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha ambos os campos de senha." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem." });
      return;
    }
    if (!oobCode && !token) {
      toast({ variant: "destructive", title: "Erro", description: "Código de configuração inválido ou ausente." });
      return;
    }

    setIsSettingPassword(true);
    try {
      if (oobCode) {
        // Fluxo padrão com oobCode
        await confirmPasswordReset(auth, oobCode, newPassword);
        console.log('PasswordSetupPage: Senha definida com sucesso via confirmPasswordReset!');
      } 
      else if (token && userEmail) {
        // Fluxo personalizado com token
        try {
          // 1. Fazer login com o token customizado
          const userCredential = await signInWithCustomToken(auth, token);
          console.log('PasswordSetupPage: Login com token customizado bem-sucedido');
          
          // 2. Atualizar a senha do usuário autenticado
          await updatePassword(userCredential.user, newPassword);
          console.log('PasswordSetupPage: Senha atualizada com sucesso via updatePassword!');
          
          // 3. Fazer logout (opcional, mas recomendado)
          await signOut(auth);
        } catch (tokenError) {
          console.error("Erro no fluxo de token customizado:", tokenError);
          
          // Fallback para o fluxo de reset de senha padrão se o token falhar
          console.log("Tentando fallback para fluxo de reset padrão");
          await sendPasswordResetEmail(auth, userEmail, { handleCodeInApp: true, url: window.location.origin + "/login" });
          throw new Error(`Não foi possível configurar a senha com o token fornecido. Um email de redefinição de senha foi enviado para ${userEmail}.`);
        }
      }
      
      setSuccess(true);
      // Limpar campos
      setNewPassword("");
      setConfirmNewPassword("");
      // Redirecionar para login após um tempo
      setTimeout(() => navigate('/login', { state: { passwordResetSuccess: true } }), 3000);

    } catch (error) {
      console.error("Erro ao definir senha:", error);
      let errorMessage = error.message || "Falha ao definir a senha.";
      
      if (error.code === 'auth/expired-action-code') { errorMessage = "O link expirou. Solicite um novo convite ou redefinição de senha."; }
      else if (error.code === 'auth/invalid-action-code') { errorMessage = "Link inválido ou já utilizado."; }
      else if (error.code === 'auth/user-disabled') { errorMessage = "Esta conta foi desativada."; }
      else if (error.code === 'auth/weak-password') { errorMessage = "A senha deve ter pelo menos 6 caracteres."; }
      
      setError(errorMessage);
      toast({ variant: "destructive", title: "Erro ao Definir Senha", description: errorMessage });
    } finally {
      setIsSettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Key className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Configurar Sua Senha</CardTitle>
          <CardDescription>
            Crie uma senha segura para acessar a plataforma PetFácil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              {/* <AlertCircle className="h-4 w-4" /> */}
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso!</AlertTitle>
              <AlertDescription>
                Senha definida com sucesso! Você será redirecionado para a página de login.
              </AlertDescription>
            </Alert>
          )}

          {!success && (oobCode || token) && (
            <form onSubmit={handlePasswordSetupSubmit}>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isSettingPassword || (!oobCode && !token)}
                  className="mt-4 w-full"
                >
                  {isSettingPassword ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Definindo...</>
                  ) : (
                    <><Key className="mr-2 h-4 w-4" /> Definir Senha e Entrar</>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Mensagem se o código não for encontrado */}
          {!oobCode && !token && !error && (
            <div className="text-center text-gray-600"><Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> Verificando link...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
