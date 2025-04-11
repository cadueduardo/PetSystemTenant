import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY = 'prescriptionTemplates';

// Helper function to get templates from localStorage
const getTemplates = () => {
  try {
    const templatesJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    return templatesJson ? JSON.parse(templatesJson) : [];
  } catch (error) {
    console.error("Error reading prescription templates from localStorage:", error);
    return [];
  }
};

// Helper function to save templates to localStorage
const saveTemplates = (templates) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Error saving prescription templates to localStorage:", error);
  }
};

// --- Public API --- //

/**
 * Lists all prescription templates.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of template objects.
 */
export const list = async () => {
  console.log("[PrescriptionTemplateService] Listing templates...");
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 150));
  const templates = getTemplates();
  console.log(`[PrescriptionTemplateService] Found ${templates.length} templates.`);
  return templates;
};

/**
 * Gets a specific prescription template by ID.
 * @param {string} id The ID of the template to retrieve.
 * @returns {Promise<Object|null>} A promise that resolves with the template object or null if not found.
 */
export const get = async (id) => {
    console.log(`[PrescriptionTemplateService] Getting template with ID: ${id}`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async
    const templates = getTemplates();
    const template = templates.find(t => t.id === id);
    console.log(`[PrescriptionTemplateService] Template found:`, template);
    return template || null;
};


/**
 * Saves a prescription template (creates if no ID, updates if ID exists).
 * @param {Object} templateData The template data to save. Should include 'name', 'type', 'items', 'observations'. An 'id' will be added if new.
 * @returns {Promise<Object>} A promise that resolves with the saved template object (including its ID).
 */
export const save = async (templateData) => {
  console.log("[PrescriptionTemplateService] Saving template:", templateData);
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate async
  const templates = getTemplates();
  let savedTemplate;

  if (templateData.id) {
    // Update existing
    const index = templates.findIndex(t => t.id === templateData.id);
    if (index !== -1) {
      templates[index] = { ...templates[index], ...templateData, updatedAt: new Date().toISOString() };
      savedTemplate = templates[index];
      console.log("[PrescriptionTemplateService] Template updated.");
    } else {
      // ID provided but not found - treat as new? Or throw error?
      // For simplicity, let's add as new but log a warning.
      console.warn(`[PrescriptionTemplateService] Template with ID ${templateData.id} not found for update. Adding as new.`);
      savedTemplate = { ...templateData, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      templates.push(savedTemplate);
    }
  } else {
    // Create new
    savedTemplate = { ...templateData, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    templates.push(savedTemplate);
    console.log("[PrescriptionTemplateService] New template created with ID:", savedTemplate.id);
  }

  saveTemplates(templates);
  return savedTemplate;
};

/**
 * Deletes a prescription template by ID.
 * @param {string} id The ID of the template to delete.
 * @returns {Promise<boolean>} A promise that resolves with true if deletion was successful, false otherwise.
 */
export const del = async (id) => { // Renamed to 'del' as 'delete' is a reserved keyword
  console.log(`[PrescriptionTemplateService] Deleting template with ID: ${id}`);
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async
  let templates = getTemplates();
  const initialLength = templates.length;
  templates = templates.filter(t => t.id !== id);

  if (templates.length < initialLength) {
    saveTemplates(templates);
    console.log(`[PrescriptionTemplateService] Template ${id} deleted successfully.`);
    return true;
  } else {
    console.warn(`[PrescriptionTemplateService] Template with ID ${id} not found for deletion.`);
    return false;
  }
};

// Optional: Add some initial mock data if localStorage is empty
const initializeMockData = () => {
    if (getTemplates().length === 0) {
        console.log("[PrescriptionTemplateService] Initializing with more mock data...");
        const mockTemplates = [
            // --- Medicamentos --- 
            // Anti-inflamatórios
            {
                id: uuidv4(),
                name: "AINE - Meloxicam Cães",
                type: "Comum",
                items: [
                    { itemName: "Meloxicam 0.5mg", details: "Dose inicial 0,2mg/kg no primeiro dia, depois 0,1mg/kg a cada 24h por 5-7 dias", isControlled: false, usage: "externo" },
                ],
                observations: "Administrar com alimento. Monitorar função renal/gástrica em tratamentos longos.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            {
                id: uuidv4(),
                name: "Corticoide - Prednisolona",
                type: "Comum",
                items: [
                    { itemName: "Prednisolona 5mg", details: "0.5-1mg/kg a cada 12h ou 24h, reduzir gradualmente", isControlled: false, usage: "externo" },
                ],
                observations: "Risco de efeitos colaterais com uso prolongado. Administrar preferencialmente pela manhã.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            // Analgésicos
            {
                id: uuidv4(),
                name: "Analgésico - Dipirona",
                type: "Comum",
                items: [
                    { itemName: "Dipirona Sódica 500mg/mL Gotas", details: "1 gota/kg a cada 6-8h", isControlled: false, usage: "externo" },
                ],
                observations: "Usar com cautela em felinos. Monitorar sinais de hipotensão.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            {
                id: uuidv4(),
                name: "Opioide Leve - Tramadol",
                type: "Controle Especial", // Needs controlled prescription
                items: [
                    { itemName: "Cloridrato de Tramadol 50mg", details: "2-4mg/kg a cada 8-12h", isControlled: true, usage: "externo" },
                ],
                observations: "Pode causar sedação ou constipação. Receituário de Controle Especial requerido.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
             // Antiparasitários
            {
                id: uuidv4(),
                name: "Antipulgas/Carrapatos Oral Mensal",
                type: "Comum",
                items: [
                    { itemName: "Simparic (Sarolaner) - Escolher peso adequado", details: "1 comprimido mastigável a cada 30-35 dias", isControlled: false, usage: "externo" },
                ],
                observations: "Verificar peso do animal para dose correta. Para cães.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
             {
                id: uuidv4(),
                name: "Vermífugo Amplo Espectro",
                type: "Comum",
                items: [
                    { itemName: "Drontal Plus (Praziquantel, Pamoato Pirantel, Febantel) - Escolher peso", details: "Dose única conforme peso, repetir após 15 dias se necessário", isControlled: false, usage: "externo" },
                ],
                observations: "Administrar conforme bula. Verificar peso do animal.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            // Psicotrópicos e Anticonvulsivantes
            {
                id: uuidv4(),
                name: "Anticonvulsivante - Fenobarbital",
                type: "Controle Especial",
                items: [
                    { itemName: "Fenobarbital 100mg", details: "2.5-5mg/kg a cada 12h. Ajustar dose conforme níveis séricos.", isControlled: true, usage: "externo" },
                ],
                observations: "Monitoramento de níveis séricos e função hepática essencial. Receituário de Controle Especial.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
             {
                id: uuidv4(),
                name: "Ansiolítico - Fluoxetina",
                type: "Controle Especial",
                items: [
                    { itemName: "Cloridrato de Fluoxetina 20mg", details: "Cães: 1-2mg/kg a cada 24h. Gatos: 0.5-1mg/kg a cada 24h.", isControlled: true, usage: "externo" },
                ],
                observations: "Efeito pode levar semanas. Não interromper abruptamente. Receituário de Controle Especial.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            // Sedativos e Anestésicos (Geralmente uso interno, mas pode ter prescrição pré)
            {
                id: uuidv4(),
                name: "Sedativo Leve Pré-Consulta",
                type: "Controle Especial",
                items: [
                    { itemName: "Acepromazina 10mg", details: "0.5-1mg/kg via oral, 1 hora antes da consulta/procedimento", isControlled: true, usage: "externo" }, // Uso externo prévio
                ],
                observations: "Risco de hipotensão. Usar com cautela em raças braquicefálicas e animais debilitados. Receituário.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            // Vacinas (Geralmente aplicadas na clínica, mas pode haver orientação)
            {
                id: uuidv4(),
                name: "Protocolo Vacinal Filhote Cão (Exemplo)",
                type: "Procedimento/Orientação",
                items: [
                    { itemName: "Vacina Polivalente (V8/V10)", details: "1ª dose: 6-8 semanas. Reforços a cada 3-4 semanas até 16 semanas.", isControlled: false, usage: "interno" },
                    { itemName: "Vacina Antirrábica", details: "Dose única a partir de 12 semanas.", isControlled: false, usage: "interno" },
                    { itemName: "Vacina contra Tosse dos Canis", details: "Intranasal ou injetável, conforme recomendação.", isControlled: false, usage: "interno" },
                ],
                observations: "Esquema pode variar. Manter carteira de vacinação atualizada. Reforço anual recomendado.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            // Suplementos e Nutrição Clínica
            {
                id: uuidv4(),
                name: "Suplemento Articular Condroprotetor",
                type: "Nutricional",
                items: [
                    { itemName: "Condroton (Sulfato Condroitina, Glucosamina)", details: "Administrar conforme peso e indicação na bula", isControlled: false, usage: "externo" },
                ],
                observations: "Uso contínuo para melhores resultados em casos de artrose.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            {
                id: uuidv4(),
                name: "Dieta Renal Cães",
                type: "Nutricional",
                items: [
                    { itemName: "Ração Royal Canin Renal Canine (ou similar)", details: "Oferecer como única fonte de alimento", isControlled: false, usage: "externo" },
                ],
                observations: "Restrição de fósforo e proteína. Acesso constante à água fresca.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            // --- Outras Categorias --- 
            {
                id: uuidv4(),
                name: "Instruções Pós-Limpeza de Tártaro",
                type: "Procedimento/Orientação",
                items: [
                    { itemName: "Clorexidina Solução Oral 0,12%", details: "Bochechar/Aplicar na gengiva 2x ao dia por 7 dias", isControlled: false, usage: "externo" },
                    { itemName: "Escovação Dental Diária", details: "Iniciar após período de recuperação com pasta de dente veterinária", isControlled: false, usage: "externo" },
                ],
                observations: "Oferecer dieta mais macia nos primeiros dias. Observar dificuldade de alimentação.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            {
                id: uuidv4(),
                name: "Tratamento Otite Externa Simples",
                type: "Comum",
                items: [
                    { itemName: "Limpador Auricular (Ex: Epiotic Spherulites)", details: "Limpar ouvidos 1x ao dia antes da medicação", isControlled: false, usage: "externo" },
                    { itemName: "Otomax / Auritop (verificar princípio ativo)", details: "Aplicar X gotas em cada ouvido a cada 12h por 7-10 dias", isControlled: false, usage: "externo" },
                ],
                observations: "Retornar para reavaliação após o tratamento.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
            {
                id: uuidv4(),
                name: "Fluidoterapia SC (Hidratação Leve)",
                type: "Procedimento/Orientação",
                items: [
                    { itemName: "Ringer Lactato Solução Injetável", details: "Administrar 10-20 mL/kg via subcutânea a cada 12-24h", isControlled: false, usage: "interno" }, // Pode ser orientação para casa
                ],
                observations: "Monitorar formação de edema no local da aplicação. Técnica deve ser ensinada ao tutor.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
             {
                id: uuidv4(),
                name: "Modelo Padrão Consulta Clínica",
                type: "Comum",
                items: [
                    { itemName: "", details: "", isControlled: false, usage: "externo" },
                ],
                observations: "Modelo base para iniciar prescrições comuns.",
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
        ];
        saveTemplates(mockTemplates);
    }
};

initializeMockData(); 