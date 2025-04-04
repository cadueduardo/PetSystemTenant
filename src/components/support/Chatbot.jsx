import React, { useState, useEffect, useRef } from "react";
import { InvokeLLM } from "@/api/integrations";
import { SupportMessage } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquareMore, 
  Send, 
  X, 
  Loader2, 
  Bot, 
  User as UserIcon,
  ArrowRight
} from "lucide-react";

export default function Chatbot({ onClose, trialId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Obter email do usuário atual
    const getUserEmail = async () => {
      try {
        const userData = await User.me();
        setUserEmail(userData.email);
      } catch (error) {
        console.error("Erro ao obter dados do usuário:", error);
        setUserEmail("user@example.com");
      }
    };
    
    getUserEmail();
    
    // Adicionar mensagem de boas-vindas
    setMessages([
      {
        id: "welcome",
        message: "Olá! Sou o assistente virtual do PetSystem. Como posso ajudar você hoje?",
        is_from_chatbot: true,
        suggestions: [
          "Como agendar uma consulta?",
          "Como cadastrar um cliente?",
          "Como emitir um relatório?",
          "Problemas de acesso"
        ]
      }
    ]);

    // Focar no input
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    // Adicionar mensagem do usuário
    const userMessage = {
      message: text,
      is_from_chatbot: false
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Gerar resposta do chatbot
      const response = await InvokeLLM({
        prompt: text,
        add_context_from_internet: true
      });

      // Adicionar resposta do chatbot
      const botMessage = {
        message: response,
        is_from_chatbot: true
      };
      setMessages(prev => [...prev, botMessage]);

      // Salvar conversa - sem ticket_id (chatbot independente)
      await SupportMessage.create({
        trial_id: trialId,
        message: text,
        is_from_chatbot: false,
        sender_email: userEmail || "user@example.com"
      });

      await SupportMessage.create({
        trial_id: trialId,
        message: response,
        is_from_chatbot: true,
        sender_email: "chatbot@system"
      });
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      setMessages(prev => [...prev, {
        message: "Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.",
        is_from_chatbot: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-full max-w-md shadow-xl z-50">
      <CardHeader className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-lg">Assistente Virtual</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.is_from_chatbot ? "justify-start" : "justify-end"}`}
              >
                <div className={`flex items-start gap-2 max-w-[80%] ${message.is_from_chatbot ? "flex-row" : "flex-row-reverse"}`}>
                  <Avatar className="mt-0.5">
                    {message.is_from_chatbot ? (
                      <>
                        <AvatarFallback><Bot className="w-4 h-4" /></AvatarFallback>
                        <AvatarImage src="/bot-avatar.png" />
                      </>
                    ) : (
                      <>
                        <AvatarFallback><UserIcon className="w-4 h-4" /></AvatarFallback>
                        <AvatarImage src="/user-avatar.png" />
                      </>
                    )}
                  </Avatar>
                  <div>
                    <div
                      className={`rounded-lg p-3 ${
                        message.is_from_chatbot
                          ? "bg-gray-100 text-gray-900"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    </div>

                    {message.suggestions && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleSendMessage(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}