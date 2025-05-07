import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Para o status

// Definindo as props esperadas pelo componente
// export interface IntegrationCardProps {
//   icon?: React.ReactNode; // Elemento React para o ícone (ex: <IconComponent /> ou <img>)
//   title: string;
//   description: string;
//   statusText?: string;
//   statusVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; // Adicionando variantes de status
//   actionButtonText: string;
//   onActionClick: () => void;
//   comingSoon?: boolean; // Para integrações futuras
// }

const IntegrationCard = ({
  icon,
  title,
  description,
  statusText,
  statusVariant = "secondary", // Default para status
  actionButtonText,
  onActionClick,
  comingSoon = false,
}) => {
  return (
    <Card className="flex flex-col justify-between h-full"> {/* h-full para cards com mesma altura no grid */}
      <CardHeader>
        <div className="flex items-start gap-3 mb-2"> {/* items-start para alinhar ícone e título */}
          {icon && <div className="flex-shrink-0 w-10 h-10">{icon}</div>}
          <div className="flex-grow">
            <CardTitle>{title}</CardTitle>
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {statusText && !comingSoon && (
          <Badge variant={statusVariant}>{statusText}</Badge>
        )}
        {comingSoon && (
          <Badge variant="outline">Em Breve</Badge>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onActionClick} disabled={comingSoon} className="w-full"> {/* Botão com largura total */}
          {comingSoon ? "Em Breve" : actionButtonText}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default IntegrationCard; 