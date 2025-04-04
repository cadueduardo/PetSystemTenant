
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tenant } from "@/api/entities";
import { User } from "@/api/entities";
import { toast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Loader2,
  Plus,
  Truck,
  Users,
  ArrowRight,
  MapPin,
  Calendar as CalendarIcon,
  Check,
  Clock,
  CheckSquare,
  Clipboard,
  Settings,
  RefreshCw,
  Filter
} from "lucide-react";

// Função segura para verificar e executar chamadas
const safeApiCall = async (entity, method, params = null, fallback = null) => {
  try {
    if (!entity || typeof entity[method] !== 'function') {
      console.error(`Entity or method ${method} is not defined`);
      return fallback;
    }
    
    if (params !== null) {
      return await entity[method](params);
    } else {
      return await entity[method]();
    }
  } catch (error) {
    console.error(`Error in API call ${method}:`, error);
    return fallback;
  }
};

export default function TransportServicesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [transportServices, setTransportServices] = useState([]);
  const [storeParam, setStoreParam] = useState("");
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');
      setStoreParam(storeParam);
      
      if (storeParam === 'demo') {
        // Dados para demonstração
        const demoTenant = {
          id: "demo-tenant",
          company_name: "PetManager Demo",
          selected_modules: ["clinic_management", "petshop", "financial", "transport"],
          status: "active",
          access_url: "demo"
        };
        
        setTenant(demoTenant);
        
        if (!demoTenant.selected_modules.includes("transport")) {
          navigate(createPageUrl("Dashboard?store=demo"));
          return;
        }
        
        // Dados de demonstração para transportes
        const demoTransportServices = [
          {
            id: "trans-1",
            name: "Leva e Traz - Padrão",
            description: "Serviço de transporte para levar e buscar pets",
            status: "active",
            days_available: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            hours_start: "08:00",
            hours_end: "18:00",
            max_capacity_per_day: 15,
            accepted_pet_types: ["small_dog", "medium_dog", "cat"],
            tenant_id: demoTenant.id
          },
          {
            id: "trans-2",
            name: "Leva e Traz - Premium",
            description: "Serviço de transporte premium com veículo exclusivo",
            status: "active",
            days_available: ["monday", "wednesday", "friday"],
            hours_start: "09:00",
            hours_end: "17:00",
            max_capacity_per_day: 8,
            accepted_pet_types: ["small_dog", "medium_dog", "large_dog", "cat"],
            tenant_id: demoTenant.id
          }
        ];
        
        setTransportServices(demoTransportServices);
        setIsLoading(false);
        return;
      }
      
      // Código para carregamento de dados reais...
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários."
      });
      navigate(createPageUrl("Dashboard?store=" + (storeParam || "")));
    } finally {
      setIsLoading(false);
    }
  };
  
  // ... rest of the component
}
