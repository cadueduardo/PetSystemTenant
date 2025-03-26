import React, { useState, useEffect } from "react";
import { User as UserEntity } from "@/api/entities";
import { SupportTicket } from "@/api/entities";
import { KnowledgeArticle } from "@/api/entities";
import { Tenant } from "@/api/entities";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Plus,
  Search,
  BookOpen,
  MessageSquareMore,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2
} from "lucide-react";

import NewTicketForm from "../components/support/NewTicketForm";
import KnowledgeBaseSearch from "../components/support/KnowledgeBaseSearch";
import Chatbot from "../components/support/Chatbot";

const priorityColors = {
  low: "bg-blue-100 text-blue-800 border-blue-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200"
};

const statusColors = {
  open: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  waiting_customer: "bg-purple-100 text-purple-800 border-purple-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200"
};

export default function SupportPage() {
  const navigate = useNavigate();
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTenant, setCurrentTenant] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const userData = await UserEntity.me();
      const tenants = await Tenant.list();
      const activeTenant = tenants.find(t => t.status === "active");
      
      if (activeTenant) {
        setCurrentTenant(activeTenant);
        
        const ticketData = await SupportTicket.filter({ 
          tenant_id: activeTenant.id,
          created_by_email: userData.email 
        });
        setTickets(ticketData);

        const articleData = await KnowledgeArticle.filter({ tenant_id: activeTenant.id });
        setArticles(articleData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTicketCreated = () => {
    setShowNewTicket(false);
    loadData();
  };

  const getStatusBadge = (status) => {
    const statusLabels = {
      open: "Aberto",
      in_progress: "Em Andamento",
      waiting_customer: "Aguardando Cliente",
      resolved: "Resolvido",
      closed: "Fechado"
    };

    return (
      <Badge variant="outline" className={statusColors[status]}>
        {statusLabels[status]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityLabels = {
      low: "Baixa",
      medium: "Média",
      high: "Alta"
    };

    return (
      <Badge variant="outline" className={priorityColors[priority]}>
        {priorityLabels[priority]}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Suporte</h1>
          <p className="text-gray-500">Central de ajuda e suporte ao cliente</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowChatbot(true)}
            className="flex items-center gap-2"
          >
            <MessageSquareMore className="w-4 h-4" />
            Chatbot
          </Button>
          <Button onClick={() => setShowNewTicket(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Novo Chamado
          </Button>
        </div>
      </div>

      {showNewTicket && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Novo Chamado</CardTitle>
          </CardHeader>
          <CardContent>
            <NewTicketForm
              onSuccess={handleTicketCreated}
              onCancel={() => setShowNewTicket(false)}
              trialId={currentTenant?.id}
            />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tickets">
        <TabsList className="mb-6">
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <MessageSquareMore className="w-4 h-4" />
            Meus Chamados
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Base de Conhecimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <CardTitle>Lista de Chamados</CardTitle>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="search"
                    placeholder="Buscar chamados..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquareMore className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">
                    Nenhum chamado encontrado
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Clique em "Novo Chamado" para criar seu primeiro chamado de suporte
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Última Atualização</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets
                        .filter(ticket => 
                          ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((ticket) => (
                          <TableRow 
                            key={ticket.id}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => navigate(createPageUrl(`TicketDetails?id=${ticket.id}`))}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{ticket.title}</p>
                                <p className="text-sm text-gray-500 truncate">
                                  {ticket.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(ticket.status)}
                            </TableCell>
                            <TableCell>
                              {getPriorityBadge(ticket.priority)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  {format(new Date(ticket.updated_date), "dd/MM/yyyy HH:mm")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(createPageUrl(`TicketDetails?id=${ticket.id}`));
                                }}
                              >
                                Ver
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseSearch articles={articles} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {showChatbot && (
        <Chatbot
          onClose={() => setShowChatbot(false)}
          trialId={currentTenant?.id}
        />
      )}
    </div>
  );
}
