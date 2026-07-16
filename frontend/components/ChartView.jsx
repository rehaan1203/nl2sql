'use client';

import { useState, useMemo, useEffect } from 'react';
import { determineChartType } from '../lib/chartConfig';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { BarChart, LineChart, PieChart } from 'lucide-react';
import { useTheme } from 'next-themes';

ChartJS.register(...registerables);
ChartJS.defaults.font.family = 'Inter, system-ui, sans-serif';

export default function ChartView({ data }) {
  const [chartType, setChartType] = useState('bar');
  const [chartData, setChartData] = useState(null);
  const { theme, systemTheme } = useTheme();
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  useEffect(() => {
    if (data && data.length > 0) {
      const type = determineChartType(data);
      setChartType(type || 'bar');
    }
  }, [data]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const keys = Object.keys(data[0]);
    let labelKey = keys.find(k => typeof data[0][k] === 'string');
    if (!labelKey) labelKey = keys[0];

    const numKeys = keys.filter(k => typeof data[0][k] === 'number');

    if (numKeys.length === 0) return;

    const labels = data.map(row => row[labelKey]);
    
    const colors = [
      'rgba(99, 102, 241, 0.8)', // Indigo 500
      'rgba(139, 92, 246, 0.8)', // Violet 500
      'rgba(20, 184, 166, 0.8)', // Teal 500
      'rgba(236, 72, 153, 0.8)', // Pink 500
      'rgba(245, 158, 11, 0.8)', // Amber 500
    ];

    const borderColors = colors.map(c => c.replace('0.8', '1'));

    let datasets = [];

    if (chartType === 'pie' || chartType === 'doughnut') {
      datasets = [{
        label: String(numKeys[0]).toUpperCase(),
        data: data.map(row => row[numKeys[0]]),
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1
      }];
    } else {
      datasets = numKeys.map((key, i) => ({
        label: String(key).toUpperCase(),
        data: data.map(row => row[key]),
        backgroundColor: colors[i % colors.length],
        borderColor: borderColors[i % borderColors.length],
        borderWidth: 1,
        tension: 0.3
      }));
    }

    setChartData({ labels, datasets });
  }, [data, chartType]);

  if (!data || data.length === 0 || !chartData) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Not enough data to render a chart</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    scales: chartType === 'pie' || chartType === 'doughnut' ? {} : {
      x: {
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' }
      },
      y: {
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b' }
      }
    },
    plugins: {
      legend: { 
        position: 'top',
        labels: { color: isDarkMode ? '#cbd5e1' : '#475569' }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDarkMode ? '#f8fafc' : '#0f172a',
        bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6
      }
    }
  };

  const currentChartType = chartType === 'doughnut' ? 'doughnut' : (chartType === 'pie' ? 'pie' : (chartType === 'line' ? 'line' : 'bar'));

  return (
    <div className="flex flex-col h-[400px] w-full p-6 glass-panel rounded-2xl transition-colors">
      <div className="flex justify-end gap-2 mb-4">
        <button 
          onClick={() => setChartType('bar')}
          className={`p-1.5 rounded transition-colors ${chartType === 'bar' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          title="Bar Chart"
        >
          <BarChart size={18} />
        </button>
        <button 
          onClick={() => setChartType('line')}
          className={`p-1.5 rounded transition-colors ${chartType === 'line' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          title="Line Chart"
        >
          <LineChart size={18} />
        </button>
        <button 
          onClick={() => setChartType('pie')}
          className={`p-1.5 rounded transition-colors ${chartType === 'pie' || chartType === 'doughnut' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          title="Pie Chart"
        >
          <PieChart size={18} />
        </button>
      </div>
      <div className="flex-grow w-full relative">
        <Chart type={currentChartType} data={chartData} options={options} />
      </div>
    </div>
  );
}
