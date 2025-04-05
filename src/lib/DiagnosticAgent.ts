// src/lib/DiagnosticAgent.ts

interface SymptomDetails {
  followUpQuestions?: string[];
  potentialDiagnoses?: string[];
  keywords?: string[]; // Palavras-chave associadas a este detalhe/pergunta
}

// Simulação de Base de Conhecimento Veterinário
const veterinaryKnowledgeBase: { [key: string]: SymptomDetails } = {
  // Vômito
  VOMITO_GERAL: {
    followUpQuestions: ["Qual a frequência do vômito?", "Qual a cor/aspecto do vômito?", "Houve ingestão de corpo estranho ou algo diferente?", "O vômito ocorre após alimentação?"],
    keywords: ["vomito", "vômito", "vomitar", "regurgitar"],
  },
  VOMITO_FREQUENCIA: { // Ligado à pergunta "Qual a frequência?"
      followUpQuestions: ["É uma vez ao dia, várias vezes, só após comer?", "Há quanto tempo está vomitando assim?"],
      potentialDiagnoses: ["Gastroenterite Aguda", "Doença Metabólica (se crônico)"],
      keywords: ["frequencia", "frequente", "vezes", "constante"],
  },
  VOMITO_COR_ASPECTO: { // Ligado à pergunta "Qual a cor?"
      followUpQuestions: ["É amarelado/bilioso?", "Contém sangue (vivo ou digerido - borra de café)?", "Contém alimento não digerido?", "É espumoso?"],
      potentialDiagnoses: ["Refluxo Biliar", "Gastrite/Úlcera", "Obstrução", "Indigestão"],
      keywords: ["cor", "aspecto", "amarelo", "bile", "bilioso", "sangue", "vermelho", "escuro", "marrom", "comida", "alimento", "espuma", "espumoso"],
  },
  VOMITO_CORPO_ESTRANHO: {
      followUpQuestions: ["O pet tem histórico de comer objetos?", "Há acesso a lixo ou plantas tóxicas?"],
      potentialDiagnoses: ["Obstrução por Corpo Estranho", "Intoxicação"],
      keywords: ["comeu", "ingeriu", "objeto", "brinquedo", "plástico", "osso", "planta", "veneno", "lixo"],
  },
  VOMITO_POS_ALIMENTAR: {
       followUpQuestions: ["Ocorre imediatamente após comer ou horas depois?", "A quantidade é grande?"],
       potentialDiagnoses: ["Intolerância Alimentar", "Megaesôfago (se logo após)", "Gastrite"],
       keywords: ["após", "depois", "comer", "alimentar", "ração"],
  },

  // Coceira
  COCEIRA_GERAL: {
    followUpQuestions: ["Onde é a coceira principalmente?", "Qual a intensidade (0-10)?", "Há lesões na pele visíveis?", "Começou de repente ou foi gradual?"],
    keywords: ["coceira", "coçando", "prurido", "se coça"],
  },
  COCEIRA_LOCALIZACAO: {
      followUpQuestions: ["É nas orelhas, patas, base da cauda, barriga, generalizada?"],
      potentialDiagnoses: ["Otite (orelhas)", "Pododermatite (patas)", "DAPP (cauda)", "Atopia/Alergia Alimentar (barriga/generalizada)"],
      keywords: ["onde", "local", "lugar", "orelha", "ouvido", "pata", "pé", "cauda", "rabo", "costas", "dorso", "barriga", "corpo todo", "generalizada"],
  },
  COCEIRA_INTENSIDADE: {
       followUpQuestions: ["A coceira impede o pet de dormir ou comer?", "Está causando feridas?"],
       potentialDiagnoses: ["Sarna Sarcóptica (muito intensa)", "Alergia Aguda"],
       keywords: ["intensidade", "forte", "muita", "desesperado", "sem parar", "demais"],
  },
  COCEIRA_LESOES: {
      followUpQuestions: ["São falhas de pelo, vermelhidão, crostas, pústulas (bolinhas de pus), descamação?"],
      potentialDiagnoses: ["Piodermite", "Dermatofitose", "Sarna Demodécica", "Pênfigo"],
      keywords: ["lesão", "ferida", "vermelho", "falha", "pelo", "sem pelo", "caspa", "pele seca", "bolinha", "pus", "pus", "crosta"],
  },

   // Diarreia
   DIARREIA_GERAL: {
       followUpQuestions: ["Qual a consistência (pastosa, líquida)?", "Há sangue ou muco?", "Qual a frequência?", "Mudou a alimentação recentemente?"],
       keywords: ["diarreia", "fezes moles", "desarranjo", "intestino solto"],
   },
   DIARREIA_CONSISTENCIA: {
       followUpQuestions: ["É totalmente líquida, como água?"],
       potentialDiagnoses: ["Virose (Parvo/Cinomose)", "Giardíase", "Intoxicação Grave"],
       keywords: ["consistencia", "líquida", "água", "pastosa", "mole"],
   },
   DIARREIA_SANGUE_MUCO: {
       followUpQuestions: ["O sangue é vivo (vermelho brilhante) ou escuro (melena)?", "O muco é gelatinoso?"],
       potentialDiagnoses: ["Parasitose Intensa", "Colite", "Coronavírus/Parvovirose", "Doença Inflamatória Intestinal"],
       keywords: ["sangue", "vermelho", "escuro", "preto", "melena", "muco", "gosma", "gelatina"],
   },

  // Adicionar mais condições e detalhes aqui...
  VOMITO_CRONICO_TEMPO: { // Ligado à pergunta "Há quanto tempo..."
       followUpQuestions: ["Houve perda de peso recente?", "A condição geral (pelagem, atividade) piorou?", "Foi feito algum exame de sangue recente?"], // Perguntas Nível 3
       potentialDiagnoses: ["Doença Renal Crônica", "Doença Hepática", "Neoplasia Gástrica", "Doença Inflamatória Intestinal Crônica"],
       keywords: ["tempo", "meses", "semanas", "crônico", "muito tempo"], // Keywords para ligar à pergunta Nível 2
   },
};

