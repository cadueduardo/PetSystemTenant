import Layout from "./Layout.jsx";

import Landing from "./Landing";

import Dashboard from "./Dashboard";

import Customers from "./Customers";

import CustomerDetails from "./CustomerDetails";

import Calendar from "./Calendar";

import PetDetails from "./PetDetails";

import OCRStatistics from "./OCRStatistics";

import Support from "./Support";

import Settings from "./Settings";

import Admin from "./Admin";

import Products from "./Products";

import Financial from "./Financial";

import Hospitalization from "./Hospitalization";

import Services from "./Services";

import Sales from "./Sales";

import EditCustomer from "./EditCustomer";

import EditAppointment from "./EditAppointment";

import AppointmentForm from "./AppointmentForm";

import MedicalRecordForm from "./MedicalRecordForm";

import AdminLogin from "./AdminLogin";

import DashboardMultiTenant from "./DashboardMultiTenant";

import GerenciamentoMultiTenant from "./GerenciamentoMultiTenant";

import Contratar from "./Contratar";

import AdminReports from "./AdminReports";

import StoreSetup from "./StoreSetup";

import StoreDashboard from "./StoreDashboard";

import TenantSettings from "./TenantSettings";

import AdminTools from "./AdminTools";

import TransportServices from "./TransportServices";

import SalesHistory from "./SalesHistory";

import TransportSettings from "./TransportSettings";

import AdminDashboard from "./AdminDashboard";

import HealthPlans from "./HealthPlans";

import Vaccines from "./Vaccines";

import Medications from "./Medications";

import Allergies from "./Allergies";

import Appointments from "./Appointments";

import Staff from "./Staff";

import ServiceQueue from "./ServiceQueue";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    
}

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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Landing />} />
                
                
                <Route path="/Landing" element={<Landing />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Customers" element={<Customers />} />
                
                <Route path="/CustomerDetails" element={<CustomerDetails />} />
                
                <Route path="/Calendar" element={<Calendar />} />
                
                <Route path="/PetDetails" element={<PetDetails />} />
                
                <Route path="/OCRStatistics" element={<OCRStatistics />} />
                
                <Route path="/Support" element={<Support />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/Products" element={<Products />} />
                
                <Route path="/Financial" element={<Financial />} />
                
                <Route path="/Hospitalization" element={<Hospitalization />} />
                
                <Route path="/Services" element={<Services />} />
                
                <Route path="/Sales" element={<Sales />} />
                
                <Route path="/EditCustomer" element={<EditCustomer />} />
                
                <Route path="/EditAppointment" element={<EditAppointment />} />
                
                <Route path="/AppointmentForm" element={<AppointmentForm />} />
                
                <Route path="/MedicalRecordForm" element={<MedicalRecordForm />} />
                
                <Route path="/AdminLogin" element={<AdminLogin />} />
                
                <Route path="/DashboardMultiTenant" element={<DashboardMultiTenant />} />
                
                <Route path="/GerenciamentoMultiTenant" element={<GerenciamentoMultiTenant />} />
                
                <Route path="/Contratar" element={<Contratar />} />
                
                <Route path="/AdminReports" element={<AdminReports />} />
                
                <Route path="/StoreSetup" element={<StoreSetup />} />
                
                <Route path="/StoreDashboard" element={<StoreDashboard />} />
                
                <Route path="/TenantSettings" element={<TenantSettings />} />
                
                <Route path="/AdminTools" element={<AdminTools />} />
                
                <Route path="/TransportServices" element={<TransportServices />} />
                
                <Route path="/SalesHistory" element={<SalesHistory />} />
                
                <Route path="/TransportSettings" element={<TransportSettings />} />
                
                <Route path="/AdminDashboard" element={<AdminDashboard />} />
                
                <Route path="/HealthPlans" element={<HealthPlans />} />
                
                <Route path="/Vaccines" element={<Vaccines />} />
                
                <Route path="/Medications" element={<Medications />} />
                
                <Route path="/Allergies" element={<Allergies />} />
                
                <Route path="/Appointments" element={<Appointments />} />
                
                <Route path="/Staff" element={<Staff />} />
                
                <Route path="/ServiceQueue" element={<ServiceQueue />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}