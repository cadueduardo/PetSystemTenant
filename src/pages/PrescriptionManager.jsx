import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PlusCircle, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { list as listTemplates, del as deleteTemplate } from '../api/mock/prescriptionTemplateService.js'; // Use the mock service
import { PrescriptionTemplateForm } from '@/components/prescriptions/PrescriptionTemplateForm'; // Import the form component

function PrescriptionManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for managing the Create/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedTemplates = await listTemplates();
      setTemplates(fetchedTemplates);
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
      setError("Falha ao carregar os modelos de prescrição.");
      toast({ title: "Erro", description: error, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Added toast dependency

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // --- Modal Control --- 
  const handleAddTemplate = () => {
    console.log("Abrir modal para novo modelo");
    setEditingTemplate(null); // Ensure we are in create mode
    setIsModalOpen(true);
    // toast({ title: "Info", description: "Modal de criação ainda não implementado." }); // Remove placeholder toast
  };

  const handleEditTemplate = (template) => {
    console.log("Abrir modal para editar modelo:", template);
    setEditingTemplate(template); // Set template to edit
    setIsModalOpen(true);
    // toast({ title: "Info", description: "Modal de edição ainda não implementado." }); // Remove placeholder toast
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null); // Clear editing state when closing
  };

  // --- Data Handling ---
  const handleDeleteTemplate = async (templateId) => {
    console.log("Deletar modelo ID:", templateId);
    try {
      const success = await deleteTemplate(templateId);
      if (success) {
        toast({ title: "Sucesso", description: "Modelo deletado com sucesso!" });
        loadTemplates(); // Recarrega a lista
      } else {
        throw new Error("Modelo não encontrado ou falha ao deletar.");
      }
    } catch (error) {
      console.error("Erro ao deletar modelo:", error);
      toast({ title: "Erro ao Deletar", description: error.message, variant: "destructive" });
    }
  };

  // Callback function for successful save in the form
  const handleSaveSuccess = () => {
    handleCloseModal(); // Close the modal
    loadTemplates(); // Refresh the list
    // Optional: Add a success toast here if not handled within the form
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciar Modelos de Prescrição</h1>
        {/* Button now opens the modal */}
        <Button onClick={handleAddTemplate}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Novo Modelo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelos Salvos</CardTitle>
          <CardDescription>Visualize, edite ou exclua os modelos de prescrição.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {error && (
             <div className="flex items-center justify-center p-4 border border-destructive bg-destructive/10 rounded-md">
                <AlertTriangle className="h-5 w-5 text-destructive mr-3" />
                <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Nº Itens</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length > 0 ? (
                  templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{template.type}</TableCell>
                      <TableCell className="text-center">{template.items?.length || 0}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={template.observations}>{template.observations || '-'}</TableCell>
                      <TableCell className="text-right">
                         {/* Edit button now opens the modal */}
                        <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => handleEditTemplate(template)} title="Editar Modelo">
                          <Edit className="h-4 w-4" />
                        </Button>
                         {/* Delete button and AlertDialog (no changes) */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Deletar Modelo">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                {`Tem certeza que deseja excluir o modelo "${template.name}"? Esta ação não pode ser desfeita.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Nenhum modelo encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Render the Modal Form */}
      <PrescriptionTemplateForm 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        template={editingTemplate} 
        onSaveSuccess={handleSaveSuccess} 
      />

    </div>
  );
}

export default PrescriptionManager; 