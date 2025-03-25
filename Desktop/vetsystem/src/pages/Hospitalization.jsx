import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { Pet } from "@/api/entities";
import { Customer } from "@/api/entities";
import { Hospitalization } from "@/api/entities";
import { HospitalizationProgress } from "@/api/entities";

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Hospital, 
  Plus, 
  Search, 
  Heart, 
  Clock, 
  Calendar, 
  Clipboard, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  ArrowRight,
  FileText,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

export default function HospitalizationPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [activeTab, setActiveTab] = useState("current");
  const [hospitalizations, setHospitalizations] = useState([]);
  const [pets, setPets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        
        if (!activeTenant.selected_modules.includes("clinic_management")) {
          toast({
            title: "Módulo não disponível",
            description: "O módulo de Gestão Clínica não está ativo para sua conta.",
            variant: "destructive"
          });
          navigate(createPageUrl("Dashboard"));
          return;
        }
        
        const hospitalizationsData = await Hospitalization.filter({ tenant_id: activeTenant.id });
        setHospitalizations(hospitalizationsData);
        
        const petsData = await Pet.filter({ tenant_id: activeTenant.id });
        setPets(petsData);
        
        const customersData = await Customer.filter({ tenant_id: activeTenant.id });
        setCustomers(customersData);
      } else {
        toast({
          title: "Erro",
          description: "Nenhuma clínica ativa encontrada.",
          variant: "destructive"
        });
        navigate(createPageUrl("Dashboard"));
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de internações.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterHospitalizations = () => {
    let filtered = [...hospitalizations];
    
    if (activeTab === "current") {
      filtered = filtered.filter(h => h.status === "active");
    } else if (activeTab === "discharged") {
      filtered = filtered.filter(h => h.status === "discharged");
    } else if (activeTab === "transferred") {
      filtered = filtered.filter(h => h.status === "transferred");
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h => {
        const pet = pets.find(p => p.id === h.pet_id);
        if (!pet) return false;
        
        const customer = customers.find(c => c.id === pet.owner_id);
        
        return (
          (pet?.name?.toLowerCase().includes(term)) ||
          (customer?.full_name?.toLowerCase().includes(term)) ||
          (h.reason?.toLowerCase().includes(term)) ||
          (h.room?.toLowerCase().includes(term)) ||
          (h.responsible_doctor?.toLowerCase().includes(term))
        );
      });
    }
    
    return filtered.sort((a, b) => new Date(b.admission_date) - new Date(a.admission_date));
  };

  const getPetById = (petId) => {
    return pets.find(pet => pet.id === petId) || { name: "Pet não encontrado" };
  };

  const getOwnerById = (petId) => {
    const pet = pets.find(pet => pet.id === petId);
    if (!pet) return { full_name: "Tutor não encontrado" };
    
    return customers.find(customer => customer.id === pet.owner_id) || 
      { full_name: "Tutor não encontrado" };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-100 text-blue-800">Internado</Badge>;
      case "discharged":
        return <Badge className="bg-green-100 text-green-800">Alta</Badge>;
      case "deceased":
        return <Badge className="bg-red-100 text-red-800">Óbito</Badge>;
      case "transferred":
        return <Badge className="bg-amber-100 text-amber-800">Transferido</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const getSpeciesIcon = (species) => {
    switch (species) {
      case "dog":
        return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dog"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"/></svg>;
      case "cat":
        return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cat"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/></svg>;
      default:
        return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-paw-print"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="7" cy="15" r="2"/><circle cx="15" cy="15" r="2"/><path d="M5 9a7 7 0 0 0 14 0"/></svg>;
    }
  };

  const handleRowClick = (hospitalization) => {
    navigate(createPageUrl(`HospitalizationDetails?id=${hospitalization.id}`));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  const filteredHospitalizations = filterHospitalizations();

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Internações</h1>
          <p className="text-gray-500">Gerenciamento de pacientes internados</p>
        </div>
        <Button 
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Internação
        </Button>
      </div>

      {showNewForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nova Internação</CardTitle>
            <CardDescription>Registrar internação de paciente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Hospital className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Formulário em implementação</h3>
              <p className="mt-1 text-gray-500">
                O formulário de nova internação estará disponível em breve.
              </p>
              <Button onClick={() => setShowNewForm(false)} className="mt-4">
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="current" className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  Atuais
                </TabsTrigger>
                <TabsTrigger value="discharged" className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Altas
                </TabsTrigger>
                <TabsTrigger value="all" className="flex items-center gap-1">
                  <Clipboard className="w-4 h-4" />
                  Todas
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Buscar internações..."
                className="pl-8"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHospitalizations.length === 0 ? (
            <div className="text-center py-12">
              <Hospital className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhuma internação encontrada</h3>
              <p className="mt-1 text-gray-500">
                {searchTerm 
                  ? "Nenhuma internação corresponde aos critérios de busca" 
                  : activeTab === "current" 
                    ? "Não há pacientes internados no momento" 
                    : "Não há registros de internações"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Médico</TableHead>
                    <TableHead>Leito</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHospitalizations.map(hospitalization => {
                    const pet = getPetById(hospitalization.pet_id);
                    const owner = getOwnerById(hospitalization.pet_id);
                    
                    return (
                      <TableRow 
                        key={hospitalization.id} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleRowClick(hospitalization)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              {pet ? getSpeciesIcon(pet.species) : "?"}
                            </div>
                            <div>
                              <div className="font-medium">{pet.name}</div>
                              <div className="text-sm text-gray-500">{owner.full_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">{hospitalization.reason}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{format(new Date(hospitalization.admission_date), "dd/MM/yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{format(new Date(hospitalization.admission_date), "HH:mm")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{hospitalization.responsible_doctor}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{hospitalization.room || "—"}</div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(hospitalization.status)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
