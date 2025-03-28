import React, { useState } from "react";
import { Customer } from "@/api/entities";
import { Pet } from "@/api/entities";
import { UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Camera, 
  Upload, 
  FileText, 
  Loader2, 
  AlertTriangle,
  Check,
  CircleX,
  User,
  Smartphone,
  Mail,
  MapPin,
  FilePlus,
  Edit
} from "lucide-react";

export default function CustomerOCRForm({ onSuccess, onCancel, trialId }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [ocrSuccess, setOcrSuccess] = useState(null);
  const [customerData, setCustomerData] = useState({
    full_name: "",
    document: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    notes: "",
    trial_id: trialId,
    pets: [{
      name: "",
      species: "dog",
      breed: "",
      birth_date: "",
      gender: "male",
      trial_id: trialId
    }]
  });
  
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  const startCamera = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error);
      toast({
        title: "Erro ao acessar a câmera",
        description: "Verifique se você concedeu permissão para o uso da câmera.",
        variant: "destructive"
      });
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  const captureImage = () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      
      // Stop the camera
      stopCamera();
      
      // Process the captured image
      await processFile(file);
    }, 'image/jpeg', 0.9);
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      await processFile(file);
    }
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    setOcrSuccess(null);
    setExtractedData(null);

    try {
      // Upload the file first
      const { file_url } = await UploadFile({ file });

      // Define the schema for customer and pet extraction
      const extractionSchema = {
        type: "object",
        properties: {
          customer: {
            type: "object",
            properties: {
              full_name: { type: "string" },
              document: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
              state: { type: "string" }
            }
          },
          pet: {
            type: "object",
            properties: {
              name: { type: "string" },
              species: { type: "string" },
              breed: { type: "string" },
              birth_date: { type: "string" },
              gender: { type: "string" }
            }
          }
        }
      };

      // Extract data using OCR
      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === "success" && result.output) {
        setExtractedData(result.output);
        setOcrSuccess(true);
        
        // Update the form with extracted data
        const newCustomerData = { ...customerData };
        
        if (result.output.customer) {
          const customer = result.output.customer;
          newCustomerData.full_name = customer.full_name || "";
          newCustomerData.document = customer.document || "";
          newCustomerData.phone = customer.phone || "";
          newCustomerData.email = customer.email || "";
          newCustomerData.address = customer.address || "";
          newCustomerData.city = customer.city || "";
          newCustomerData.state = customer.state || "";
        }
        
        if (result.output.pet) {
          const pet = result.output.pet;
          newCustomerData.pets[0].name = pet.name || "";
          newCustomerData.pets[0].species = validateSpecies(pet.species) || "dog";
          newCustomerData.pets[0].breed = pet.breed || "";
          newCustomerData.pets[0].birth_date = pet.birth_date || "";
          newCustomerData.pets[0].gender = validateGender(pet.gender) || "male";
        }
        
        setCustomerData(newCustomerData);
      } else {
        setOcrSuccess(false);
        toast({
          title: "Extração de dados incompleta",
          description: "Não foi possível extrair todos os dados. Por favor, preencha manualmente.",
          variant: "warning"
        });
      }
    } catch (error) {
      console.error("Erro ao processar OCR:", error);
      setOcrSuccess(false);
      toast({
        title: "Erro ao processar OCR",
        description: "Ocorreu um erro ao tentar extrair os dados da imagem.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validateSpecies = (species) => {
    const validSpecies = ["dog", "cat", "bird", "rodent", "reptile", "other"];
    if (!species) return null;
    
    const lowerSpecies = species.toLowerCase();
    if (lowerSpecies.includes("cachorro") || lowerSpecies.includes("dog")) return "dog";
    if (lowerSpecies.includes("gato") || lowerSpecies.includes("cat")) return "cat";
    if (lowerSpecies.includes("ave") || lowerSpecies.includes("pássaro") || lowerSpecies.includes("bird")) return "bird";
    if (lowerSpecies.includes("roedor") || lowerSpecies.includes("rodent")) return "rodent";
    if (lowerSpecies.includes("reptil") || lowerSpecies.includes("reptile")) return "reptile";
    
    return "other";
  };

  const validateGender = (gender) => {
    if (!gender) return null;
    
    const lowerGender = gender.toLowerCase();
    if (lowerGender.includes("macho") || lowerGender.includes("male")) return "male";
    if (lowerGender.includes("fêmea") || lowerGender.includes("female")) return "female";
    
    return "male";
  };

  const handleInputChange = (field, value) => {
    setCustomerData({
      ...customerData,
      [field]: value
    });
  };

  const handlePetChange = (field, value) => {
    const updatedPets = [...customerData.pets];
    updatedPets[0] = {
      ...updatedPets[0],
      [field]: value
    };
    
    setCustomerData({
      ...customerData,
      pets: updatedPets
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create the customer
      const newCustomer = await Customer.create({
        full_name: customerData.full_name,
        document: customerData.document,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
        city: customerData.city,
        state: customerData.state,
        notes: customerData.notes,
        trial_id: trialId
      });

      // Create the pet if name is provided
      if (customerData.pets[0].name) {
        await Pet.create({
          ...customerData.pets[0],
          owner_id: newCustomer.id,
          trial_id: trialId
        });
      }

      toast({
        title: "Cliente cadastrado com sucesso",
        description: "Os dados foram salvos com sucesso!",
        variant: "success"
      });

      // Save OCR statistics
      saveOCRStatistics({
        success: ocrSuccess === true,
        processing_time: 0, // Would track actual processing time in a real app
        file_type: uploadedFile ? uploadedFile.type : null
      });

      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast({
        title: "Erro ao cadastrar cliente",
        description: "Não foi possível salvar os dados. Por favor, tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveOCRStatistics = async (stats) => {
    try {
      // In a real application, you would save these statistics to your database
      console.log("OCR Statistics:", stats);
    } catch (error) {
      console.error("Error saving OCR statistics:", error);
    }
  };

  return (
    <div className="space-y-6">
      {!extractedData && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="upload">Upload de Documento</TabsTrigger>
            <TabsTrigger value="camera">Usar Câmera</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="flex justify-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 w-full max-w-md text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="space-y-4">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-64 mx-auto object-contain"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPreviewUrl(null);
                        setUploadedFile(null);
                      }}
                    >
                      Escolher outra imagem
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <Button onClick={() => fileInputRef.current?.click()}>
                        Fazer upload da ficha cadastral
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Formatos suportados: JPG, PNG, PDF
                    </p>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="camera" className="space-y-4">
            <div className="flex justify-center">
              {isCapturing ? (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden w-full max-w-md">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={stopCamera}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={captureImage}>
                      Capturar Imagem
                    </Button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-64 mx-auto object-contain"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setPreviewUrl(null);
                      setUploadedFile(null);
                    }}
                  >
                    Capturar novamente
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 w-full max-w-md text-center">
                  <Camera className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <Button onClick={startCamera}>
                      Ativar Câmera
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Posicione a ficha cadastral bem iluminada e centralizada
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {isProcessing && (
        <div className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-center font-medium">Processando o documento...</p>
          <p className="text-center text-sm text-gray-500">Estamos extraindo as informações da ficha cadastral</p>
        </div>
      )}

      {extractedData && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <FilePlus className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-medium text-blue-700">Dados extraídos via OCR</h3>
              <p className="text-sm text-blue-600">
                {ocrSuccess === true 
                  ? "Os dados foram extraídos com sucesso. Por favor, verifique e corrija se necessário."
                  : "Alguns dados não puderam ser extraídos automaticamente. Por favor, complete o formulário."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                Dados do Cliente
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  value={customerData.full_name}
                  onChange={(e) => handleInputChange("full_name", e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document">CPF/Documento</Label>
                <Input
                  id="document"
                  value={customerData.document}
                  onChange={(e) => handleInputChange("document", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={customerData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={customerData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={customerData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={customerData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                  <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"></path>
                  <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
                  <path d="M8 14v.5"></path>
                  <path d="M16 14v.5"></path>
                  <path d="M11.25 16.25h1.5L12 17l-.75-.75Z"></path>
                  <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"></path>
                </svg>
                Dados do Pet
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="pet_name">Nome do Pet</Label>
                <Input
                  id="pet_name"
                  value={customerData.pets[0].name}
                  onChange={(e) => handlePetChange("name", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pet_species">Espécie</Label>
                <Select
                  value={customerData.pets[0].species}
                  onValueChange={(value) => handlePetChange("species", value)}
                >
                  <SelectTrigger id="pet_species">
                    <SelectValue placeholder="Selecione a espécie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">Cachorro</SelectItem>
                    <SelectItem value="cat">Gato</SelectItem>
                    <SelectItem value="bird">Ave</SelectItem>
                    <SelectItem value="rodent">Roedor</SelectItem>
                    <SelectItem value="reptile">Réptil</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pet_breed">Raça</Label>
                <Input
                  id="pet_breed"
                  value={customerData.pets[0].breed}
                  onChange={(e) => handlePetChange("breed", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pet_birth_date">Data de Nascimento</Label>
                <Input
                  id="pet_birth_date"
                  type="date"
                  value={customerData.pets[0].birth_date}
                  onChange={(e) => handlePetChange("birth_date", e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pet_gender">Sexo</Label>
                <Select
                  value={customerData.pets[0].gender}
                  onValueChange={(value) => handlePetChange("gender", value)}
                >
                  <SelectTrigger id="pet_gender">
                    <SelectValue placeholder="Selecione o sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Macho</SelectItem>
                    <SelectItem value="female">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Cliente"
              )}
            </Button>
          </div>
        </form>
      )}

      {(!extractedData && !isProcessing && previewUrl) && (
        <div className="flex justify-end">
          <Button
            onClick={() => processFile(uploadedFile)}
            disabled={!uploadedFile}
          >
            Processar Documento
          </Button>
        </div>
      )}
    </div>
  );
}