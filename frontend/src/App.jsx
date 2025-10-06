import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import {
  Flower2,
  Droplets,
  CalendarDays,
  Timer,
  Map as MapIcon,
  Image as ImageIcon,
  LineChart as LineChartIcon,
  Gauge,
  Play,
  RefreshCw,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { requestPlot, triggerAnalysis, useApiData } from './hooks/useApi.js';

const plotOptions = [
  { value: 'ndvi_trend', label: 'Tendencia NDVI con floración' },
  { value: 'ndvi_year', label: 'NDVI de un año específico' },
  { value: 'features_overview', label: 'Serie multivariable 2015-2025' },
  { value: 'ndvi_rain_year', label: 'NDVI vs lluvia por año' },
];

function formatDate(value, options) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('es-CL', options);
}

function Section({ title, icon, subtitle, children }) {
  return (
    <section className="section">
      <div className="section-header">
        <div className="section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </div>
    </div>
  );
}

function LoadingMessage({ message }) {
  return <p className="status-message">{message}</p>;
}

function EmptyMessage({ message }) {
  return <p className="status-message">{message}</p>;
}

function AOIMap({ feature }) {
  const polygonPath = useMemo(() => {
    const coords = feature?.geometry?.coordinates;
    if (!coords || !Array.isArray(coords) || !coords[0]?.length) {
      return null;
    }
    const ring = coords[0];
    const longs = ring.map(([lon]) => lon);
    const lats = ring.map(([, lat]) => lat);
    const minLon = Math.min(...longs);
    const maxLon = Math.max(...longs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const width = maxLon - minLon || 1;
    const height = maxLat - minLat || 1;
    return ring
      .map(([lon, lat]) => {
        const x = ((lon - minLon) / width) * 80 + 10;
        const y = (1 - (lat - minLat) / height) * 80 + 10;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [feature]);

  return (
    <div className="aoi-map">
      <div className="aoi-map-badge">
        <MapIcon size={16} /> Área de estudio (AOI)
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ndvi-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
        </defs>
        <rect x="-10" y="-10" width="120" height="120" fill="url(#ndvi-gradient)" />
        {Array.from({ length: 12 }).map((_, index) => (
          <circle
            key={index}
            cx={(Math.random() * 100).toFixed(2)}
            cy={(Math.random() * 100).toFixed(2)}
            r={(1 + Math.random() * 2).toFixed(2)}
            fill="#ffffff55"
          />
        ))}
        {polygonPath ? (
          <polyline points={polygonPath} fill="#22c55e55" stroke="#ffffff" strokeWidth={1.5} />
        ) : null}
      </svg>
      <div className="aoi-map-actions">
        {[{ label: 'NDVI', icon: <Flower2 size={16} /> }, { label: 'Lluvia', icon: <Droplets size={16} /> }, { label: 'Cobertura', icon: <Info size={16} /> }].map((item) => (
          <button key={item.label} type="button" className="chip-button">
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NDVIRainChart({ data }) {
  if (!data?.length) {
    return <EmptyMessage message="No hay serie temporal disponible." />;
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value} mm`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value, name) => [value, name === 'ndvi' ? 'NDVI' : 'Precipitación (mm)']} />
          <Line yAxisId="left" type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={2} dot={false} name="NDVI" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="precipitation_mm"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Precipitación"
          />
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CorrelationBarChart({ data }) {
  if (!data?.length) {
    return <EmptyMessage message="La correlación aún no está disponible." />;
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="lag_months" label={{ value: 'Rezago (meses)', position: 'insideBottom', offset: -6 }} />
          <YAxis domain={[0, 1]} />
          <Tooltip formatter={(value) => value} labelFormatter={(value) => `Rezago ${value} meses`} />
          <Bar dataKey="r_pearson" fill="#1e88e5" radius={[6, 6, 0, 0]} name="Coeficiente de Pearson" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NDVIForecastArea({ data }) {
  if (!data?.length) {
    return <EmptyMessage message="Sin pronóstico NDVI disponible." />;
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ndvi-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={24} />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Area type="monotone" dataKey="upper" stroke="#93c5fd" fill="#93c5fd55" name="Límite superior" />
          <Area type="monotone" dataKey="lower" stroke="#86efac" fill="#86efac55" name="Límite inferior" />
          <Line type="monotone" dataKey="ndvi" stroke="#16a34a" strokeWidth={2} dot={false} name="NDVI" />
          <Legend />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PredictionPanel({ predictionData, loading, onRefresh }) {
  if (loading) {
    return <LoadingMessage message="Calculando predicciones…" />;
  }

  if (!predictionData) {
    return <EmptyMessage message="Sin datos de predicción disponibles." />;
  }

  const metrics = predictionData.metrics ?? {};
  const metricCards = [
    { label: 'Accuracy', value: metrics.accuracy },
    { label: 'ROC AUC', value: metrics.roc_auc },
    { label: 'NDVI RMSE', value: metrics.ndvi_rmse },
  ];

  const monthly = (predictionData.predictions ?? []).slice(0, 12);
  const ndviForecast = predictionData.ndvi_forecast ?? [];

  return (
    <div className="prediction-panel">
      <div className="prediction-grid">
        <div className="prediction-metrics">
          <div className="metric-grid">
            {metricCards.map((metric) => (
              <div key={metric.label} className="metric-card">
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value">
                  {typeof metric.value === 'number' ? metric.value.toFixed(2) : '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="probability-card">
            <div className="probability-header">
              <span>Probabilidad mensual de floración</span>
              <button type="button" className="text-button" onClick={onRefresh}>
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>
            <div className="probability-grid">
              {monthly.length === 0 ? (
                <EmptyMessage message="No hay pronósticos disponibles." />
              ) : (
                monthly.map((item) => {
                  const date = new Date(item.date);
                  const monthLabel = Number.isNaN(date.getTime())
                    ? item.date
                    : date.toLocaleDateString('es-CL', { month: 'short' });
                  const probability = Math.round((item.probability ?? 0) * 100);
                  let tone = 'neutral';
                  if (probability >= 65) tone = 'high';
                  else if (probability >= 45) tone = 'medium';
                  return (
                    <div key={item.date} className={`probability-chip probability-${tone}`}>
                      <span>{monthLabel}</span>
                      <strong>{probability}%</strong>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="prediction-chart">
          <NDVIForecastArea data={ndviForecast} />
        </div>
      </div>
      <div className="prediction-footnote">
        Modelo: <strong>{predictionData.model}</strong> · Características: {predictionData.feature_columns?.join(', ') || '—'}
      </div>
    </div>
  );
}

function DatasetTable({ datasets, loading, onRefresh }) {
  return (
    <div className="dataset-section">
      <div className="dataset-toolbar">
        <span>Inventario de archivos disponibles</span>
        <button type="button" className="text-button" onClick={onRefresh}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
      {loading ? (
        <LoadingMessage message="Consultando datasets…" />
      ) : !datasets?.length ? (
        <EmptyMessage message="No se encontraron archivos." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Filas</th>
                <th>Ruta</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((item) => (
                <tr key={item.path}>
                  <td>{item.name}</td>
                  <td>
                    <span className={`badge badge-${item.kind}`}>{item.kind}</span>
                  </td>
                  <td>{item.rows ?? '—'}</td>
                  <td title={item.path}>{item.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Gallery({ plots, loading, onRefresh }) {
  return (
    <div className="gallery-section">
      <div className="gallery-toolbar">
        <span>Visualizaciones generadas</span>
        <button type="button" className="text-button" onClick={onRefresh}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>
      {loading ? (
        <LoadingMessage message="Cargando galería…" />
      ) : !plots?.length ? (
        <EmptyMessage message="No hay gráficos disponibles. Genera uno para comenzar." />
      ) : (
        <div className="gallery-grid">
          {plots.map((plot) => (
            <article key={plot.path} className="gallery-card">
              <div className="gallery-thumb">
                <ImageIcon size={28} />
              </div>
              <div className="gallery-meta">
                <h3>{plot.name}</h3>
                <p>{plot.plot_type}</p>
                <a href={plot.url} target="_blank" rel="noreferrer">
                  Abrir imagen
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CLIActions({
  onBloomGlobal,
  onBloomAnnual,
  onRefreshBloom,
  bloomRunning,
  bloomLoading,
  onCorrelation,
  onRefreshCorrelation,
  correlationRunning,
  correlationLoading,
  onGeneratePlot,
  onRefreshPlots,
  plotRunning,
  plotsLoading,
  plotType,
  onPlotTypeChange,
  plotYear,
  onPlotYearChange,
  requiresYear,
  menu,
  menuLoading,
}) {
  return (
    <div className="cli-section">
      <div className="cli-grid">
        <div className="cli-card">
          <div>
            <h3>Ventanas de floración</h3>
            <p>Recalcula las fechas de inicio y fin con los scripts originales.</p>
          </div>
          <div className="cli-actions">
            <button type="button" onClick={onBloomGlobal} disabled={bloomRunning}>
              <Play size={16} /> {bloomRunning ? 'Procesando…' : 'Umbral global'}
            </button>
            <button type="button" onClick={onBloomAnnual} disabled={bloomRunning}>
              <Play size={16} /> {bloomRunning ? 'Procesando…' : 'Umbral anual'}
            </button>
            <button type="button" onClick={onRefreshBloom} disabled={bloomLoading} className="ghost-button">
              <RefreshCw size={16} /> Actualizar
            </button>
          </div>
        </div>
        <div className="cli-card">
          <div>
            <h3>Correlación lluvia → NDVI</h3>
            <p>Ejecuta el análisis de correlación con rezagos.</p>
          </div>
          <div className="cli-actions">
            <button type="button" onClick={onCorrelation} disabled={correlationRunning}>
              <Play size={16} /> {correlationRunning ? 'Calculando…' : 'Recalcular'}
            </button>
            <button type="button" onClick={onRefreshCorrelation} disabled={correlationLoading} className="ghost-button">
              <RefreshCw size={16} /> Actualizar
            </button>
          </div>
        </div>
        <div className="cli-card">
          <div>
            <h3>Generación de gráficos</h3>
            <p>Solicita gráficos PNG desde src/visualization.py.</p>
          </div>
          <form className="cli-form" onSubmit={onGeneratePlot}>
            <label>
              Tipo de gráfico
              <select value={plotType} onChange={onPlotTypeChange}>
                {plotOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {requiresYear ? (
              <label>
                Año
                <input type="number" min="2000" max="2100" value={plotYear} onChange={onPlotYearChange} />
              </label>
            ) : null}
            <div className="cli-actions">
              <button type="submit" disabled={plotRunning}>
                <Play size={16} /> {plotRunning ? 'Generando…' : 'Generar'}
              </button>
              <button type="button" onClick={onRefreshPlots} disabled={plotsLoading} className="ghost-button">
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="menu-section">
        <h4>Opciones del menú CLI</h4>
        {menuLoading ? (
          <LoadingMessage message="Consultando menú…" />
        ) : !menu?.length ? (
          <EmptyMessage message="No se encontró información del menú." />
        ) : (
          <ul className="menu-list">
            {menu.map((item) => (
              <li key={item.key}>
                <div className="menu-head">
                  <span className="menu-key">{item.key})</span>
                  <span className="menu-title">{item.label}</span>
                </div>
                <p>{item.description}</p>
                {item.parameters?.length ? (
                  <ul className="menu-params">
                    {item.parameters.map((param) => (
                      <li key={param.name}>
                        <code>{param.name}</code>
                        <span>{param.required ? ' (requerido)' : ' (opcional)'}{param.description ? ` – ${param.description}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-mark">
          <Flower2 size={20} />
        </div>
        <div>
          <h1>BloomWatch</h1>
          <p>Ciencia de datos ambiental en acción</p>
        </div>
      </div>
      <nav className="header-nav">
        {[{ label: 'Mapa', icon: <MapIcon size={16} /> }, { label: 'Series', icon: <LineChartIcon size={16} /> }, { label: 'Predicción', icon: <Gauge size={16} /> }, { label: 'Galería', icon: <ImageIcon size={16} /> }].map((item) => (
          <button key={item.label} type="button" className="nav-button">
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return <footer className="app-footer">Hecho con 🌿 para investigación ambiental.</footer>;
}

export default function App() {
  const { data: aoi } = useApiData('/aoi');
  const { data: datasets, loading: loadingDatasets, refetch: refetchDatasets } = useApiData('/datasets');
  const { data: timeseries, loading: loadingTimeseries, refetch: refetchTimeseries } = useApiData('/timeseries');
  const { data: bloom, loading: loadingBloom, refetch: refetchBloom } = useApiData('/analysis/bloom');
  const { data: correlation, loading: loadingCorrelation, refetch: refetchCorrelation } = useApiData('/analysis/correlation');
  const { data: predictions, loading: loadingPredictions, refetch: refetchPredictions } = useApiData('/predictions/bloom');
  const { data: plots, loading: loadingPlots, refetch: refetchPlots } = useApiData('/plots');
  const { data: menu, loading: loadingMenu } = useApiData('/menu');

  const [plotType, setPlotType] = useState(plotOptions[0].value);
  const currentYear = new Date().getFullYear();
  const [plotYear, setPlotYear] = useState(String(currentYear));
  const [runningBloom, setRunningBloom] = useState(false);
  const [runningCorrelation, setRunningCorrelation] = useState(false);
  const [runningPlot, setRunningPlot] = useState(false);
  const [error, setError] = useState(null);

  const requiresYear = plotType === 'ndvi_year' || plotType === 'ndvi_rain_year';

  const stats = useMemo(() => {
    const summary = {
      lastStart: '—',
      lastEnd: '—',
      lastDuration: '—',
      avgDuration: '—',
      ndviDeltaYoY: null,
      precipitation: null,
    };

    if (bloom?.length) {
      const sorted = [...bloom].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      const last = sorted[sorted.length - 1];
      summary.lastStart = last?.bloom_start ? formatDate(last.bloom_start) : '—';
      summary.lastEnd = last?.bloom_end ? formatDate(last.bloom_end) : '—';
      summary.lastDuration = last?.duration_days ? `${last.duration_days} días` : '—';
      const durations = sorted.map((item) => item.duration_days).filter((value) => typeof value === 'number');
      if (durations.length) {
        const avg = durations.reduce((acc, value) => acc + value, 0) / durations.length;
        summary.avgDuration = `${Math.round(avg)} días`;
      }
    }

    if (timeseries?.length) {
      const precipValues = timeseries
        .map((item) => (typeof item.precipitation_mm === 'number' ? item.precipitation_mm : null))
        .filter((value) => value !== null);
      if (precipValues.length) {
        const avg = precipValues.reduce((acc, value) => acc + value, 0) / precipValues.length;
        summary.precipitation = `${Math.round(avg)} mm/mes`;
      }

      const yearly = new Map();
      timeseries.forEach((item) => {
        if (!item?.date || typeof item.ndvi !== 'number') return;
        const date = new Date(item.date);
        if (Number.isNaN(date.getTime())) return;
        const year = date.getFullYear();
        if (!yearly.has(year)) {
          yearly.set(year, { sum: 0, count: 0 });
        }
        const entry = yearly.get(year);
        entry.sum += item.ndvi;
        entry.count += 1;
      });
      const years = Array.from(yearly.keys()).sort((a, b) => a - b);
      const latestYear = years[years.length - 1];
      const previousYear = years[years.length - 2];
      if (latestYear && previousYear) {
        const latest = yearly.get(latestYear);
        const previous = yearly.get(previousYear);
        if (latest.count && previous.count && previous.sum !== 0) {
          const latestAvg = latest.sum / latest.count;
          const previousAvg = previous.sum / previous.count;
          if (previousAvg !== 0) {
            summary.ndviDeltaYoY = ((latestAvg - previousAvg) / previousAvg) * 100;
          }
        }
      }
    }

    return summary;
  }, [bloom, timeseries]);

  const timeseriesData = useMemo(() => {
    if (!timeseries) return [];
    return timeseries.map((item) => ({
      ...item,
      date: formatDate(item.date, { year: 'numeric', month: 'short' }),
    }));
  }, [timeseries]);

  const correlationData = useMemo(() => {
    if (!correlation) return [];
    return correlation.map((item) => ({ ...item, r_pearson: item.r_pearson ?? 0 }));
  }, [correlation]);

  const ndviForecast = predictions?.ndvi_forecast?.map((item) => ({
    ...item,
    date: formatDate(item.date, { year: 'numeric', month: 'short' }),
  }));

  const predictionPayload = useMemo(() => {
    if (!predictions) return null;
    return { ...predictions, ndvi_forecast: ndviForecast };
  }, [predictions, ndviForecast]);

  const handleBloom = async (mode) => {
    try {
      setError(null);
      setRunningBloom(true);
      await triggerAnalysis('/analysis/bloom', { mode });
      refetchBloom();
      refetchDatasets();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setRunningBloom(false);
    }
  };

  const handleCorrelation = async () => {
    try {
      setError(null);
      setRunningCorrelation(true);
      await triggerAnalysis('/analysis/correlation', { max_lag: 3 });
      refetchCorrelation();
      refetchDatasets();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setRunningCorrelation(false);
    }
  };

  const handlePlotSubmit = async (event) => {
    event.preventDefault();
    try {
      setError(null);
      setRunningPlot(true);
      const payload = { plot: plotType };
      if (requiresYear) {
        const year = Number(plotYear);
        if (!year || Number.isNaN(year)) {
          throw new Error('Debes indicar un año válido.');
        }
        payload.year = year;
      }
      await requestPlot(payload);
      refetchPlots();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setRunningPlot(false);
    }
  };

  return (
    <div className="app">
      <Header />
      <main className="app-content">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hero"
        >
          <div className="hero-text">
            <h2>Monitoreo de floración y vegetación</h2>
            <p>
              Explora tendencias NDVI, precipitación y ventanas de floración generadas por los scripts científicos de
              BloomWatch.
            </p>
            <div className="hero-stats">
              <Stat icon={<CalendarDays size={18} />} label="Inicio reciente" value={stats.lastStart} />
              <Stat icon={<Timer size={18} />} label="Duración" value={stats.lastDuration} hint={`Promedio ${stats.avgDuration}`} />
              <Stat
                icon={<Flower2 size={18} />}
                label="Δ NDVI (YoY)"
                value={
                  typeof stats.ndviDeltaYoY === 'number'
                    ? `${stats.ndviDeltaYoY > 0 ? '+' : ''}${Math.round(stats.ndviDeltaYoY)}%`
                    : '—'
                }
              />
              <Stat icon={<Droplets size={18} />} label="Precipitación típica" value={stats.precipitation ?? '—'} />
            </div>
          </div>
          <div className="hero-status">
            <span>Estado del sistema</span>
            <strong>Listo</strong>
            <p>Datos sincronizados: NDVI · lluvia · predicciones</p>
          </div>
        </motion.div>

        <div className="layout-grid">
          <Section title="Mapa del área de estudio" icon={<MapIcon size={20} />} subtitle="Vista conceptual del polígono (SVG)">
            <AOIMap feature={aoi} />
          </Section>
          <Section title="NDVI vs precipitación" icon={<LineChartIcon size={20} />} subtitle="Serie mensual consolidada">
            <div className="chart-actions">
              <button type="button" className="text-button" onClick={refetchTimeseries}>
                <RefreshCw size={14} /> Actualizar serie
              </button>
            </div>
            {loadingTimeseries ? <LoadingMessage message="Cargando serie temporal…" /> : <NDVIRainChart data={timeseriesData} />}
          </Section>
        </div>

        <Section title="Panel de predicción" icon={<Gauge size={20} />} subtitle="Métricas del modelo y pronóstico NDVI">
          <PredictionPanel predictionData={predictionPayload} loading={loadingPredictions} onRefresh={refetchPredictions} />
        </Section>

        <Section title="Correlación lluvia → NDVI" icon={<Droplets size={20} />} subtitle="Coeficiente de Pearson por rezago">
          {loadingCorrelation ? <LoadingMessage message="Calculando correlación…" /> : <CorrelationBarChart data={correlationData} />}
        </Section>

        <Section title="Datasets disponibles" icon={<Info size={20} />} subtitle="Inventario generado por los scripts">
          <DatasetTable datasets={datasets} loading={loadingDatasets} onRefresh={refetchDatasets} />
        </Section>

        <Section title="Galería de imágenes" icon={<ImageIcon size={20} />} subtitle="Gráficos exportados desde src/visualization.py">
          <Gallery plots={plots} loading={loadingPlots} onRefresh={refetchPlots} />
        </Section>

        <Section title="Acciones rápidas (CLI)" icon={<Play size={20} />} subtitle="Relanzar análisis y generar gráficos">
          <CLIActions
            onBloomGlobal={() => handleBloom('global')}
            onBloomAnnual={() => handleBloom('annual')}
            onRefreshBloom={refetchBloom}
            bloomRunning={runningBloom}
            bloomLoading={loadingBloom}
            onCorrelation={handleCorrelation}
            onRefreshCorrelation={refetchCorrelation}
            correlationRunning={runningCorrelation}
            correlationLoading={loadingCorrelation}
            onGeneratePlot={handlePlotSubmit}
            onRefreshPlots={refetchPlots}
            plotRunning={runningPlot}
            plotsLoading={loadingPlots}
            plotType={plotType}
            onPlotTypeChange={(event) => setPlotType(event.target.value)}
            plotYear={plotYear}
            onPlotYearChange={(event) => setPlotYear(event.target.value)}
            requiresYear={requiresYear}
            menu={menu}
            menuLoading={loadingMenu}
          />
        </Section>

        {error ? (
          <div className="error-banner">{error}</div>
        ) : (
          <div className="status-banner">Todo listo para analizar.</div>
        )}

        <Footer />
      </main>
    </div>
  );
}
