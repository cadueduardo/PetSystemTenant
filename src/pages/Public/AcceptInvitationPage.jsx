import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const functions = getFunctions();

  const [token, setToken] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Efeito para pegar o token da URL na montagem
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      console.log('[AcceptInvitationPage] Token found in URL:', urlToken);
    } else {
      console.error('[AcceptInvitationPage] Token not found in URL.');
      setError("Token de convite inválido ou ausente na URL.");
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token) {
      setError("Token de convite inválido ou ausente.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Por favor, preencha a nova senha e a confirmação.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    setLoading(true);

    try {
      console.log('[AcceptInvitationPage] Calling completeInvitation function...');
      // Definir a função callable para a PRÓXIMA função que criaremos
      const completeInvitationFunction = httpsCallable(functions, 'completeInvitation');
      const result = await completeInvitationFunction({ token: token, password: password });

      console.log('[AcceptInvitationPage] completeInvitation function success:', result.data);
      setSuccessMessage(result.data.message || "Convite aceito e senha definida com sucesso! Você já pode fazer login.");
      setPassword('');
      setConfirmPassword('');
      toast({ title: "Sucesso!", description: result.data.message || "Conta ativada com sucesso!" });
      // Opcional: redirecionar para login após um tempo ou deixar um link
      // setTimeout(() => navigate('/login'), 5000);

    } catch (err) {
      console.error('[AcceptInvitationPage] Error calling completeInvitation function:', err);
      const defaultError = "Ocorreu um erro ao tentar aceitar o convite. Verifique se o token é válido ou tente novamente.";
      // Tenta extrair a mensagem de erro específica do HttpsError
      const detailedMessage = err?.details?.message || err.message;
      setError(detailedMessage || defaultError);
      toast({ variant: "destructive", title: "Erro", description: detailedMessage || defaultError });
    } finally {
      setLoading(false);
    }
  };

  // Renderização enquanto verifica o token ou se houver erro inicial
  if (error && !token && !successMessage) { // Apenas mostra erro inicial se não deu sucesso ainda
    return (
      <div className="container mx-auto p-4 flex justify-center mt-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Erro no Convite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              {error}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Verifique o link no seu e-mail ou entre em contato com o administrador.
            </p>
          </CardContent>
           <CardFooter>
                <Link to="/login">
                    <Button variant="outline">Voltar para Login</Button>
                </Link>
            </CardFooter>
        </Card>
      </div>
    );
  }

  // Renderização principal do formulário
  return (
    <div className="container mx-auto p-4 flex justify-center mt-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar Convite e Definir Senha</CardTitle>
          <CardDescription>
            Crie uma senha segura para acessar o sistema PetFácil.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Exibe mensagem de sucesso */}
            {successMessage && (
              <div className="text-green-600 flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="mr-2 h-5 w-5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">{successMessage}</p>
                    <Link to="/login" className="text-sm text-primary hover:underline mt-1 block">Clique aqui para fazer login</Link>
                </div>
              </div>
            )}

            {/* Exibe mensagem de erro da submissão */}
            {error && !successMessage && (
               <div className="text-red-600 flex items-center p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
                 <p>{error}</p>
               </div>
            )}

            {/* Inputs de senha (não mostra se já deu sucesso) */}
            {!successMessage && token && ( // Mostra inputs apenas se tiver token e não tiver sucesso
              <>
                <div>
                  <Label htmlFor="password">Nova Senha</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </>
            )}
             {/* Mostra loading ou mensagem inicial se token ainda não carregou */}
             {!token && !error && !successMessage && (
                 <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2">Verificando token...</p>
                 </div>
             )}
          </CardContent>
          {/* Footer com botão (não mostra se já deu sucesso) */}
          {!successMessage && token && ( // Mostra botão apenas se tiver token e não tiver sucesso
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Definir Senha e Ativar Conta
              </Button>
            </CardFooter>
          )}
           {/* Footer alternativo se deu erro no token inicial */}
            {error && !token && !successMessage && (
                 <CardFooter>
                    <Link to="/login">
                        <Button variant="outline">Voltar para Login</Button>
                    </Link>
                </CardFooter>
            )}
        </form>
      </Card>
    </div>
  );
}

export default AcceptInvitationPage;