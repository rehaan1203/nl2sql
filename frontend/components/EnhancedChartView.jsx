'use client';

import ChartSkeleton from './ChartSkeleton';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
  LabelList,
  Brush
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { BarChart3, AlertTriangle, Download, Maximize } from 'lucide-react';

// Chart type detection
const detectChartType = (data, columns) => {
  if (!data || data.length === 0) return 'bar';

  const numericCols = columns.filter(col =>
    typeof data[0]?.[col] === 'number'
  );
  const textCols = columns.filter(col =>
    typeof data[0]?.[col] === 'string'
  );

  if (textCols.length === 0) return 'bar';

  // Pie chart for 1 text column + 1 numeric column with few categories
  if (textCols.length === 1 && numericCols.length === 1 && data.length <= 15) {
    return 'pie';
  }

  // Line chart for date + numeric
  const dateCol = columns.find(col =>
    data.some(row => row[col] && /^\d{4}-\d{2}-\d{2}/.test(row[col]))
  );
  if (dateCol && numericCols.length > 0) {
    return 'line';
  }

  // Area chart for date + numeric with trends
  if (dateCol && numericCols.length > 0 && data.length > 5) {
    return 'area';
  }

  // Default to bar
  return 'bar';
};

// Color generator
const getColorPalette = (count, scheme = 'vibrant') => {
  const palettes = {
    vibrant: [
      '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e',
      '#06b6d4', '#ec4899', '#6366f1', '#f97316', '#14b8a6',
      '#8b5cf6', '#e11d48', '#0ea5e9', '#22d3ee', '#a78bfa'
    ],
    pastel: [
      '#93c5fd', '#c4b5fd', '#6ee7b7', '#fcd34d', '#fca5a5',
      '#67e8f9', '#f9a8d4', '#a5b4fc', '#fdba74', '#5eead4'
    ],
    dark: [
      '#1e40af', '#5b21b6', '#065f46', '#92400e', '#9f1239',
      '#0e7490', '#831843', '#3730a3', '#c2410c', '#115e59'
    ]
  };

  const selected = palettes[scheme] || palettes.vibrant;
  return Array.from({ length: count }, (_, i) => selected[i % selected.length]);
};

const cleanNumericString = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return NaN;
  // Remove currency symbols, commas, and spaces
  const cleaned = val.replace(/[$,\s]/g, '');
  return Number(cleaned);
};

