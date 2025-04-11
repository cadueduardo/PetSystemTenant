import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { User, Lock, ArrowRight, LogIn } from "lucide-react"; // Usar LogIn ou outro ícone
import { Loader2 } from "lucide-react";

const auth = getAuth();

export default function TenantLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTenantLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Definir persistência para local (mantém logado após fechar navegador)
      await setPersistence(auth, browserLocalPersistence);

      // Tentar fazer login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Obter o resultado do token para ler os claims
      const idTokenResult = await user.getIdTokenResult(true); // Force refresh

      const tenantId = idTokenResult.claims.tenant_id; // Pega o tenant_id do claim

      console.log("Login de Tenant bem-sucedido:", user.uid, "Tenant ID:", tenantId);

      if (!tenantId) {
        console.error("Erro crítico: Usuário logado não possui tenant_id nos claims.");
        await auth.signOut(); // Desloga o usuário se não tiver o claim
        throw new Error("Conta de usuário não configurada corretamente para acesso à loja.");
      }

      // Armazenar tenant_id no localStorage (ou usar estado global)
      localStorage.setItem('current_tenant', tenantId); 
      // Ajustei para 'current_tenant' que parece ser o padrão usado em outras partes
      // Limpar tenant_id antigo se houver?
      // localStorage.removeItem('current_tenant_id'); 

      toast({ title: "Login bem-sucedido" });
      
      // Redirect to the main tenant dashboard
      navigate('/tenant/dashboard');

    } catch (error) {
      console.error("Erro no login do tenant:", error);
      let errorMessage = "Verifique suas credenciais e tente novamente.";
      // @ts-ignore
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Email ou senha inválidos.";
      // @ts-ignore
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Formato de email inválido.";
      // @ts-ignore
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Muitas tentativas de login. Tente novamente mais tarde.";
      // @ts-ignore
      } else if (error.message && error.message.includes("Conta de usuário não configurada")) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro no login",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <LogIn className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Login da Loja</CardTitle>
          <CardDescription>
            Acesse o painel de gerenciamento da sua loja
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                disabled={isSubmitting}
                className="mt-4 w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        {/* Pode adicionar um link para "Esqueci minha senha" aqui depois */}
      </Card>
    </div>
  );
} 