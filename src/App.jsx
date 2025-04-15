// import React from 'react'; // << REMOVER IMPORT NÃO USADO
// import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './App.css'
import { Toaster } from "./components/ui/toaster"
// import { TenantProvider } from "./components/tenant/TenantContext" // << REMOVER IMPORT NÃO USADO
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "./context/AuthContext"

// <<< IMPORTAR O COMPONENTE QUE CONTÉM AS ROTAS >>>
import PagesContent from './pages/index'; // Assumindo que vem daqui

function App() {
  // <<< ESTRUTURA SIMPLES COM PROVIDERS E PagesContent >>>
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthProvider>
        {/* TenantProvider pode estar aqui ou dentro de rotas específicas */}
        {/* Se TenantProvider envolve SÓ as rotas de tenant, ele deve sair daqui */}
        {/* Se ele envolve TUDO após o login, pode ficar aqui */} 
        {/* Vamos assumir que ele só envolve rotas de tenant e removê-lo daqui por enquanto */}
        {/* <TenantProvider> */} 
          <PagesContent /> {/* <<< RENDERIZA O COMPONENTE COM AS ROTAS >>> */}
          <Toaster />
        {/* </TenantProvider> */} 
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 