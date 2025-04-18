import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// <<< CORRIGIR CAMINHO DO IMPORT DA CONFIG >>>
import './lib/firebaseConfig'; // << CORRIGIDO

import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { TenantProvider } from './components/tenant/TenantContext'
// import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
// <<< IMPORTS CSS FULLCALENDAR (Comentados Novamente) >>>
// import '@fullcalendar/daygrid/main.css'; 
// import '@fullcalendar/timegrid/main.css'; 
// <<< FIM IMPORTS CSS >>>

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <App />
          <Toaster />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
) 