export class DiagnosticAgent {
  private contextBuffer: string[] = [];
  private identifiedSymptoms = new Set<string>(); // Rastreia conceitos gerais identificados (ex: VOMITO_GERAL)
  private askedQuestions = new Set<string>(); // Rastreia perguntas já sugeridas para evitar repetição imediata

  analyzeText(text: string): { initialQuestions: string[], potentialDiagnoses: string[] } {
    const newTextLower = text.toLowerCase();
    this.contextBuffer.push(newTextLower);
    const fullContext = this.contextBuffer.join(' ');
    const initialQuestions = new Set<string>();
    const potentialDiagnoses = new Set<string>();

    // 1. Identificar sintomas gerais baseado em keywords no texto completo ou chunk novo
    for (const [key, details] of Object.entries(veterinaryKnowledgeBase)) {
      // Considera keywords gerais (ex: VOMITO_GERAL)
      if (key.endsWith('_GERAL')) {
        if (!this.identifiedSymptoms.has(key) && details.keywords?.some(kw => fullContext.includes(kw))) {
          // Adiciona apenas se ainda não foi identificado, baseado no contexto completo
          this.identifiedSymptoms.add(key);
        }
      }
      // Adiciona diagnósticos potenciais se keywords específicas do KB forem encontradas no contexto
      if (details.keywords?.some(kw => fullContext.includes(kw)) && details.potentialDiagnoses) {
         details.potentialDiagnoses.forEach(diag => potentialDiagnoses.add(diag));
      }
    }

    // 2. Gerar perguntas iniciais (nível 1) para sintomas gerais identificados
    this.identifiedSymptoms.forEach(symptomKey => {
      const details = veterinaryKnowledgeBase[symptomKey];
      details?.followUpQuestions?.forEach(q => {
          // Evita sugerir a mesma pergunta repetidamente logo em seguida
          if (!this.askedQuestions.has(q)) {
             initialQuestions.add(q);
             this.askedQuestions.add(q); // Marca como perguntada nesta rodada
          }
      });
    });

     // Limpa 'askedQuestions' periodicamente ou por algum critério para permitir que perguntas sejam sugeridas novamente mais tarde
     // (Lógica simplificada aqui: limpar a cada nova análise pode ser demais)
     // Exemplo: if (this.contextBuffer.length % 5 === 0) this.askedQuestions.clear();


    // 3. Sugerir diagnósticos gerais baseados no contexto
    // A lógica acima já adiciona diagnósticos se keywords específicas forem encontradas
    // Poderia ter uma lógica mais avançada aqui, combinando sintomas identificados, etc.

    return {
        initialQuestions: Array.from(initialQuestions),
        potentialDiagnoses: Array.from(potentialDiagnoses)
     };
  }

  getFollowUpQuestions(selectedQuestion: string): string[] {
    const followUps = new Set<string>();
    this.askedQuestions.add(selectedQuestion); // Marca a pergunta selecionada como "feita"

    // Encontra qual(is) entrada(s) da base de conhecimento contêm a pergunta selecionada
    // ou palavras-chave relacionadas a ela.
    const questionLower = selectedQuestion.toLowerCase();
    for (const details of Object.values(veterinaryKnowledgeBase)) {
        // Se a pergunta exata está listada como follow-up de um conceito anterior (menos útil aqui)
        // OU se as keywords da pergunta batem com keywords de uma entrada da KB
       if (details.keywords?.some(kw => questionLower.includes(kw))) {
           details.followUpQuestions?.forEach(q => {
               if (!this.askedQuestions.has(q)) {
                  followUps.add(q);
                  this.askedQuestions.add(q); // Marca como sugerida
               }
           });
           // Poderia adicionar diagnósticos ligados a esta pergunta específica também
       }
    }
     // Uma alternativa seria mapear explicitamente cada pergunta a uma chave do KB
     // Ex: "Qual a frequência do vômito?" -> mapeia para VOMITO_FREQUENCIA
     // Isso seria mais robusto.

    console.log(`Follow-ups para "${selectedQuestion}":`, Array.from(followUps));
    return Array.from(followUps);
  }

  suggestDiagnosesBasedOnContext(): string[] {
      const potentialDiagnoses = new Set<string>();
      const fullContext = this.contextBuffer.join(' ');

       // Reavalia todo o contexto contra a base de conhecimento
      for (const details of Object.values(veterinaryKnowledgeBase)) {
          if (details.keywords?.some(kw => fullContext.includes(kw)) && details.potentialDiagnoses) {
              details.potentialDiagnoses.forEach(diag => potentialDiagnoses.add(diag));
          }
      }
       // Poderia ter lógica mais complexa aqui, pontuando diagnósticos
       // baseados em quantos sintomas relacionados foram mencionados.

      console.log("Diagnósticos sugeridos pelo contexto:", Array.from(potentialDiagnoses));
      return Array.from(potentialDiagnoses);
  }


  clearContext(): void {
    this.contextBuffer = [];
    this.identifiedSymptoms.clear();
    this.askedQuestions.clear();
    console.log("Contexto do DiagnosticAgent limpo.");
  }

  getCurrentContext(): string {
    return this.contextBuffer.join(' ');
  }
} 