// import React, { Suspense } from "react"; // Removido não usado
// import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"; // Removido não usado
import { Routes, Route } from "react-router-dom"; // Mantido apenas o necessário

import Layout from "./Layout.jsx";
import AdminLayout from "./AdminLayout.jsx";
import Landing from "./Landing"; // Descomentar a importação da Landing

// import Landing from "./Landing"; // Comentado - Não pertence ao Layout principal?

import Dashboard from "./Dashboard";

import Customers from "./Customers";

import CustomerDetails from "./CustomerDetails";

import Calendar from "./Calendar";

import PetDetails from "./PetDetails";

import OCRStatistics from "./OCRStatistics";

import Support from "./Support";

import Settings from "./Settings";

// import Admin from "./Admin"; // Comentado - Pertence ao AdminLayout?

import Products from "./Products";

import Financial from "./Financial";

import Hospitalization from "./Hospitalization";

import Services from "./Services";

import Sales from "./Sales";

import EditCustomer from "./EditCustomer";

import EditAppointment from "./EditAppointment";

import AppointmentForm from "@/components/appointment/AppointmentForm";

import MedicalRecordForm from "./MedicalRecordForm";

import AdminLogin from "./AdminLogin";
import TenantLogin from "./TenantLogin";

// import DashboardMultiTenant from "./DashboardMultiTenant"; // Comentado - Pertence ao AdminLayout?

import GerenciamentoMultiTenant from "./GerenciamentoMultiTenant";

import Contratar from "./Contratar";

import AdminReports from "./AdminReports";

import StoreSetup from "./StoreSetup";

import StoreDashboard from "./StoreDashboard";

import TenantSettings from "./TenantSettings";

import AdminTools from "./AdminTools";

import SalesHistory from "./SalesHistory";

import AdminDashboard from "./AdminDashboard";

import HealthPlans from "./HealthPlans";

import Vaccines from "./Vaccines";

import Medications from "./Medications";

import Allergies from "./Allergies";

import Appointments from "./Appointments";

import Staff from "./Staff";

import ServiceQueue from "./ServiceQueue";

import LiveVetDashboard from "../modules/live-vet/pages/LiveVetDashboard";
import LiveVetConsulta from "../modules/live-vet/pages/LiveVetConsulta";
import ConsultaReportPage from "../modules/live-vet/pages/ConsultaReportPage";
import MedicationQueue from "./MedicationQueue";
import { TenantProvider } from "@/components/tenant/TenantContext";
import ProtectedRoute from './ProtectedRoute';
import PrescriptionManager from './PrescriptionManager';

/* Comentado PAGES pois não será mais usado 
const PAGES = {
    
    Landing: Landing,
    
    Dashboard: Dashboard,
    
    Customers: Customers,
    
    CustomerDetails: CustomerDetails,
    
    Calendar: Calendar,
    
    PetDetails: PetDetails,
    
    OCRStatistics: OCRStatistics,
    
    Support: Support,
    
    Settings: Settings,
    
    Admin: Admin,
    
    Products: Products,
    
    Financial: Financial,
    
    Hospitalization: Hospitalization,
    
    Services: Services,
    
    Sales: Sales,
    
    EditCustomer: EditCustomer,
    
    EditAppointment: EditAppointment,
    
    AppointmentForm: AppointmentForm,
    
    MedicalRecordForm: MedicalRecordForm,
    
    AdminLogin: AdminLogin,
    
    DashboardMultiTenant: DashboardMultiTenant,
    
    GerenciamentoMultiTenant: GerenciamentoMultiTenant,
    
    Contratar: Contratar,
    
    AdminReports: AdminReports,
    
    StoreSetup: StoreSetup,
    
    StoreDashboard: StoreDashboard,
    
    TenantSettings: TenantSettings,
    
    AdminTools: AdminTools,
    
    TransportServices: TransportServices,
    
    SalesHistory: SalesHistory,
    
    TransportSettings: TransportSettings,
    
    AdminDashboard: AdminDashboard,
    
    HealthPlans: HealthPlans,
    
    Vaccines: Vaccines,
    
    Medications: Medications,
    
    Allergies: Allergies,
    
    Appointments: Appointments,
    
    Staff: Staff,
    
    ServiceQueue: ServiceQueue,
    
    LiveVetDashboard: LiveVetDashboard,
    
    LiveVetConsulta: LiveVetConsulta,
    
}
*/

/* Comentado _getCurrentPage pois não será mais usado 
function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}
*/

function PagesContent() {
    return (
      <TenantProvider>
        <Routes>
            {/* Rota raiz - Landing Page */}
            <Route path="/" element={<Landing />} />
            
            {/* Rotas sem layout */}
            <Route path="/adminlogin" element={<AdminLogin />} />
            <Route path="/login" element={<TenantLogin />} />
            
            {/* Rotas com AdminLayout */}
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="multitenant" element={<GerenciamentoMultiTenant />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="tools" element={<AdminTools />} />
            </Route>

            {/* Alias para /admin/dashboard */}
            <Route path="/admindashboard" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
            </Route>

            {/* Rotas com Layout padrão (tenant) - CORRECTED STRUCTURE V2 */}
            <Route path="/tenant" element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clientes" element={<Customers />} />
                <Route path="cliente/:id" element={<CustomerDetails />} />
                <Route path="cliente/editar/:id" element={<EditCustomer />} />
                <Route path="calendario" element={<Calendar />} />
                <Route path="pet/:id" element={<PetDetails />} />
                <Route path="orc-estatisticas" element={<OCRStatistics />} />
                <Route path="suporte" element={<Support />} />
                <Route path="configuracoes" element={<Settings />} />
                <Route path="produtos" element={<Products />} />
                <Route path="financeiro" element={<Financial />} />
                <Route path="internacao" element={<Hospitalization />} />
                <Route path="servicos" element={<Services />} />
                <Route path="vendas" element={<Sales />} />
                <Route path="vendas/historico" element={<SalesHistory />} />
                <Route path="agendamento/editar/:id" element={<EditAppointment />} />
                <Route path="agendamento/novo" element={<AppointmentForm />} />
                <Route path="prontuario/novo" element={<MedicalRecordForm />} />
                <Route path="contratar" element={<Contratar />} />
                <Route path="loja/configurar" element={<StoreSetup />} />
                <Route path="loja/dashboard" element={<StoreDashboard />} />
                <Route path="tenant/configuracoes" element={<TenantSettings />} />
                <Route path="planos-saude" element={<HealthPlans />} />
                <Route path="vacinas" element={<Vaccines />} />
                <Route path="medicamentos" element={<Medications />} />
                <Route path="alergias" element={<Allergies />} />
                <Route path="consultas" element={<Appointments />} />
                <Route path="equipe" element={<Staff />} />
                <Route path="fila-atendimento" element={<ServiceQueue />} />
                <Route path="live-vet" element={<LiveVetDashboard />} />
                <Route path="live-vet/consulta/:appointmentId" element={<LiveVetConsulta />} />
                <Route path="live-vet/relatorio/:appointmentId" element={<ConsultaReportPage />} />
                <Route path="medicacao" element={<MedicationQueue />} />
                <Route path="prescription-manager" element={<PrescriptionManager />} />
              </Route>
            </Route>
            
            {/* Removed the problematic alias routes and the old duplicate tenant structure */}

            {/* Catch-all ou Not Found Route (Optional) */}
            {/* <Route path="*" element={<NotFound />} /> */}

        </Routes>
      </TenantProvider>
    );
}

export default PagesContent;