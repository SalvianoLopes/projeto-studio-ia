
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// XLSX and Plotly are expected to be available globally via CDN
declare var XLSX: any;
declare var Plotly: any;

interface SalesDataRow {
  [key: string]: any;
}

// Helper function to parse currency values
const parseCurrency = (value: any): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleanedValue = value
      .replace(/R\$\s?/g, '')    // Remove "R$" and optional space
      .replace(/\./g, (match, offset, fullString) => {
        // Replace dots used as thousands separators only if a comma for decimal exists later
        if (fullString.indexOf(',') !== -1 && fullString.indexOf(',') > offset) { 
            return ''; // Remove dot if it's a thousands separator
        }
        return match; // Keep dot if it's a decimal or part of text
      })
      .replace(/,/g, '.');      // Replace decimal comma with dot
    const num = parseFloat(cleanedValue);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper function to parse integer values
const parseInteger = (value: any): number => {
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper to find column name case-insensitively
const findColumnName = (headers: string[], targetNames: string[]): string | undefined => {
  const normalizedTargetNames = targetNames.map(name => name.toLowerCase().trim());
  for (const header of headers) {
    const normalizedHeader = String(header).toLowerCase().trim();
    if (normalizedTargetNames.includes(normalizedHeader)) {
      return header;
    }
  }
  return undefined;
};


// Reusable Plotly Chart Component
interface PlotlyChartComponentProps {
  data: any[];
  layout: any;
  config?: any;
  chartId: string;
}

const PlotlyChartComponent: React.FC<PlotlyChartComponentProps> = ({ data, layout, config, chartId }) => {
  const chartDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartDiv.current && data && layout && typeof Plotly !== 'undefined') {
      Plotly.newPlot(chartDiv.current, data, layout, config || { responsive: true });
    }

    return () => {
      if (chartDiv.current && typeof Plotly !== 'undefined') {
        Plotly.purge(chartDiv.current);
      }
    };
  }, [data, layout, config, chartId]);

  return <div id={chartId} ref={chartDiv} style={{ width: '100%', minHeight: '450px' }} />;
};

// Chart: Faturamento Total por Estado (UF)
interface RevenueByStateChartProps {
  rawData: SalesDataRow[];
}