export default function EnhancedChartView({ data: rawData, columns, isLoading = false, error = null }) {
  const [chartType, setChartType] = useState(null);
  const [chartTheme, setChartTheme] = useState('vibrant');
  const [showValues, setShowValues] = useState(false);
  const [chartHeight, setChartHeight] = useState(400);
  const [mounted, setMounted] = useState(false);
  
  if (isLoading) {
    const detectedType = detectChartType(rawData, columns || []);
    return <ChartSkeleton type={detectedType} height={chartHeight} />;
  }

  if (error) {
    const errorConfigs = {
      'no_data': {
        icon: '📊',
        title: 'No Data to Visualize',
        message: 'The query returned no data. Try a different query or check your data.',
        suggestion: 'Try using aggregations like COUNT, SUM, or AVG'
      },
      'wrong_format': {
        icon: '📋',
        title: 'Data Format Not Compatible',
        message: 'The data format is not suitable for chart visualization.',
        suggestion: 'Try a query that returns numeric data with categories'
      },
      'too_many_points': {
        icon: '📈',
        title: 'Too Many Data Points',
        message: 'The dataset is too large for chart visualization.',
        suggestion: 'Try limiting your query with TOP or LIMIT'
      },
      'default': {
        icon: '⚠️',
        title: 'Chart Generation Failed',
        message: 'Unable to generate chart from the data.',
        suggestion: 'Try a different query or export the data as a table'
      }
    };
    
    const config = errorConfigs[error.type] || errorConfigs.default;
    
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
        <span className="text-4xl mb-3">{config.icon}</span>
        <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          {config.title}
        </h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md text-center">
          {config.message}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          💡 {config.suggestion}
        </p>
      </div>
    );
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-process data to coerce numeric strings to numbers
  const data = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    // Determine which columns can be treated as numeric
    const colsToConvert = columns.filter(col => {
      let hasData = false;
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const val = rawData[i]?.[col];
        if (val !== null && val !== undefined) {
          hasData = true;
          if (typeof val !== 'number') {
            if (typeof val !== 'string' || isNaN(cleanNumericString(val)) || val.trim() === '') {
              return false;
            }
          }
        }
      }
      return hasData;
    });

    if (colsToConvert.length === 0) return rawData;

    // Convert those columns
    return rawData.map(row => {
      const newRow = { ...row };
      colsToConvert.forEach(col => {
        if (newRow[col] !== null && newRow[col] !== undefined) {
          newRow[col] = cleanNumericString(newRow[col]);
        }
      });
      return newRow;
    });
  }, [rawData, columns]);

  // Detect numeric and text columns
  const numericCols = useMemo(() => {
    if (!data || data.length === 0) return [];
    return columns.filter(col => typeof data[0]?.[col] === 'number');
  }, [data, columns]);

  const textCols = useMemo(() => {
    if (!data || data.length === 0) return [];
    return columns.filter(col => typeof data[0]?.[col] === 'string');
  }, [data, columns]);

  // Detect chart type
  const detectedType = useMemo(() => {
    if (!data || data.length === 0) return 'bar';
    return detectChartType(data, columns);
  }, [data, columns]);

  const currentType = chartType || detectedType;

  // Get colors
  const colors = useMemo(() => {
    const count = currentType === 'pie' ? data?.length || 0 : numericCols.length;
    return getColorPalette(Math.max(count, 1), chartTheme);
  }, [currentType, data, numericCols, chartTheme]);

  // Format numeric values
  const formatValue = (value) => {
    if (value === undefined || value === null) return '—';
    if (typeof value !== 'number') return String(value);
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    // For small integers, don't show decimals
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2);
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[200px] z-50">
        {(label || label === 0) && label !== '' && (
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">
            {label}
          </p>
        )}
        <div className="space-y-2">
          {payload.map((entry, index) => {
            let color = entry.color || entry.payload?.fill;
            if (color && color.startsWith('url(')) {
              // Find the original color index based on dataKey or fallback to index
              const colIndex = numericCols.indexOf(entry.dataKey);
              color = colors[(colIndex >= 0 ? colIndex : index) % colors.length];
            }

            return (
              <div key={index} className="flex items-center justify-between gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shadow-inner"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {String(entry.name).toUpperCase()}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {typeof entry.value === 'number'
                    ? formatValue(entry.value)
                    : entry.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Custom Legend
  const CustomLegend = ({ payload }) => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pb-2">
        {payload.map((entry, index) => {
          let color = entry.color;
          if (color && color.startsWith('url(')) {
            // Find the original color index based on dataKey or fallback to index
            const colIndex = numericCols.indexOf(entry.dataKey);
            color = colors[(colIndex >= 0 ? colIndex : index) % colors.length];
          }

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {String(entry.value).toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Export chart as image
  const exportChart = async () => {
    const chartElement = document.getElementById('chart-export-container');
    if (!chartElement) return;

    try {
      const isDark = document.documentElement.classList.contains('dark');
      const canvas = await html2canvas(chartElement, {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        scale: 2
      });
      const link = document.createElement('a');
      link.download = 'chart_export.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export chart', err);
    }
  };

  // Full screen mode
  const toggleFullscreen = () => {
    const container = document.getElementById('chart-export-container');
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Chart controls
  const ChartControls = () => (
    <div className="overflow-x-auto hide-scrollbar mb-6 p-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm z-10 relative w-full">
      <div className="flex flex-nowrap items-center gap-4 w-max mx-auto">
        <div className="flex-shrink-0 flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        {['bar', 'line', 'area', 'pie'].map((type) => (
          <button
            key={type}
            onClick={() => setChartType(type === currentType ? null : type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${type === currentType
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        {['vibrant', 'pastel', 'dark'].map((theme) => (
          <button
            key={theme}
            onClick={() => setChartTheme(theme)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${theme === chartTheme
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            {theme.charAt(0).toUpperCase() + theme.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => setShowValues(!showValues)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${showValues
            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
            : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
        >
          {showValues ? 'Hide Labels' : 'Show Labels'}
        </button>

        <button
          onClick={exportChart}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>

        <button
          onClick={toggleFullscreen}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-1"
        >
          <Maximize className="w-3.5 h-3.5" />
          Fullscreen
        </button>
      </div>
      </div>
    </div>
  );

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
        <div className="text-center">
          <BarChart3 size={40} className="mb-3 opacity-50 mx-auto text-slate-500" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No data available for visualization</p>
        </div>
      </div>
    );
  }

  if (numericCols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <AlertTriangle size={40} className="mb-3 opacity-50 mx-auto text-slate-500" />
        <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">No numerical data detected</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Charts require at least one numeric column (e.g., counts, totals). Please adjust your query.</p>
      </div>
    );
  }

  if (!mounted) return <div className="h-[400px] animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl"></div>;

  // Chart rendering by type
  const renderChart = () => {
    // Prepare data
    const xAxisKey = textCols.length > 0 ? textCols[0] : columns[0];

    // Calculate average for ReferenceLine if there's only 1 numeric col
    let averageValue = 0;
    if (numericCols.length === 1 && data.length > 0) {
      const sum = data.reduce((acc, row) => acc + (row[numericCols[0]] || 0), 0);
      averageValue = sum / data.length;
    }

    // Bar Chart
    if (currentType === 'bar') {
      return (
        <div style={{ width: '100%', height: chartHeight, minHeight: 300 }}>
          <ResponsiveContainer width="99%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
              barGap={4}
              barCategoryGap="20%"
            >
              <defs>
                {numericCols.map((col, index) => (
                  <linearGradient
                    key={col}
                    id={`gradient-${col}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0.4} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800 opacity-20"
              />

              <XAxis
                dataKey={xAxisKey}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeWidth: 1, opacity: 0.2 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />

              <YAxis
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
                width={60}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
              <Legend content={<CustomLegend />} />

              {numericCols.length === 1 && averageValue > 0 && (
                <ReferenceLine
                  y={averageValue}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: 'Avg', position: 'insideTopLeft', fill: '#f43f5e', fontSize: 10 }}
                />
              )}

              {numericCols.map((col, index) => (
                <Bar
                  key={col}
                  dataKey={col}
                  fill={`url(#gradient-${col})`}
                  radius={[4, 4, 0, 0]}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  className="hover:brightness-110 transition-all cursor-pointer"
                >
                  {showValues && data.length <= 15 && (
                    <LabelList
                      dataKey={col}
                      position="top"
                      formatter={formatValue}
                      style={{ fill: 'currentColor', fontSize: 10, fontWeight: 600 }}
                      className="text-slate-600 dark:text-slate-300"
                    />
                  )}
                </Bar>
              ))}

              {data.length > 20 && (
                <Brush
                  dataKey={xAxisKey}
                  height={20}
                  stroke="currentColor"
                  fill="transparent"
                  className="text-slate-300 dark:text-slate-700"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Line Chart
    if (currentType === 'line') {
      return (
        <div style={{ width: '100%', height: chartHeight, minHeight: 300 }}>
          <ResponsiveContainer width="99%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800 opacity-20"
              />

              <XAxis
                dataKey={xAxisKey}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeWidth: 1, opacity: 0.2 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />

              <YAxis
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
                width={60}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.2 }} />
              <Legend content={<CustomLegend />} />

              {numericCols.length === 1 && averageValue > 0 && (
                <ReferenceLine
                  y={averageValue}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                />
              )}

              {numericCols.map((col, index) => (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={colors[index % colors.length]}
                  strokeWidth={3}
                  dot={{
                    fill: colors[index % colors.length],
                    strokeWidth: 2,
                    r: 4,
                    stroke: 'var(--background, white)'
                  }}
                  activeDot={{
                    r: 6,
                    strokeWidth: 0,
                    fill: colors[index % colors.length]
                  }}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                >
                  {showValues && data.length <= 15 && (
                    <LabelList
                      dataKey={col}
                      position="top"
                      formatter={formatValue}
                      style={{ fill: 'currentColor', fontSize: 10, fontWeight: 600 }}
                      className="text-slate-600 dark:text-slate-300"
                    />
                  )}
                </Line>
              ))}

              {data.length > 20 && (
                <Brush
                  dataKey={xAxisKey}
                  height={20}
                  stroke="currentColor"
                  fill="transparent"
                  className="text-slate-300 dark:text-slate-700"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Area Chart
    if (currentType === 'area') {
      return (
        <div style={{ width: '100%', height: chartHeight, minHeight: 300 }}>
          <ResponsiveContainer width="99%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
            >
              <defs>
                {numericCols.map((col, index) => (
                  <linearGradient
                    key={col}
                    id={`area-gradient-${col}`}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800 opacity-20"
              />

              <XAxis
                dataKey={xAxisKey}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeWidth: 1, opacity: 0.2 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />

              <YAxis
                tick={{ fill: 'currentColor', fontSize: 11 }}
                className="text-slate-500 dark:text-slate-400"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
                width={60}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.2 }} />
              <Legend content={<CustomLegend />} />

              {numericCols.map((col, index) => (
                <Area
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  fill={`url(#area-gradient-${col})`}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                />
              ))}

              {data.length > 20 && (
                <Brush
                  dataKey={xAxisKey}
                  height={20}
                  stroke="currentColor"
                  fill="transparent"
                  className="text-slate-300 dark:text-slate-700"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Pie Chart
    if (currentType === 'pie') {
      return (
        <div style={{ width: '100%', height: chartHeight, minHeight: 300 }}>
          <ResponsiveContainer width="99%" height="100%">
            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <Pie
                data={data}
                dataKey={numericCols[0]}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={3}
                labelLine={false}
                label={showValues ? ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)` : false}
                animationDuration={1000}
                animationEasing="ease-out"
                className="cursor-pointer"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={colors[index % colors.length]}
                    className="hover:opacity-80 transition-opacity stroke-white dark:stroke-slate-900 stroke-2"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div id="chart-export-container" className="p-6 bg-white dark:bg-transparent">
          <ChartControls />

          <div className="relative w-full" style={{ height: chartHeight }}>
            {renderChart()}

            {/* Stats overlay */}
            <div className="absolute -top-3 -right-2 flex gap-2">
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                {data.length} records
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
