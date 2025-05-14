import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Service } from "@/api/entities";
import {
  Plus,
  Search,
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
import PaginationControls from "@/components/ui/PaginationControls";

export default function Services() {
  const navigate = useNavigate();
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [totalServices, setTotalServices] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  
  const [sortBy, /* setSortBy */] = useState("name"); // Comentado setSortBy
  const [sortOrder, /* setSortOrder */] = useState("asc"); // Comentado setSortOrder

  const loadServicesPage = useCallback(async (direction = 'current', newPageSize = pageSize, forFilters = false) => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
      setServices([]);
      return;
    }

    console.log(`[ServicesPage loadServicesPage] Loading. Dir: ${direction}, Size: ${newPageSize}, Page: ${currentPage}, Type: ${selectedType}, Cat: ${selectedCategory}, Sort: ${sortBy} ${sortOrder}`);
    setIsLoadingPage(true);
    if (direction === 'current' || forFilters) setIsLoadingInitial(true);

    try {
      const filterParams = {
        tenant_id: tenantId,
        type: selectedType === 'all' ? null : selectedType,
        category: selectedCategory === 'all' ? null : selectedCategory,
        orderByField: sortBy,
        orderByDirection: sortOrder,
        limitNum: newPageSize,
      };
      
      if (direction === 'current' || forFilters) {
        const count = await Service.getCount(filterParams);
        setTotalServices(count);
        setCurrentPage(1);
        setFirstVisibleDoc(null);
        setLastVisibleDoc(null);
        filterParams.startAfterDoc = null;
      } else if (direction === 'next' && lastVisibleDoc) {
        filterParams.startAfterDoc = lastVisibleDoc;
      } else if (direction === 'prev' && firstVisibleDoc) {
        console.warn("[ServicesPage] 'Previous' page functionality is limited.");
        filterParams.orderByDirection = sortOrder === 'asc' ? 'desc' : 'asc';
      }

      const { services: fetchedServices, lastVisibleDoc: newLastVisible } = await Service.list(filterParams);
      
      let servicesData = fetchedServices || [];
      if (direction === 'prev' && firstVisibleDoc) {
        if(filterParams.orderByDirection !== sortOrder) {
          servicesData.reverse();
        }
      }

      setServices(servicesData);
      setLastVisibleDoc(newLastVisible || null);
      setFirstVisibleDoc(servicesData.length > 0 ? servicesData[0] : null);

      if (direction === 'next') {
        setCurrentPage(prev => prev + 1);
      } else if (direction === 'prev') {
        if(currentPage > 1) setCurrentPage(prev => prev - 1);
      }

    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os serviços.", variant: "destructive" });
      setServices([]);
      setTotalServices(0);
    } finally {
      setIsLoadingInitial(false);
      setIsLoadingPage(false);
    }
  }, [selectedType, selectedCategory, sortBy, sortOrder, pageSize, toast]);

  useEffect(() => {
    const tenantId = localStorage.getItem('current_tenant');
    if (!tenantId) {
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');
      if (!storeParam) {
        navigate(createPageUrl("Landing"));
        return;
      }
      if (storeParam) localStorage.setItem('current_tenant', storeParam);
    }
    loadServicesPage('current', pageSize, true);
  }, [navigate]);

  useEffect(() => {
    if (!isLoadingInitial) {
      console.log(`[ServicesPage] Filters/sort changed. Reloading.`);
      loadServicesPage('current', pageSize, true);
    }
  }, [selectedType, selectedCategory, activeTab, sortBy, sortOrder]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
  };

  const handleTypeFilter = (typeValue) => {
    setSelectedType(typeValue);
    setSelectedCategory("all");
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
  };

  const handleDeleteClick = (service) => {
    setServiceToDelete(service);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      setIsDeleting(true);
      try {
        await Service.delete(serviceToDelete.id);
        toast({ title: "Sucesso", description: "Serviço excluído." });
        setShowConfirmDelete(false);
        setServiceToDelete(null);
        await loadServicesPage('current', pageSize, true);
      } catch (error) {
        console.error("Erro ao excluir serviço:", error);
        toast({
          title: "Erro",
          description: "Não foi possível excluir o serviço.",
          variant: "destructive",
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setShowForm(true);
  };

  const frontendFilteredServices = services.filter(service => {
    if (!searchQuery) return true;
    return service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handlePageChange = (directionOrPageNumber) => {
    if (typeof directionOrPageNumber === 'string') {
      loadServicesPage(directionOrPageNumber, pageSize, false);
    } else {
      console.warn("[ServicesPage] Direct page number navigation attempted but not fully supported.");
    }
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    loadServicesPage('current', newPageSize, true);
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
            placeholder="Buscar na página atual..." 
            className="pl-10"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        <Select value={selectedType} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Módulos</SelectItem>
            <SelectItem value="clinical">Clínica</SelectItem>
            <SelectItem value="petshop">Petshop</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {(selectedType === "clinical" || selectedType === "all") && (
              <>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="exam">Exame</SelectItem>
                <SelectItem value="vaccination">Vacinação</SelectItem>
                <SelectItem value="surgery">Cirurgia</SelectItem>
                <SelectItem value="return">Retorno</SelectItem>
                <SelectItem value="telemedicine">Telemedicina</SelectItem>
              </>
            )}
            {(selectedType === "petshop" || selectedType === "all") && (
              <>
                <SelectItem value="grooming">Banho e Tosa</SelectItem>
              </>
            )}
             {selectedType === "all" && (
              <>
                <SelectItem value="consultation">Consulta</SelectItem>
                <SelectItem value="exam">Exame</SelectItem>
                <SelectItem value="vaccination">Vacinação</SelectItem>
                <SelectItem value="surgery">Cirurgia</SelectItem>
                <SelectItem value="return">Retorno</SelectItem>
                <SelectItem value="telemedicine">Telemedicina</SelectItem>
                <SelectItem value="grooming">Banho e Tosa</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">Todos (Ativos)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-0">
          {renderServicesList()}
        </TabsContent>
      </Tabs>
      
      <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              {`Tem certeza que deseja excluir o serviço "${serviceToDelete?.name}"?`}
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} 
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceForm
        open={showForm}
        onOpenChange={setShowForm}
        service={editingService}
        onSuccess={() => {
          loadServicesPage('current', pageSize, true);
          setShowForm(false);
          setEditingService(null);
        }}
      />
      {!isLoadingInitial && services.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalServices}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoadingPage}
          itemCountOnPage={services.length}
          hasNextPage={!!lastVisibleDoc && services.length === pageSize}
          hasPreviousPage={currentPage > 1}
        />
      )}
    </div>
  );

  function renderServicesList() {
    if (isLoadingInitial) {
      return (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }
    
    if (frontendFilteredServices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium">Nenhum serviço encontrado</h3>
          <p className="text-gray-500 max-w-sm mt-2">
            {services.length === 0 && !searchQuery ? (totalServices === 0 ? "Nenhum serviço cadastrado." : "Nenhum serviço ativo encontrado com os filtros.") : "Não encontramos nenhum serviço com os filtros e busca atuais."}
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
              {frontendFilteredServices.map(service => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
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

  function getCategoryIcon(category) {
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
  }

  function getCategoryText(category) {
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
  }

  function formatPrice(price) {
    if (typeof price !== 'number') return 'R$ -';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  }

  function formatDuration(minutes) {
    if (typeof minutes !== 'number') return '-';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}min`;
  }
}
