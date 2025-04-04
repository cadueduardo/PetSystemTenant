import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function OCRSuccessRateChart({ statistics }) {
  const data = useMemo(() => {
    if (!statistics || statistics.length === 0) {
      return [];
    }

    // Agrupar por tipo de arquivo
    const fileTypes = {};
    statistics.forEach(stat => {
      const fileType = stat.file_type 
        ? stat.file_type.split('/')[1]?.toUpperCase() || stat.file_type
        : "DESCONHECIDO";
      
      if (!fileTypes[fileType]) {
        fileTypes[fileType] = {
          total: 0,
          success: 0
        };
      }
      
      fileTypes[fileType].total += 1;
      if (stat.success) {
        fileTypes[fileType].success += 1;
      }
    });

    // Converter para o formato necessário para o gráfico
    return Object.entries(fileTypes).map(([fileType, counts]) => ({
      name: fileType,
      value: counts.total,
      successRate: (counts.success / counts.total) * 100
    }));
  }, [statistics]);

  const COLORS = ["#4f46e5", "#06b6d4", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899"];

  // Custom tooltip para mostrar taxa de sucesso
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm">Quantidade: {payload[0].value}</p>
          <p className="text-sm text-green-600">
            Taxa de sucesso: {payload[0].payload.successRate.toFixed(0)}%
          </p>
        </div>
      );
    }

    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Sem dados para exibir</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}