const RevenueByStateChart: React.FC<RevenueByStateChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null);setChartLayout(null);
      setError(null); 
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Faturamento por Estado.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const ufColumn = findColumnName(headers, ['uf', 'estado', 'uf_da_compra']);
    const revenueColumn = findColumnName(headers, ['valor venda', 'valorvendabрутo', 'receita', 'faturamento', 'valor_da_venda']);

    if (!ufColumn) {
      setError("Coluna 'UF' (ou 'Estado', ou 'uf_da_compra') não encontrada. Verifique o cabeçalho do arquivo Excel.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor Venda' (ou similar, ou 'valor_da_venda') não encontrada. Verifique o cabeçalho do arquivo Excel.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const revenueByState: { [key: string]: number } = rawData.reduce((acc, row) => {
        const state = String(row[ufColumn] || 'Desconhecido').trim();
        const revenue = parseCurrency(row[revenueColumn]);
        acc[state] = (acc[state] || 0) + revenue;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(revenueByState).length === 0) {
        setError("Não foram encontrados dados de faturamento por estado para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedStates = Object.entries(revenueByState)
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {} as {[key: string]: number});

      const states = Object.keys(sortedStates);
      const revenues = Object.values(sortedStates);

      setChartData([{ x: states, y: revenues, type: 'bar', marker: { color: '#007bff' } }]);
      setChartLayout({
        title: 'Faturamento Total por Estado (UF)',
        xaxis: { title: 'Estado (UF)', automargin: true },
        yaxis: { title: 'Faturamento Total (R$)', automargin: true },
        margin: { t: 50, b: 100, l: 80, r: 40 },
        bargap: 0.2,
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de faturamento por estado:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de faturamento por estado...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="revenue-by-state-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Faturamento Total por Loja
interface RevenueByStoreChartProps {
  rawData: SalesDataRow[];
}

const RevenueByStoreChart: React.FC<RevenueByStoreChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null);setChartLayout(null);
      setError(null);
       if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Faturamento por Loja.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const storeColumn = findColumnName(headers, ['nome_da_loja', 'nome_da_loj', 'loja', 'nome loja', 'store name', 'store']);
    const revenueColumn = findColumnName(headers, ['valor venda', 'valorvendabрутo', 'receita', 'faturamento', 'valor_da_venda']);

    if (!storeColumn) {
      setError("Coluna 'Nome da Loja' (ou 'nome_da_loj', 'loja') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor Venda' (ou 'valor_da_venda') não encontrada para o gráfico de lojas. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const revenueByStore: { [key: string]: number } = rawData.reduce((acc, row) => {
        const store = String(row[storeColumn] || 'Desconhecida').trim();
        const revenue = parseCurrency(row[revenueColumn]);
        acc[store] = (acc[store] || 0) + revenue;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(revenueByStore).length === 0) {
        setError("Não foram encontrados dados de faturamento por loja para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedStores = Object.entries(revenueByStore)
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {} as {[key: string]: number});

      const stores = Object.keys(sortedStores);
      const revenues = Object.values(sortedStores);

      setChartData([{ x: stores, y: revenues, type: 'bar', marker: { color: '#28a745' } }]);
      setChartLayout({
        title: 'Faturamento Total por Loja',
        xaxis: { title: 'Loja', automargin: true },
        yaxis: { title: 'Faturamento Total (R$)', automargin: true },
        margin: { t: 50, b: 100, l: 80, r: 40 },
        bargap: 0.2,
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de faturamento por loja:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de lojas.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de faturamento por loja...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="revenue-by-store-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Top 20 Produtos por Faturamento
interface RevenueByProductChartProps {
  rawData: SalesDataRow[];
}
const RevenueByProductChart: React.FC<RevenueByProductChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Top Produtos por Faturamento.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const productColumn = findColumnName(headers, ['nome_do_produto', 'nome_do_produt', 'produto', 'nome produto', 'product name', 'product']);
    const revenueColumn = findColumnName(headers, ['valor venda', 'valorvendabрутo', 'receita', 'faturamento', 'valor_da_venda']);

    if (!productColumn) {
      setError("Coluna 'Nome do Produto' (ou 'nome_do_produt', 'produto') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor Venda' (ou 'valor_da_venda') não encontrada para o gráfico de produtos. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const revenueByProduct: { [key: string]: number } = rawData.reduce((acc, row) => {
        const product = String(row[productColumn] || 'Desconhecido').trim();
        const revenue = parseCurrency(row[revenueColumn]);
        acc[product] = (acc[product] || 0) + revenue;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(revenueByProduct).length === 0) {
        setError("Não foram encontrados dados de faturamento por produto para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedProducts = Object.entries(revenueByProduct)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20); 

      if (sortedProducts.length === 0) {
        setError("Não há dados de produtos suficientes após a filtragem para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }

      const productNames = sortedProducts.map(([name]) => name).reverse(); 
      const revenues = sortedProducts.map(([, revenue]) => revenue).reverse();

      setChartData([{ 
        y: productNames, 
        x: revenues,    
        type: 'bar', 
        orientation: 'h', 
        marker: { color: '#ffc107' } 
      }]);
      setChartLayout({
        title: 'Top 20 Produtos por Faturamento',
        yaxis: { title: 'Produto', automargin: true }, 
        xaxis: { title: 'Faturamento Total (R$)', automargin: true }, 
        margin: { t: 50, b: 50, l: 200, r: 40 }, 
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de faturamento por produto:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de produtos.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de faturamento por produto...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="revenue-by-product-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Faturamento por Categoria
interface RevenueByCategoryChartProps {
  rawData: SalesDataRow[];
}

const RevenueByCategoryChart: React.FC<RevenueByCategoryChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Faturamento por Categoria.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const categoryColumn = findColumnName(headers, ['categoria_do_produto', 'categoria_do_produt', 'categoria', 'category']);
    const revenueColumn = findColumnName(headers, ['valor venda', 'valorvendabрутo', 'receita', 'faturamento', 'valor_da_venda']);

    if (!categoryColumn) {
      setError("Coluna 'Categoria do Produto' (ou 'categoria_do_produt', 'categoria') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor Venda' (ou 'valor_da_venda') não encontrada para o gráfico de categorias. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const revenueByCategory: { [key: string]: number } = rawData.reduce((acc, row) => {
        const category = String(row[categoryColumn] || 'Desconhecida').trim();
        const revenue = parseCurrency(row[revenueColumn]);
        acc[category] = (acc[category] || 0) + revenue;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(revenueByCategory).length === 0) {
        setError("Não foram encontrados dados de faturamento por categoria para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedCategories = Object.entries(revenueByCategory)
        .sort(([, a], [, b]) => b - a);

      const categories = sortedCategories.map(([name]) => name);
      const revenues = sortedCategories.map(([, revenue]) => revenue);

      setChartData([{ 
        labels: categories, 
        values: revenues,    
        type: 'pie', 
        hole: 0.4, 
        texttemplate: '%{label}<br>R$ %{value:,.2f}<br>(%{percent})', // Show label, R$ value, and percent
        textposition: 'inside',
        insidetextorientation: 'radial'
      }]);
      setChartLayout({
        title: 'Faturamento por Categoria',
        margin: { t: 50, b: 50, l: 50, r: 50 },
        legend: {orientation: 'h', yanchor: 'bottom', y: -0.2, xanchor: 'center', x: 0.5},
        uniformtext: { minsize: 8, mode: 'hide' } // Helps with text fitting
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de faturamento por categoria:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de categorias.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de faturamento por categoria...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="revenue-by-category-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Faturamento total por Marca
interface RevenueByBrandChartProps {
  rawData: SalesDataRow[];
}
const RevenueByBrandChart: React.FC<RevenueByBrandChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Top Marcas por Faturamento.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const brandColumn = findColumnName(headers, ['marca_do_produto', 'marca_do_produt', 'marca', 'brand']);
    const revenueColumn = findColumnName(headers, ['valor venda', 'valorvendabрутo', 'receita', 'faturamento', 'valor_da_venda']);

    if (!brandColumn) {
      setError("Coluna 'Marca do Produto' (ou 'marca_do_produt', 'marca') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor Venda' (ou 'valor_da_venda') não encontrada para o gráfico de marcas. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const revenueByBrand: { [key: string]: number } = rawData.reduce((acc, row) => {
        const brand = String(row[brandColumn] || 'Desconhecida').trim();
        const revenue = parseCurrency(row[revenueColumn]);
        acc[brand] = (acc[brand] || 0) + revenue;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(revenueByBrand).length === 0) {
        setError("Não foram encontrados dados de faturamento por marca para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedBrands = Object.entries(revenueByBrand)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15); 

      if (sortedBrands.length === 0) {
        setError("Não há dados de marcas suficientes após a filtragem para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }

      const brandNames = sortedBrands.map(([name]) => name);
      const revenues = sortedBrands.map(([, revenue]) => revenue);

      setChartData([{ 
        x: brandNames, 
        y: revenues,    
        type: 'bar', 
        marker: { color: '#6f42c1' } 
      }]);
      setChartLayout({
        title: 'Top 15 Marcas por Faturamento',
        xaxis: { title: 'Marca', automargin: true, tickangle: -45 }, 
        yaxis: { title: 'Faturamento Total (R$)', automargin: true }, 
        margin: { t: 50, b: 150, l: 80, r: 40 }, 
        bargap: 0.2,
      });
      setError(null);
    } catch (e) { 
      console.error("Erro ao processar dados para gráfico de faturamento por marca:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de marcas.");
      setChartData(null);
      setChartLayout(null); 
    } 
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de faturamento por marca...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="revenue-by-brand-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Evolução Mensal do Faturamento
interface SalesEvolutionChartProps {
  rawData: SalesDataRow[];
}
const SalesEvolutionChart: React.FC<SalesEvolutionChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseExcelDate = (excelValue: any): Date | null => {
    if (excelValue === null || excelValue === undefined) return null;
    if (typeof excelValue === 'number') {
      if (excelValue > 0) { 
        try {
          const dateInfo = XLSX.SSF.parse_date_code(excelValue);
          if (dateInfo) {
            return new Date(dateInfo.y, dateInfo.m - 1, dateInfo.d, dateInfo.H, dateInfo.M, dateInfo.S);
          }
        } catch (e) {
            // console.warn("Could not parse Excel serial date:", excelValue, e);
        }
      }
    }
    if (typeof excelValue === 'string') {
      const d = new Date(excelValue);
      if (!isNaN(d.getTime())) return d;
    }
    if (excelValue instanceof Date && !isNaN(excelValue.getTime())) {
        return excelValue;
    }
    return null;
  };


  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Evolução Mensal do Faturamento.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const dateColumn = findColumnName(headers, ['data_da_venda', 'data da venda', 'data', 'date']);
    const revenueColumn = findColumnName(headers, ['valor venda', 'valor_da_venda', 'receita', 'faturamento']);

    if (!dateColumn) {
      setError("Coluna 'Data da Venda' (ou 'data_da_venda', 'data') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor Venda' (ou 'valor_da_venda') não encontrada para o gráfico de evolução. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const monthlyRevenue: { [key: string]: number } = {};

      rawData.forEach(row => {
        const dateValue = row[dateColumn];
        const revenue = parseCurrency(row[revenueColumn]);
        
        const date = parseExcelDate(dateValue);

        if (date) {
          const month = (date.getMonth() + 1).toString().padStart(2, '0'); 
          const yearMonth = `${date.getFullYear()}-${month}`;
          monthlyRevenue[yearMonth] = (monthlyRevenue[yearMonth] || 0) + revenue;
        }
      });

      if (Object.keys(monthlyRevenue).length === 0) {
        setError("Não foram encontrados dados de faturamento mensais válidos para exibir com os filtros atuais. Verifique a coluna de data.");
        setChartData(null); setChartLayout(null); return;
      }

      const sortedMonths = Object.keys(monthlyRevenue).sort();
      const revenues = sortedMonths.map(month => monthlyRevenue[month]);

      setChartData([{
        x: sortedMonths,
        y: revenues,
        type: 'scatter', 
        mode: 'lines+markers',
        marker: { color: '#dc3545' }, 
        line: { shape: 'spline' } 
      }]);
      setChartLayout({
        title: 'Evolução Mensal do Faturamento',
        xaxis: { title: 'Mês (Ano-Mês)', automargin: true, type: 'category' }, 
        yaxis: { title: 'Faturamento Total (R$)', automargin: true },
        margin: { t: 50, b: 100, l: 80, r: 40 },
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de evolução de vendas:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de evolução.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de evolução de vendas...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="sales-evolution-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Top 20 Produtos por Quantidade Vendida
interface TopProductsByQuantityChartProps {
  rawData: SalesDataRow[];
}
const TopProductsByQuantityChart: React.FC<TopProductsByQuantityChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Top Produtos por Quantidade.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const productColumn = findColumnName(headers, ['nome_do_produto', 'nome_do_produt', 'produto', 'nome produto', 'product name', 'product']);
    const quantityColumn = findColumnName(headers, ['quantidad', 'quantidade', 'quantidade vendida', 'qntd', 'volume', 'units sold']);

    if (!productColumn) {
      setError("Coluna 'Nome do Produto' (ou 'nome_do_produt', 'produto') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!quantityColumn) {
      setError("Coluna 'Quantidade' (ou 'quantidad') não encontrada para o gráfico de quantidade por produto. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const quantityByProduct: { [key: string]: number } = rawData.reduce((acc, row) => {
        const product = String(row[productColumn] || 'Desconhecido').trim();
        const quantity = parseInteger(row[quantityColumn]);
        acc[product] = (acc[product] || 0) + quantity;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(quantityByProduct).length === 0) {
        setError("Não foram encontrados dados de quantidade por produto para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedProducts = Object.entries(quantityByProduct)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20); 

      if (sortedProducts.length === 0) {
        setError("Não há dados de produtos suficientes após a filtragem para exibir no gráfico de quantidade.");
        setChartData(null); setChartLayout(null); return;
      }

      const productNames = sortedProducts.map(([name]) => name).reverse(); 
      const quantities = sortedProducts.map(([, qty]) => qty).reverse();

      setChartData([{ 
        y: productNames, 
        x: quantities,    
        type: 'bar', 
        orientation: 'h', 
        marker: { color: '#20c997' } 
      }]);
      setChartLayout({
        title: 'Top 20 Produtos por Quantidade Vendida',
        yaxis: { title: 'Produto', automargin: true }, 
        xaxis: { title: 'Quantidade Total Vendida', automargin: true }, 
        margin: { t: 50, b: 50, l: 200, r: 40 }, 
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de quantidade por produto:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de quantidade por produto.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de quantidade por produto...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="quantity-by-product-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Dispersão: Quantidade Vendida vs. Valor da Venda
interface ScatterQuantityRevenueChartProps {
  rawData: SalesDataRow[];
}
const ScatterQuantityRevenueChart: React.FC<ScatterQuantityRevenueChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para o Gráfico de Dispersão.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const quantityColumn = findColumnName(headers, ['quantidad', 'quantidade', 'qntd']);
    const revenueColumn = findColumnName(headers, ['valor_da_venda', 'valor venda', 'receita']);
    const productColumn = findColumnName(headers, ['nome_do_produt', 'nome_do_produto', 'produto']);
    const categoryColumn = findColumnName(headers, ['categoria_do_produt', 'categoria_do_produto', 'categoria']);

    if (!quantityColumn) {
      setError("Coluna 'Quantidade' (ou 'quantidad') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!revenueColumn) {
      setError("Coluna 'Valor da Venda' (ou 'valor_da_venda') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!productColumn) {
      setError("Coluna 'Nome do Produto' (ou 'nome_do_produt') não encontrada (necessária para hover).");
      setChartData(null); setChartLayout(null); return;
    }
    if (!categoryColumn) {
      setError("Coluna 'Categoria do Produto' (ou 'categoria_do_produt') não encontrada (necessária para cores).");
      setChartData(null); setChartLayout(null); return;
    }
    
    try {
      const plotPoints: { x: number; y: number; text: string; category: string }[] = [];
      rawData.forEach(row => {
        const quantity = parseInteger(row[quantityColumn]);
        const revenue = parseCurrency(row[revenueColumn]);
        const productName = String(row[productColumn] || 'N/A');
        const category = String(row[categoryColumn] || 'Desconhecida');

        if (quantity > 0 && revenue > 0) { 
          plotPoints.push({ x: quantity, y: revenue, text: productName, category });
        }
      });

      if (plotPoints.length === 0) {
        setError("Não foram encontrados dados válidos (quantidade e valor > 0) para o gráfico de dispersão com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }

      const traces: any[] = [];
      const categories = [...new Set(plotPoints.map(p => p.category))];

      categories.forEach(cat => {
        const categoryPoints = plotPoints.filter(p => p.category === cat);
        traces.push({
          x: categoryPoints.map(p => p.x),
          y: categoryPoints.map(p => p.y),
          text: categoryPoints.map(p => p.text),
          type: 'scatter',
          mode: 'markers',
          name: cat, 
          marker: { size: 8, opacity: 0.7 },
          hoverinfo: 'x+y+text'
        });
      });
      
      if (traces.length === 0) {
          setError("Não foi possível criar dados para o gráfico de dispersão após agrupar por categoria com os filtros atuais.");
          setChartData(null); setChartLayout(null); return;
      }

      setChartData(traces);
      setChartLayout({
        title: 'Dispersão: Quantidade Vendida vs. Valor da Venda',
        xaxis: { title: 'Quantidade Vendida (Unidades)', automargin: true },
        yaxis: { title: 'Valor da Venda (R$)', automargin: true },
        hovermode: 'closest',
        legend: { title: { text: 'Categorias' } },
        margin: { t: 50, b: 80, l: 80, r: 40 },
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de dispersão:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de dispersão.");
      setChartData(null); setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de dispersão...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="scatter-quantity-revenue-chart" data={chartData} layout={chartLayout} /></div>;
};

// Chart: Distribuição de Quantidade Vendida por Categoria
interface QuantityByCategoryChartProps {
  rawData: SalesDataRow[];
}
const QuantityByCategoryChart: React.FC<QuantityByCategoryChartProps> = ({ rawData }) => {
  const [chartData, setChartData] = useState<any[] | null>(null);
  const [chartLayout, setChartLayout] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawData || rawData.length === 0) {
      setChartData(null); setChartLayout(null);
      setError(null);
      if (rawData && rawData.length === 0) {
        setError("Nenhum dado corresponde aos filtros selecionados para Distribuição de Quantidade por Categoria.");
      }
      return;
    }

    const headers = Object.keys(rawData[0]);
    const categoryColumn = findColumnName(headers, ['categoria_do_produto', 'categoria_do_produt', 'categoria', 'category']);
    const quantityColumn = findColumnName(headers, ['quantidad', 'quantidade', 'quantidade vendida', 'qntd', 'volume', 'units sold']);

    if (!categoryColumn) {
      setError("Coluna 'Categoria do Produto' (ou 'categoria_do_produt', 'categoria') não encontrada. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }
    if (!quantityColumn) {
      setError("Coluna 'Quantidade' (ou 'quantidad') não encontrada para o gráfico de quantidade por categoria. Verifique o cabeçalho.");
      setChartData(null); setChartLayout(null); return;
    }

    try {
      const quantityByCategory: { [key: string]: number } = rawData.reduce((acc, row) => {
        const category = String(row[categoryColumn] || 'Desconhecida').trim();
        const quantity = parseInteger(row[quantityColumn]);
        acc[category] = (acc[category] || 0) + quantity;
        return acc;
      }, {} as { [key: string]: number });

      if (Object.keys(quantityByCategory).length === 0) {
        setError("Não foram encontrados dados de quantidade por categoria para exibir com os filtros atuais.");
        setChartData(null); setChartLayout(null); return;
      }
      
      const sortedCategories = Object.entries(quantityByCategory)
        .sort(([, a], [, b]) => b - a);

      const categories = sortedCategories.map(([name]) => name);
      const quantities = sortedCategories.map(([, qty]) => qty);

      setChartData([{ 
        labels: categories, 
        values: quantities,    
        type: 'pie', 
        hole: 0.4, 
        texttemplate: '%{label}<br>R$ %{value:,.0f}<br>(%{percent})', // Changed to value for quantity, not R$
        textposition: 'inside',
        insidetextorientation: 'radial'
      }]);
      setChartLayout({
        title: 'Distribuição de Quantidade Vendida por Categoria',
        margin: { t: 50, b: 50, l: 50, r: 50 },
        legend: {orientation: 'h', yanchor: 'bottom', y: -0.2, xanchor: 'center', x: 0.5},
        uniformtext: { minsize: 8, mode: 'hide' }
      });
      setError(null);
    } catch (e) {
      console.error("Erro ao processar dados para gráfico de quantidade por categoria:", e);
      setError("Ocorreu um erro ao processar os dados para o gráfico de quantidade por categoria.");
      setChartData(null);
      setChartLayout(null);
    }
  }, [rawData]);

  if (error) return <div className="chart-container"><p className="chart-error">{error}</p></div>;
  if (!chartData || !chartLayout) return <div className="chart-container"><p>Carregando gráfico de quantidade por categoria...</p></div>;
  return <div className="chart-container"><PlotlyChartComponent chartId="quantity-by-category-chart" data={chartData} layout={chartLayout} /></div>;
};

// --- FILTERS ---
interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  filterId: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ label, options, selectedOptions, onChange, filterId }) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions, option => option.value);
    onChange(values);
  };

  const handleClearSelection = () => {
    onChange([]); // Clears the selection, effectively selecting "All"
  };

  // Determine a reasonable size for the select box
  const selectSize = options.length > 0 ? Math.min(Math.max(4, options.length), 8) : 4;


  return (
    <div className="filter-group">
      <label htmlFor={filterId}>{label}:</label>
      <select 
        id={filterId} 
        multiple 
        value={selectedOptions} 
        onChange={handleChange}
        size={selectSize} 
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {options.length > 0 && ( // Only show clear button if there are options
        <button 
          type="button" 
          onClick={handleClearSelection} 
          className="clear-filter-button"
          aria-label={`Limpar filtro ${label}`}
        >
          Limpar Seleção (Mostrar Todos)
        </button>
      )}
    </div>
  );
};

interface FilterPanelProps {
  availableStates: string[];
  selectedStates: string[];
  onStateChange: (selected: string[]) => void;
  availableCategories: string[];
  selectedCategories: string[];
  onCategoryChange: (selected: string[]) => void;
  availableStores: string[];
  selectedStores: string[];
  onStoreChange: (selected: string[]) => void;
  availableBrands: string[];
  selectedBrands: string[];
  onBrandChange: (selected: string[]) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  availableStates, selectedStates, onStateChange,
  availableCategories, selectedCategories, onCategoryChange,
  availableStores, selectedStores, onStoreChange,
  availableBrands, selectedBrands, onBrandChange
}) => {
  return (
    <section className="filter-panel" aria-labelledby="filter-panel-heading">
      <h3 id="filter-panel-heading">Filtros Interativos</h3>
      <div className="filter-controls-grid">
        <MultiSelectFilter
          label="Estado (UF)"
          options={availableStates}
          selectedOptions={selectedStates}
          onChange={onStateChange}
          filterId="state-filter"
        />
        <MultiSelectFilter
          label="Categoria do Produto"
          options={availableCategories}
          selectedOptions={selectedCategories}
          onChange={onCategoryChange}
          filterId="category-filter"
        />
         <MultiSelectFilter
          label="Loja"
          options={availableStores}
          selectedOptions={selectedStores}
          onChange={onStoreChange}
          filterId="store-filter"
        />
        <MultiSelectFilter
          label="Marca do Produto"
          options={availableBrands}
          selectedOptions={selectedBrands}
          onChange={onBrandChange}
          filterId="brand-filter"
        />
      </div>
    </section>
  );
};


const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [originalRawData, setOriginalRawData] = useState<SalesDataRow[] | null>(null); 
  const [filteredData, setFilteredData] = useState<SalesDataRow[] | null>(null); 
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for filter options and selections
  const [ufColumnName, setUfColumnName] = useState<string | undefined>(undefined);
  const [categoryColumnName, setCategoryColumnName] = useState<string | undefined>(undefined);
  const [storeColumnName, setStoreColumnName] = useState<string | undefined>(undefined);
  const [brandColumnName, setBrandColumnName] = useState<string | undefined>(undefined);

  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);


  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileName(null);
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setOriginalRawData(null); 
    setFilteredData(null);
    setError(null);   
    setIsLoading(false); 
    // Reset filter states
    setSelectedStates([]);
    setSelectedCategories([]);
    setSelectedStores([]);
    setSelectedBrands([]);
    setAvailableStates([]);
    setAvailableCategories([]);
    setAvailableStores([]);
    setAvailableBrands([]);
  }, []);

  const handleStartProcessing = useCallback(() => {
    if (!selectedFile) {
      setError("Nenhum arquivo selecionado para processar.");
      return;
    }

    setIsLoading(true);
    setError(null); 

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("Falha ao ler o arquivo.");
        }
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        if (!workbook.Sheets['Sheet1'] && !workbook.Sheets[firstSheetName]) {
            throw new Error("A planilha 'Sheet1' não foi encontrada no arquivo. Verifique o nome da planilha.");
        }
        
        const worksheetName = workbook.Sheets['Sheet1'] ? 'Sheet1' : firstSheetName;
        const worksheet = workbook.Sheets[worksheetName];
        
        const jsonOptions = { header: 1, blankrows: false, defval: null }; 
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, jsonOptions);

        if (sheetData.length < 2) { 
          throw new Error(`A planilha '${worksheetName}' está vazia ou contém apenas cabeçalhos.`);
        }

        const headers: string[] = sheetData[0].map(header => String(header !== null && header !== undefined ? header : '').trim());
        const jsonData = sheetData.slice(1).map(rowArray => {
          const rowData: SalesDataRow = {};
          headers.forEach((header: string, index: number) => {
            rowData[header] = rowArray[index]; 
          });
          return rowData;
        }).filter(row => Object.values(row).some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')); 
        
        if (jsonData.length === 0) {
            throw new Error(`Não foram encontrados dados válidos na planilha '${worksheetName}' após os cabeçalhos.`);
        }
        
        setOriginalRawData(jsonData); 

      } catch (err) {
        console.error("Erro ao processar o arquivo Excel:", err);
        const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido ao processar o arquivo.";
        setError(`Erro ao processar o arquivo ${selectedFile.name}: ${errorMessage}`);
        setOriginalRawData(null);
        setFilteredData(null);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; 
        }
      }
    };

    reader.onerror = () => {
      setError(`Falha ao ler o arquivo ${selectedFile.name}.`);
      setIsLoading(false);
      setOriginalRawData(null);
      setFilteredData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  }, [selectedFile]);

  // Effect to extract filter options and identify column names when originalRawData is loaded
  useEffect(() => {
    if (originalRawData && originalRawData.length > 0) {
      const headers = Object.keys(originalRawData[0]);

      const foundUfCol = findColumnName(headers, ['uf', 'estado', 'uf_da_compra']);
      setUfColumnName(foundUfCol);
      if (foundUfCol) {
        const uniqueStates = [...new Set(originalRawData.map(row => String(row[foundUfCol] || 'N/A').trim()))].sort();
        setAvailableStates(uniqueStates);
      } else {
        setAvailableStates([]);
      }
      
      const foundCatCol = findColumnName(headers, ['categoria_do_produto', 'categoria_do_produt', 'categoria', 'category']);
      setCategoryColumnName(foundCatCol);
      if (foundCatCol) {
        const uniqueCategories = [...new Set(originalRawData.map(row => String(row[foundCatCol] || 'N/A').trim()))].sort();
        setAvailableCategories(uniqueCategories);
      } else {
        setAvailableCategories([]);
      }

      const foundStoreCol = findColumnName(headers, ['nome_da_loja', 'nome_da_loj', 'loja', 'nome loja', 'store name', 'store']);
      setStoreColumnName(foundStoreCol);
      if (foundStoreCol) {
        const uniqueStores = [...new Set(originalRawData.map(row => String(row[foundStoreCol] || 'N/A').trim()))].sort();
        setAvailableStores(uniqueStores);
      } else {
        setAvailableStores([]);
      }
      
      const foundBrandCol = findColumnName(headers, ['marca_do_produto', 'marca_do_produt', 'marca', 'brand']);
      setBrandColumnName(foundBrandCol);
      if (foundBrandCol) {
        const uniqueBrands = [...new Set(originalRawData.map(row => String(row[foundBrandCol] || 'N/A').trim()))].sort();
        setAvailableBrands(uniqueBrands);
      } else {
        setAvailableBrands([]);
      }

      // setFilteredData(originalRawData); // Apply initial filters correctly
      setSelectedStates([]); 
      setSelectedCategories([]); 
      setSelectedStores([]);
      setSelectedBrands([]);

    } else {
      setUfColumnName(undefined);
      setCategoryColumnName(undefined);
      setStoreColumnName(undefined);
      setBrandColumnName(undefined);
      setAvailableStates([]);
      setAvailableCategories([]);
      setAvailableStores([]);
      setAvailableBrands([]);
      setFilteredData(null);
    }
  }, [originalRawData]);


  // Effect to apply filters when selections change or originalRawData/columnNames are set
  useEffect(() => {
    if (!originalRawData) {
      setFilteredData(null);
      return;
    }

    let dataToFilter = [...originalRawData];

    if (selectedStates.length > 0 && ufColumnName) {
      dataToFilter = dataToFilter.filter(row => 
        selectedStates.includes(String(row[ufColumnName] || 'N/A').trim())
      );
    }

    if (selectedCategories.length > 0 && categoryColumnName) {
      dataToFilter = dataToFilter.filter(row =>
        selectedCategories.includes(String(row[categoryColumnName] || 'N/A').trim())
      );
    }
    
    if (selectedStores.length > 0 && storeColumnName) {
      dataToFilter = dataToFilter.filter(row =>
        selectedStores.includes(String(row[storeColumnName] || 'N/A').trim())
      );
    }

    if (selectedBrands.length > 0 && brandColumnName) {
      dataToFilter = dataToFilter.filter(row =>
        selectedBrands.includes(String(row[brandColumnName] || 'N/A').trim())
      );
    }

    setFilteredData(dataToFilter);
  }, [originalRawData, selectedStates, selectedCategories, selectedStores, selectedBrands, ufColumnName, categoryColumnName, storeColumnName, brandColumnName]);


  return (
    <>
      <header>
        <h1>Análise de Vendas - Supermercado</h1>
      </header>
      <main className="app-container" aria-live="polite">
        <section className="file-upload-section" aria-labelledby="file-upload-heading">
          <h2 id="file-upload-heading" className="sr-only">Upload de Arquivo Excel</h2>
          <label htmlFor="excel-file-input" className={selectedFile ? 'file-selected-label' : ''}>
            {selectedFile && fileName ? `Arquivo selecionado: ${fileName}` : "Por favor, selecione o arquivo Excel de vendas (`Supermercado.xlsx`):"}
          </label>
          <div className="file-input-wrapper">
            <button type="button" className="file-input-button" aria-controls="excel-file-input" onClick={() => fileInputRef.current?.click()}>
              {selectedFile ? "Trocar Arquivo" : "Escolher Arquivo"}
            </button>
            <input
              type="file"
              id="excel-file-input"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              aria-label="Seletor de arquivo Excel"
              ref={fileInputRef}
              style={{ display: 'none' }} 
            />
          </div>
          {selectedFile && !isLoading && !originalRawData && (
            <button onClick={handleStartProcessing} className="analyze-button" disabled={isLoading}>
              Analisar Arquivo
            </button>
          )}
        </section>

        {isLoading && (
          <div className="status-message loading-message" role="status">
            Carregando e processando o arquivo...
          </div>
        )}
        {error && !isLoading && ( 
          <div className="status-message error-message" role="alert">
            {error}
          </div>
        )}
        {originalRawData && !isLoading && !error && (
          <div className="status-message success-message" role="status">
            Arquivo "{fileName}" carregado com sucesso!
            <br />
            {originalRawData.length} linhas de dados originais encontradas.
          </div>
        )}
        
        {originalRawData && !isLoading && !error && (
          <FilterPanel
            availableStates={availableStates}
            selectedStates={selectedStates}
            onStateChange={setSelectedStates}
            availableCategories={availableCategories}
            selectedCategories={selectedCategories}
            onCategoryChange={setSelectedCategories}
            availableStores={availableStores}
            selectedStores={selectedStores}
            onStoreChange={setSelectedStores} 
            availableBrands={availableBrands}
            selectedBrands={selectedBrands}
            onBrandChange={setSelectedBrands} 
          />
        )}

        <section className="dashboard-area" aria-labelledby="dashboard-heading">
           <h2 id="dashboard-heading" className="sr-only">Dashboard de Análise de Vendas</h2>
           {!selectedFile && !originalRawData && !isLoading && !error && (
             <p className="placeholder-text">Nenhum arquivo selecionado. Por favor, escolha um arquivo Excel para começar a análise.</p>
           )}
           {selectedFile && !originalRawData && !isLoading && !error && (
             <p className="placeholder-text">Arquivo "{fileName}" selecionado. Clique em "Analisar Arquivo" para carregar os dados.</p>
           )}
           {filteredData && !isLoading && !error && (
             <>
               <RevenueByStateChart rawData={filteredData} />
               <RevenueByStoreChart rawData={filteredData} />
               <RevenueByProductChart rawData={filteredData} />
               <RevenueByCategoryChart rawData={filteredData} />
               <RevenueByBrandChart rawData={filteredData} />
               <SalesEvolutionChart rawData={filteredData} />
               <TopProductsByQuantityChart rawData={filteredData} />
               <ScatterQuantityRevenueChart rawData={filteredData} />
               <QuantityByCategoryChart rawData={filteredData} />
             </>
           )}
           {originalRawData && filteredData && filteredData.length === 0 && !isLoading && !error && (
                <div className="status-message info-message" role="status">
                    Nenhum dado corresponde aos filtros selecionados.
                </div>
           )}
        </section>
      </main>
      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error("Root element not found");
}
