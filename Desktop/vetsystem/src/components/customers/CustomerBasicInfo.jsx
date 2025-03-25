import React from "react";
import { Mail, Phone, MapPin, Info, User, CreditCard } from "lucide-react";

export default function CustomerBasicInfo({ customer }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <User className="w-4 h-4 text-gray-400" />
        <span>
          <span className="font-medium">Nome completo: </span>
          {customer.full_name}
        </span>
      </div>

      {customer.document && (
        <div className="flex items-center gap-3 text-sm">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span>
            <span className="font-medium">CPF: </span>
            {customer.document}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 text-sm">
        <Phone className="w-4 h-4 text-gray-400" />
        <span>
          <span className="font-medium">Telefone: </span>
          {customer.phone}
        </span>
      </div>

      {customer.email && (
        <div className="flex items-center gap-3 text-sm">
          <Mail className="w-4 h-4 text-gray-400" />
          <span>
            <span className="font-medium">Email: </span>
            {customer.email}
          </span>
        </div>
      )}

      {customer.address && (
        <div className="flex items-start gap-3 text-sm">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <span className="font-medium">Endereço: </span>
            <div>
              {customer.address}
              {customer.address_number && <span>, {customer.address_number}</span>}
              {customer.address_complement && <span> - {customer.address_complement}</span>}
              {customer.city && <span>, {customer.city}</span>}
              {customer.state && <span>/{customer.state}</span>}
              {customer.postal_code && <span> - CEP: {customer.postal_code}</span>}
            </div>
          </div>
        </div>
      )}

      {customer.notes && (
        <div className="flex items-start gap-3 text-sm">
          <Info className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <span className="font-medium">Observações: </span>
            <p className="mt-1 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}