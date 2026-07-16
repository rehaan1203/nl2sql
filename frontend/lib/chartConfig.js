import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const determineChartType = (data) => {
  if (!data || data.length === 0) return null;
  
  const keys = Object.keys(data[0]);
  if (keys.length < 2) return null;

  let textCols = [];
  let numCols = [];
  let dateCols = [];

  keys.forEach(key => {
    const val = data[0][key];
    if (typeof val === 'number') {
      numCols.push(key);
    } else if (typeof val === 'string') {
      // Check if string is a valid date
      if (!isNaN(Date.parse(val)) && val.length >= 10) {
        dateCols.push(key);
      } else {
        textCols.push(key);
      }
    }
  });

  // If data has date column + number column → Line chart
  if (dateCols.length === 1 && numCols.length >= 1) {
    return 'line';
  }

  // If data has 1 text column + 1 number column
  if (textCols.length === 1 && numCols.length === 1) {
    // If few categories (< 6) → Pie/Donut chart
    if (data.length < 6) {
      return 'pie';
    }
    // Otherwise → Bar chart
    return 'bar';
  }

  // If data has multiple number columns → Grouped bar chart
  if ((textCols.length === 1 || dateCols.length === 1) && numCols.length > 1) {
    return 'bar';
  }

  // Default fallback
  return 'bar';
};
