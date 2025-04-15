import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, sendPasswordResetEmail, confirmPasswordReset } from "firebase/auth"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { User, Lock, LogIn, Key, CheckCircle } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";

const authFirebase = getAuth();

export default function TenantLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const [mode, setMode] = useState('login');
  const [oobCode, setOobCode] = useState(null);

  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  useEffect(() => {
    console.log('TenantLogin mode useEffect running. Current location.search:', location.search);
    const params = new URLSearchParams(location.search);
    const urlMode = params.get('mode');
    const code = params.get('oobCode');
    if (urlMode === 'resetPassword' && code) {
      console.log('Modo Redefinir Senha detectado com código:', code);
      setMode('resetPassword');
      setOobCode(code);
    } else {
      setMode('login');
    }
  }, [location.search]);

  useEffect(() => {
    if (!auth.loadingAuth && auth.currentUser && auth.userClaims?.tenant_id) {
      const from = location.state?.from?.pathname || "/tenant/dashboard";
      console.log(`[TenantLogin useEffect] Attempting to navigate. From: ${from}`, location.state);
      navigate(from, { replace: true });
    }
  }, [auth.loadingAuth, auth.currentUser, auth.userClaims, navigate, location.state]);

  const handleTenantLogin = async (e) => {
    e.preventDefault();
    setIsSubmittingLogin(true);
    setResetSuccessMessage("");

    try {
      await setPersistence(authFirebase, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(authFirebase, email, password);
      const user = userCredential.user;

      await user.getIdTokenResult(true);

      console.log("Login de Tenant bem-sucedido (processo iniciado):", user.uid);
      toast({ title: "Login bem-sucedido" });

    } catch (error) {
      console.error("Erro no login do tenant:", error);
      let errorMessage = "Verifique suas credenciais e tente novamente.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Email ou senha inválidos.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Formato de email inválido.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Muitas tentativas de login. Tente novamente mais tarde.";
      } else if (error.message && error.message.includes("Conta de usuário não configurada")) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro no login",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotPasswordEmail.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Por favor, insira seu email." });
      return;
    }
    setIsSendingResetLink(true);
    try {
      await sendPasswordResetEmail(authFirebase, forgotPasswordEmail.trim());
      toast({ title: "Link Enviado", description: "Verifique seu email para o link de redefinição de senha." });
      setForgotPasswordModalOpen(false);
      setForgotPasswordEmail("");
    } catch (error) {
      console.error("Erro ao enviar link de redefinição:", error);
      let errorMessage = "Falha ao enviar o link. Tente novamente.";
      if (error.code === 'auth/invalid-email') { errorMessage = "Email inválido."; }
      if (error.code === 'auth/user-not-found') { errorMessage = "Nenhuma conta encontrada com este email."; }
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
    } finally {
      setIsSendingResetLink(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmNewPassword) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha ambos os campos de senha." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem." });
      return;
    }
    if (!oobCode) {
      toast({ variant: "destructive", title: "Erro", description: "Código de redefinição inválido ou ausente." });
      setMode('login');
      return;
    }

    setIsResettingPassword(true);
    try {
      await confirmPasswordReset(authFirebase, oobCode, newPassword);
      setResetSuccessMessage("Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.");
      setMode('login');
      setOobCode(null);
      setNewPassword("");
      setConfirmNewPassword("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      let errorMessage = "Falha ao redefinir a senha.";
      if (error.code === 'auth/expired-action-code') { errorMessage = "O link expirou. Solicite um novo link de redefinição."; }
      else if (error.code === 'auth/invalid-action-code') { errorMessage = "Link inválido ou já utilizado."; }
      else if (error.code === 'auth/user-disabled') { errorMessage = "Esta conta foi desativada."; }
      else if (error.code === 'auth/weak-password') { errorMessage = "A senha deve ter pelo menos 6 caracteres."; }
      toast({ variant: "destructive", title: "Erro", description: errorMessage });
      if (error.code === 'auth/expired-action-code' || error.code === 'auth/invalid-action-code') {
        setMode('login');
        setOobCode(null);
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  console.log('TenantLogin rendering with mode:', mode);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {mode === 'login' && <LogIn className="h-10 w-10 text-primary" />}
            {mode === 'resetPassword' && <Key className="h-10 w-10 text-primary" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {mode === 'login' && 'Login da Loja'}
            {mode === 'resetPassword' && 'Definir Nova Senha'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' && 'Acesse o painel de gerenciamento da sua loja'}
            {mode === 'resetPassword' && 'Crie uma nova senha segura para sua conta.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetSuccessMessage && mode === 'login' && (
            <Alert variant="success" className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso!</AlertTitle>
              <AlertDescription>
                {resetSuccessMessage}
              </AlertDescription>
            </Alert>
          )}

          {mode === 'login' && (
            <form onSubmit={handleTenantLogin}>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seuemail@sua-loja.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmittingLogin}
                  className="mt-2 w-full"
                >
                  {isSubmittingLogin ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
                  ) : (
                    <><LogIn className="mr-2 h-4 w-4" /> Entrar</>
                  )}
                </Button>

                <div className="text-center text-sm mt-2">
                  <Dialog open={forgotPasswordModalOpen} onOpenChange={setForgotPasswordModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" type="button" className="p-0 h-auto font-normal">
                        Esqueceu a senha?
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Redefinir Senha</DialogTitle>
                        <DialogDescription>
                          Digite seu email abaixo. Enviaremos um link para você redefinir sua senha.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="forgot-email" className="text-right">
                            Email
                          </Label>
                          <Input 
                            id="forgot-email" 
                            type="email" 
                            value={forgotPasswordEmail} 
                            onChange={(e) => setForgotPasswordEmail(e.target.value)}
                            className="col-span-3" 
                            placeholder="seuemail@sua-loja.com" 
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          type="button" 
                          onClick={handleForgotPasswordSubmit} 
                          disabled={isSendingResetLink}
                        >
                          {isSendingResetLink ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                          ) : (
                            <>Enviar Link de Redefinição</>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </form>
          )}

          {mode === 'resetPassword' && (
            <form onSubmit={handleResetPasswordSubmit}>
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
                  disabled={isResettingPassword}
                  className="mt-4 w-full"
                >
                  {isResettingPassword ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redefinindo...</>
                  ) : (
                    <><Key className="mr-2 h-4 w-4" /> Definir Nova Senha</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 