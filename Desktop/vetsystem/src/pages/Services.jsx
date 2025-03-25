import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Service } from "@/api/entities";
import { STORAGE_KEY, getMockData } from "@/api/mockData";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Scissors,
  PawPrint,
  Droplet,
  Package,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ServiceForm from "../components/services/ServiceForm";
import { toast } from "@/components/ui/use-toast";

export default function Services() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    
    if (!storeParam && !localStorage.getItem('current_tenant')) {
      navigate(createPageUrl("Landing"));
      return;
    }
    
    if (storeParam) {
      localStorage.setItem('current_tenant', storeParam);
    }
    
    loadServices();
  }, [navigate]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
  };

  const handleModuleFilter = (module) => {
    setSelectedModule(module);
    setSelectedCategory("all");
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value !== "all") {
      setSelectedModule(value);
      setSelectedCategory("all");
    } else {
      setSelectedModule("all");
      setSelectedCategory("all");
    }
  };

  const handleDeleteClick = (service) => {
    setServiceToDelete(service);
    setShowConfirmDelete(true);
  };

  const confirmDelete = () => {
    if (serviceToDelete) {
      setServices(services.filter(s => s.id !== serviceToDelete.id));
      setShowConfirmDelete(false);
      setServiceToDelete(null);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setShowForm(true);
  };

  const loadServices = async () => {
    setIsLoading(true);
    try {
      const tenantId = localStorage.getItem('current_tenant');
      const mockData = getMockData();
      
      // Carregar serviços do mock data e remover duplicatas baseado no ID
      const servicesData = mockData.services
        .filter(service => service.tenant_id === tenantId)
        .reduce((unique, service) => {
          if (!unique.find(s => s.id === service.id)) {
            unique.push(service);
          }
          return unique;
        }, []);
      
      setServices(servicesData);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os serviços.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para obter ícone por categoria
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'consultation':
        return <PawPrint className="h-4 w-4 text-blue-500" />;
      case 'exam':
        return <Scissors className="h-4 w-4 text-green-500" />;
      case 'vaccination':
        return <Droplet className="h-4 w-4 text-purple-500" />;
      case 'surgery':
        return <Scissors className="h-4 w-4 text-red-500" />;
      case 'return':
        return <PawPrint className="h-4 w-4 text-yellow-500" />;
      case 'telemedicine':
        return <PawPrint className="h-4 w-4 text-teal-500" />;
      case 'grooming':
        return <Scissors className="h-4 w-4 text-pink-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  // Função para obter texto da categoria
  const getCategoryText = (category) => {
    switch (category) {
      case 'consultation':
        return "Consulta";
      case 'exam':
        return "Exame";
      case 'vaccination':
        return "Vacinação";
      case 'surgery':
        return "Cirurgia";
      case 'return':
        return "Retorno";
      case 'telemedicine':
        return "Telemedicina";
      case 'grooming':
        return "Banho e Tosa";
      case 'products':
        return "Produtos";
      case 'food':
        return "Alimentação";
      case 'accessories':
        return "Acessórios";
      case 'medicines':
        return "Medicamentos";
      default:
        return category;
    }
  };

  // Filtrar serviços
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          service.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
    const matchesModule = selectedModule === "all" || service.module === selectedModule;
    
    return matchesSearch && matchesCategory && matchesModule;
  });

  // Função auxiliar para formatar preço
  const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  // Função auxiliar para formatar duração
  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${remainingMinutes}min`;
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Serviços</h1>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            onClick={() => {
              setEditingService(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>Novo Serviço</span>
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Buscar serviços..." 
            className="pl-10"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        <Select value={selectedModule} onValueChange={handleModuleFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="clinica">Clínica</SelectItem>
            <SelectItem value="petshop">Petshop</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {selectedModule === "clinica" || selectedModule === "all" ? (
              <>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="exam">Exame</SelectItem>
                <SelectItem value="vaccination">Vacinação</SelectItem>
                <SelectItem value="surgery">Cirurgia</SelectItem>
                <SelectItem value="return">Retorno</SelectItem>
                <SelectItem value="telemedicine">Telemedicina</SelectItem>
              </>
            ) : null}
            {selectedModule === "petshop" || selectedModule === "all" ? (
              <>
                <SelectItem value="grooming">Banho e Tosa</SelectItem>
                <SelectItem value="products">Produtos</SelectItem>
                <SelectItem value="food">Alimentação</SelectItem>
                <SelectItem value="accessories">Acessórios</SelectItem>
                <SelectItem value="medicines">Medicamentos</SelectItem>
              </>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="clinica">Clínica</TabsTrigger>
          <TabsTrigger value="petshop">Petshop</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-0">
          {renderServicesList()}
        </TabsContent>
        
        <TabsContent value="clinica" className="mt-0">
          {renderServicesList()}
        </TabsContent>
        
        <TabsContent value="petshop" className="mt-0">
          {renderServicesList()}
        </TabsContent>
      </Tabs>
      
      <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o serviço "{serviceToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceForm
        open={showForm}
        onOpenChange={setShowForm}
        service={editingService}
        onSuccess={() => {
          loadServices();
          setShowForm(false);
          setEditingService(null);
        }}
      />
    </div>
  );

  function renderServicesList() {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }
    
    if (filteredServices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium">Nenhum serviço encontrado</h3>
          <p className="text-gray-500 max-w-sm mt-2">
            Não encontramos nenhum serviço com os filtros aplicados.
          </p>
        </div>
      );
    }
    
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map(service => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {service.image_url && (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-gray-500 truncate max-w-[200px]">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getCategoryIcon(service.category)}
                      <span className="ml-2">{getCategoryText(service.category)}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(service.duration)}</TableCell>
                  <TableCell>{formatPrice(service.price)}</TableCell>
                  <TableCell>{service.points}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(service)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleDeleteClick(service)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }
}
