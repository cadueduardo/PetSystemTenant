import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function OCRPerformanceChart({ statistics }) {
  const data = useMemo(() => {
    if (!statistics || statistics.length === 0) {
      return [];
    }

    // Para simplicidade, agrupamos por dia
    const processedByDate = {};
    
    statistics.forEach(stat => {
      const date = new Date(stat.processed_at);
      const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      
      if (!processedByDate[dateKey]) {
        processedByDate[dateKey] = {
          date: dateKey,
          total: 0,
          successful: 0,
          avgTime: 0,
          totalTime: 0
        };
      }
      
      processedByDate[dateKey].total += 1;
      if (stat.success) {
        processedByDate[dateKey].successful += 1;
      }
      processedByDate[dateKey].totalTime += (stat.processing_time_ms || 0);
    });
    
    // Calcular média e formatar para o gráfico
    return Object.values(processedByDate)
      .map(day => ({
        ...day,
        avgTime: day.totalTime / day.total / 1000, // em segundos
        successRate: (day.successful / day.total) * 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [statistics]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">
            <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>
            Total: {payload[0].value}
          </p>
          <p className="text-sm">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span>
            Sucesso: {payload[1].value.toFixed(0)}%
          </p>
          <p className="text-sm">
            <span className="inline-block w-3 h-3 bg-purple-500 rounded-full mr-1"></span>
            Tempo médio: {payload[2].value.toFixed(1)}s
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
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" orientation="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar yAxisId="left" dataKey="total" name="Total Processado" fill="#4f46e5" />
        <Bar yAxisId="right" dataKey="successRate" name="Taxa de Sucesso (%)" fill="#10b981" />
        <Bar yAxisId="left" dataKey="avgTime" name="Tempo Médio (s)" fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  );
}