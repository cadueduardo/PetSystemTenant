import React, { useState, useEffect } from "react";
import { PetClinicalData } from "@/api/entities";
import { Vaccine } from "@/api/entities";
import { Medication } from "@/api/entities";
import { Allergy } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Syringe,
  Pill,
  AlertTriangle,
  Calendar,
  Loader2,
  Clock,
  X,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AllergyForm from "../medical/AllergyForm";
import VaccineForm from "../medical/VaccineForm";
import MedicationForm from "../medical/MedicationForm";

function VaccineModal({ open, onOpenChange, pet, onSave }) {
  const [isLoading, setIsLoading] = useState(true);
  const [vaccines, setVaccines] = useState([]);
  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [vaccine, setVaccine] = useState({
    vaccine_name: "",
    application_date: format(new Date(), "yyyy-MM-dd"),
    next_dose_date: "",
    batch_number: "",
    veterinarian: ""
  });

  useEffect(() => {
    const loadVaccines = async () => {
      try {
        const tenantId = localStorage.getItem('current_tenant');
        const vaccinesList = await Vaccine.filter({ tenant_id: tenantId });
        setVaccines(vaccinesList);
      } catch (error) {
        console.error("Erro ao carregar vacinas:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de vacinas.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadVaccines();
  }, []);

  const handleVaccineSelect = (vaccineName) => {
    const selected = vaccines.find(v => v.name === vaccineName);
    setSelectedVaccine(selected);
    setVaccine(prev => ({ ...prev, vaccine_name: vaccineName }));
  };

  const handleSave = () => {
    if (!vaccine.vaccine_name) {
      toast({
        title: "Dados incompletos",
        description: "Selecione uma vacina.",
        variant: "destructive"
      });
      return;
    }
    
    onSave(vaccine);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Vacina</DialogTitle>
          <DialogDescription>
            Cadastre uma nova vacina para o pet {pet?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="vaccine_name">Vacina *</Label>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select
                value={vaccine.vaccine_name}
                onValueChange={handleVaccineSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma vacina" />
                </SelectTrigger>
                <SelectContent>
                  {vaccines.map((v) => (
                    <SelectItem key={v.id} value={v.name}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="application_date">Data da Aplicação</Label>
            <Input
              id="application_date"
              type="date"
              value={vaccine.application_date}
              onChange={(e) => setVaccine({ ...vaccine, application_date: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="next_dose_date">Data da Próxima Dose</Label>
            <Input
              id="next_dose_date"
              type="date"
              value={vaccine.next_dose_date}
              onChange={(e) => setVaccine({ ...vaccine, next_dose_date: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="batch_number">Lote</Label>
            <Input
              id="batch_number"
              value={vaccine.batch_number}
              onChange={(e) => setVaccine({ ...vaccine, batch_number: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="veterinarian">Veterinário Responsável</Label>
            <Input
              id="veterinarian"
              value={vaccine.veterinarian}
              onChange={(e) => setVaccine({ ...vaccine, veterinarian: e.target.value })}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MedicationModal({ open, onOpenChange, pet, onSave }) {
  const [isLoading, setIsLoading] = useState(true);
  const [medications, setMedications] = useState([]);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [medication, setMedication] = useState({
    medication_name: "",
    dosage: "",
    frequency: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: ""
  });

  useEffect(() => {
    const loadMedications = async () => {
      try {
        const tenantId = localStorage.getItem('current_tenant');
        const medicationsList = await Medication.filter({ tenant_id: tenantId });
        setMedications(medicationsList);
      } catch (error) {
        console.error("Erro ao carregar medicamentos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de medicamentos.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMedications();
  }, []);

  const handleMedicationSelect = (medicationName) => {
    const selected = medications.find(m => m.name === medicationName);
    setSelectedMedication(selected);
    setMedication(prev => ({
      ...prev,
      medication_name: medicationName,
      presentation: selected?.presentation || ""
    }));
  };

  const handleSave = () => {
    if (!medication.medication_name) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um medicamento.",
        variant: "destructive"
      });
      return;
    }
    
    onSave(medication);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Medicamento</DialogTitle>
          <DialogDescription>
            Cadastre um novo medicamento para o pet {pet?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="medication_name">Medicamento *</Label>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select
                value={medication.medication_name}
                onValueChange={handleMedicationSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um medicamento" />
                </SelectTrigger>
                <SelectContent>
                  {medications.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name} - {m.concentration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {selectedMedication && (
            <div className="grid gap-2">
              <Label>Apresentação</Label>
              <div className="text-sm text-gray-500">
                {selectedMedication.presentation === "tablet" ? "Comprimido" :
                 selectedMedication.presentation === "capsule" ? "Cápsula" :
                 selectedMedication.presentation === "liquid" ? "Líquido" :
                 selectedMedication.presentation === "injection" ? "Injeção" :
                 selectedMedication.presentation === "cream" ? "Creme" :
                 selectedMedication.presentation === "ointment" ? "Pomada" :
                 selectedMedication.presentation}
              </div>
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="dosage">Dosagem</Label>
            <Input
              id="dosage"
              value={medication.dosage}
              onChange={(e) => setMedication({ ...medication, dosage: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="frequency">Frequência</Label>
            <Input
              id="frequency"
              value={medication.frequency}
              onChange={(e) => setMedication({ ...medication, frequency: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Data de Início</Label>
              <Input
                id="start_date"
                type="date"
                value={medication.start_date}
                onChange={(e) => setMedication({ ...medication, start_date: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="end_date">Data de Término</Label>
              <Input
                id="end_date"
                type="date"
                value={medication.end_date}
                onChange={(e) => setMedication({ ...medication, end_date: e.target.value })}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllergyModal({ open, onOpenChange, pet, onSave }) {
  const [isLoading, setIsLoading] = useState(true);
  const [allergies, setAllergies] = useState([]);
  const [selectedAllergy, setSelectedAllergy] = useState(null);
  const [allergyName, setAllergyName] = useState("");

  useEffect(() => {
    const loadAllergies = async () => {
      try {
        const tenantId = localStorage.getItem('current_tenant');
        const allergiesList = await Allergy.filter({ tenant_id: tenantId });
        setAllergies(allergiesList);
      } catch (error) {
        console.error("Erro ao carregar alergias:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de alergias.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAllergies();
  }, []);

  const handleAllergySelect = (name) => {
    const selected = allergies.find(a => a.name === name);
    setSelectedAllergy(selected);
    setAllergyName(name);
  };

  const handleSave = () => {
    if (!allergyName.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Selecione uma alergia.",
        variant: "destructive"
      });
      return;
    }
    
    onSave(allergyName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Alergia</DialogTitle>
          <DialogDescription>
            Cadastre uma nova alergia para o pet {pet?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="allergy_name">Alergia *</Label>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select
                value={allergyName}
                onValueChange={handleAllergySelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma alergia" />
                </SelectTrigger>
                <SelectContent>
                  {allergies.map((a) => (
                    <SelectItem key={a.id} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedAllergy && (
            <div className="space-y-2">
              <div>
                <Label>Tipo</Label>
                <div className="text-sm text-gray-500">
                  {selectedAllergy.type === "food" ? "Alimentar" :
                   selectedAllergy.type === "medication" ? "Medicamento" :
                   selectedAllergy.type === "environmental" ? "Ambiental" :
                   selectedAllergy.type === "other" ? "Outros" :
                   selectedAllergy.type}
                </div>
              </div>
              
              {selectedAllergy.symptoms && selectedAllergy.symptoms.length > 0 && (
                <div>
                  <Label>Sintomas Comuns</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedAllergy.symptoms.map((symptom, index) => (
                      <Badge key={index} variant="outline">{symptom}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedAllergy.recommendations && (
                <div>
                  <Label>Recomendações</Label>
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedAllergy.recommendations}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryModal({ open, onOpenChange, clinicalHistory, onSave }) {
  const [history, setHistory] = useState(clinicalHistory || "");

  const handleSave = () => {
    onSave(history);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Histórico Clínico</DialogTitle>
          <DialogDescription>
            Visualize ou edite o histórico clínico completo
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="clinical_history">Histórico</Label>
            <Textarea
              id="clinical_history"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              rows={10}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClinicalDataTab({ pet }) {
  const [isLoading, setIsLoading] = useState(true);
  const [clinicalData, setClinicalData] = useState(null);
  const [error, setError] = useState(null);
  
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const loadClinicalData = async () => {
    if (!pet?.id) return;
    
    try {
      const tenantId = localStorage.getItem('current_tenant');
      
      const data = await PetClinicalData.filter({
        pet_id: pet.id,
        tenant_id: tenantId
      });

      if (data && data.length > 0) {
        setClinicalData(data[0]);
      } else {
        const newClinicalData = {
          pet_id: pet.id,
          tenant_id: tenantId,
          vaccination_history: [],
          current_medications: [],
          known_allergies: [],
          clinical_notes: "",
          clinical_history: ""
        };
        
        const created = await PetClinicalData.create(newClinicalData);
        setClinicalData(created);
      }
    } catch (error) {
      console.error("Erro ao carregar dados clínicos:", error);
      setError(error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados clínicos do pet.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pet?.id) {
      loadClinicalData();
    }
  }, [pet?.id]);

  const handleAddVaccine = async (newVaccine) => {
    try {
      if (!clinicalData) return;

      const updatedHistory = [
        ...(clinicalData.vaccination_history || []),
        newVaccine
      ];

      const updated = await PetClinicalData.update(clinicalData.id, {
        vaccination_history: updatedHistory
      });

      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Vacina adicionada com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao adicionar vacina:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a vacina.",
        variant: "destructive"
      });
    }
  };

  const handleAddMedication = async (newMedication) => {
    try {
      if (!clinicalData) return;

      const updatedMedications = [
        ...(clinicalData.current_medications || []),
        newMedication
      ];

      const updated = await PetClinicalData.update(clinicalData.id, {
        current_medications: updatedMedications
      });

      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Medicamento adicionado com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao adicionar medicamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o medicamento.",
        variant: "destructive"
      });
    }
  };

  const handleAddAllergy = async (newAllergy) => {
    try {
      if (!clinicalData) return;

      const updatedAllergies = [
        ...(clinicalData.known_allergies || []),
        newAllergy
      ];

      const updated = await PetClinicalData.update(clinicalData.id, {
        known_allergies: updatedAllergies
      });

      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Alergia adicionada com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao adicionar alergia:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a alergia.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateHistory = async (updatedHistory) => {
    try {
      if (!clinicalData) return;

      const updated = await PetClinicalData.update(clinicalData.id, {
        clinical_history: updatedHistory
      });

      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Histórico clínico atualizado com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao atualizar histórico:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o histórico clínico.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveVaccine = async (index) => {
    try {
      if (!clinicalData) return;
      
      const updatedHistory = [...(clinicalData.vaccination_history || [])];
      updatedHistory.splice(index, 1);
      
      const updated = await PetClinicalData.update(clinicalData.id, {
        vaccination_history: updatedHistory
      });
      
      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Vacina removida com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao remover vacina:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a vacina.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMedication = async (index) => {
    try {
      if (!clinicalData) return;
      
      const updatedMedications = [...(clinicalData.current_medications || [])];
      updatedMedications.splice(index, 1);
      
      const updated = await PetClinicalData.update(clinicalData.id, {
        current_medications: updatedMedications
      });
      
      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Medicamento removido com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao remover medicamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o medicamento.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveAllergy = async (index) => {
    try {
      if (!clinicalData) return;
      
      const updatedAllergies = [...(clinicalData.known_allergies || [])];
      updatedAllergies.splice(index, 1);
      
      const updated = await PetClinicalData.update(clinicalData.id, {
        known_allergies: updatedAllergies
      });
      
      setClinicalData(updated);
      
      toast({
        title: "Sucesso",
        description: "Alergia removida com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao remover alergia:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a alergia.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Erro ao carregar dados clínicos. Por favor, tente novamente.
        <Button variant="outline" onClick={loadClinicalData} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Tabs defaultValue="vaccines" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vaccines">Vacinas</TabsTrigger>
          <TabsTrigger value="medications">Medicamentos</TabsTrigger>
          <TabsTrigger value="allergies">Alergias</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="vaccines">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de Vacinas</CardTitle>
              <Button size="sm" onClick={() => setShowVaccineModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Vacina
              </Button>
            </CardHeader>
            <CardContent>
              {(!clinicalData?.vaccination_history || clinicalData.vaccination_history.length === 0) ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma vacina registrada.
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicalData.vaccination_history.map((vaccine, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{vaccine.vaccine_name}</p>
                        <p className="text-sm text-gray-500">
                          Aplicada em: {format(new Date(vaccine.application_date), 'dd/MM/yyyy')}
                        </p>
                        {vaccine.next_dose_date && (
                          <p className="text-sm text-gray-500">
                            Próxima dose: {format(new Date(vaccine.next_dose_date), 'dd/MM/yyyy')}
                          </p>
                        )}
                        {vaccine.veterinarian && (
                          <p className="text-sm text-gray-500">
                            Veterinário: {vaccine.veterinarian}
                          </p>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveVaccine(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Medicamentos</CardTitle>
              <Button size="sm" onClick={() => setShowMedicationModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Medicamento
              </Button>
            </CardHeader>
            <CardContent>
              {(!clinicalData?.current_medications || clinicalData.current_medications.length === 0) ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum medicamento registrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicalData.current_medications.map((medication, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{medication.medication_name}</p>
                        {medication.dosage && (
                          <p className="text-sm text-gray-500">
                            Dosagem: {medication.dosage}
                          </p>
                        )}
                        {medication.frequency && (
                          <p className="text-sm text-gray-500">
                            Frequência: {medication.frequency}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Período: {format(new Date(medication.start_date), 'dd/MM/yyyy')}
                          {medication.end_date && ` até ${format(new Date(medication.end_date), 'dd/MM/yyyy')}`}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveMedication(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allergies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Alergias Conhecidas</CardTitle>
              <Button size="sm" onClick={() => setShowAllergyModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Alergia
              </Button>
            </CardHeader>
            <CardContent>
              {(!clinicalData?.known_allergies || clinicalData.known_allergies.length === 0) ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma alergia registrada.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {clinicalData.known_allergies.map((allergy, index) => (
                    <div key={index} className="flex items-center bg-red-100 text-red-800 rounded-full px-3 py-1">
                      <span>{allergy}</span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-5 w-5 ml-1"
                        onClick={() => handleRemoveAllergy(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico Clínico</CardTitle>
              <Button size="sm" onClick={() => setShowHistoryModal(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Ver Completo
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-gray-50">
                {clinicalData?.clinical_history ? (
                  <div className="whitespace-pre-wrap line-clamp-5">
                    {clinicalData.clinical_history}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Nenhum histórico clínico registrado.
                  </div>
                )}
                {clinicalData?.clinical_history && clinicalData.clinical_history.length > 300 && (
                  <div className="mt-2 text-center">
                    <Button 
                      variant="link" 
                      className="text-sm"
                      onClick={() => setShowHistoryModal(true)}
                    >
                      Ver histórico completo
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <VaccineModal 
        open={showVaccineModal} 
        onOpenChange={setShowVaccineModal} 
        pet={pet}
        onSave={handleAddVaccine}
      />
      
      <MedicationModal 
        open={showMedicationModal} 
        onOpenChange={setShowMedicationModal} 
        pet={pet}
        onSave={handleAddMedication}
      />
      
      <AllergyModal 
        open={showAllergyModal} 
        onOpenChange={setShowAllergyModal} 
        pet={pet}
        onSave={handleAddAllergy}
      />
      
      <HistoryModal 
        open={showHistoryModal} 
        onOpenChange={setShowHistoryModal} 
        clinicalHistory={clinicalData?.clinical_history}
        onSave={handleUpdateHistory}
      />
    </div>
  );
}
