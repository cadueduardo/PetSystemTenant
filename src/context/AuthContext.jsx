import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react'; // Para indicador de loading

const AuthContext = createContext(null);
const auth = getAuth();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userClaims, setUserClaims] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Começa carregando

  useEffect(() => {
    console.log('[AuthProvider] Setting up onAuthStateChanged listener...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthProvider] onAuthStateChanged triggered. User:', user ? user.uid : 'null');
      if (user) {
        try {
          // Forçar atualização do token para pegar claims mais recentes
          const idTokenResult = await user.getIdTokenResult(true);
          console.log('[AuthProvider] Fetched ID token result. Claims:', idTokenResult.claims);
          setCurrentUser(user);
          setUserClaims(idTokenResult.claims);
        } catch (error) {
          console.error("[AuthProvider] Error fetching token result:", error);
          setCurrentUser(null);
          setUserClaims(null);
          // Considerar deslogar ou mostrar erro se a obtenção do token falhar
          // await auth.signOut();
        }
      } else {
        setCurrentUser(null);
        setUserClaims(null);
      }
      setLoadingAuth(false); // Marcar como concluído após processar
    });

    // Cleanup subscription on unmount
    return () => {
      console.log('[AuthProvider] Cleaning up onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []); // Executar apenas uma vez na montagem

  // Memoizar o valor do contexto para otimização
  const contextValue = useMemo(() => ({
    currentUser,
    userClaims,
    loadingAuth,
    // Adicionar funções aqui se necessário (ex: logout)
  }), [currentUser, userClaims, loadingAuth]);

  // Indicador de loading global enquanto o estado de auth inicializa
  if (loadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando autenticação...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personalizado para usar o contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}