import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { motion } from 'framer-motion';
import MapView from './components/MapView.jsx';
import { API_BASE_URL, requestPlot, triggerAnalysis, useApiData } from './hooks/useApi.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function IconBase({ className, children, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const CalendarDays = (props) => (
  <IconBase {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4" />
    <path d="M3 10h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
  </IconBase>
);

const Droplets = (props) => (
  <IconBase {...props}>
    <path d="M12 3c2.5 3.5 5 6.5 5 9.5a5 5 0 1 1-10 0C7 9.5 9.5 6.5 12 3Z" />
    <path d="M9 12a3 3 0 0 0 6 0" />
  </IconBase>
);

const Flower2 = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 4c1.2-2 4.8-2 6 0 1.2 2-.3 4.6-2.5 5.2" />
    <path d="M20 12c2 1.2 2 4.8 0 6-2 1.2-4.6-.3-5.2-2.5" />
    <path d="M12 20c-1.2 2-4.8 2-6 0-1.2-2 .3-4.6 2.5-5.2" />
    <path d="M4 12c-2-1.2-2-4.8 0-6 2-1.2 4.6.3 5.2 2.5" />
  </IconBase>
);

const Gauge = (props) => (
  <IconBase {...props}>
    <path d="M12 20a8 8 0 1 1 8-8" />
    <path d="m12 12 4-4" />
    <path d="M12 20v2" />
  </IconBase>
);

const ImageIcon = (props) => (
  <IconBase {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m21 16-4.5-4.5a1 1 0 0 0-1.4 0L11 16" />
  </IconBase>
);

const Info = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </IconBase>
);

const LineChartIcon = (props) => (
  <IconBase {...props}>
    <path d="M3 3v18h18" />
    <path d="m7 14 4-5 3 3 5-6" />
  </IconBase>
);

const MapIcon = (props) => (
  <IconBase {...props}>
    <path d="M10 4 4 6v14l6-2 4 2 6-2V4l-6 2-4-2Z" />
    <path d="M10 4v14" />
    <path d="M14 6v14" />
  </IconBase>
);

const Play = (props) => (
  <IconBase {...props}>
    <path d="M8 5v14l11-7Z" />
  </IconBase>
);

const RefreshCw = (props) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 6v6h-6" />
  </IconBase>
);

const Timer = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="14" r="8" />
    <path d="M12 14 15 11" />
    <path d="M9 2h6" />
    <path d="M12 4v2" />
  </IconBase>
);
import { useMemo, useState } from 'react';
import MapView from './components/MapView.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import BloomChart from './components/BloomChart.jsx';
import CorrelationChart from './components/CorrelationChart.jsx';
import DataTable from './components/DataTable.jsx';
import PlotGallery from './components/PlotGallery.jsx';
import PredictionPanel from './components/PredictionPanel.jsx';
import { requestPlot, triggerAnalysis, useApiData } from './hooks/useApi.js';

const plotOptions = [
  { value: 'ndvi_trend', label: 'Tendencia NDVI con floración' },
  { value: 'ndvi_year', label: 'NDVI de un año específico' },
  { value: 'features_overview', label: 'Serie multivariable 2015-2025' },
  { value: 'ndvi_rain_year', label: 'NDVI vs lluvia por año' }
];

const SECTION_SCROLL_TARGETS = {
  '/mapa': 'section-mapa',
  '/series': 'section-series',
  '/prediccion': 'section-prediccion',
  '/galeria': 'section-galeria'
};

const NAVIGATION_LINKS = [
  { path: '/mapa', label: 'Mapa', Icon: MapIcon },
  { path: '/series', label: 'Series', Icon: LineChartIcon },
  { path: '/prediccion', label: 'Predicción', Icon: Gauge },
  { path: '/galeria', label: 'Galería', Icon: ImageIcon }
];

const monthFormatter = new Intl.DateTimeFormat('es', { month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('es', {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
});

function formatErrorMessage(error) {
  if (!error) return null;
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.message) {
    return error.message;
  }
  return 'Se produjo un error al consultar el backend.';
}

function Section({ id, title, icon, subtitle, children }) {
  return (
    <section className="section-card" id={id}>
      <div className="section-header">
        <div className="section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="stat-block">
      <div className="stat-icon">{icon}</div>
      <div className="stat-copy">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

function NDVIRainChart({ data }) {
  if (!data?.length) {
    return <p className="section-status">Aún no hay serie NDVI/precipitación procesada.</p>;
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={8} minTickGap={24} />
          <YAxis
            yAxisId="left"
            domain={[0, 1]}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.toFixed(2)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value} mm`}
          />
          <Tooltip formatter={(value, name) => [value, name === 'ndvi' ? 'NDVI' : 'Precipitación (mm)']} />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="ndvi"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            name="NDVI"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="precipitation_mm"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Precipitación"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CorrelationBarChart({ data }) {
  if (!data?.length) {
    return <p className="section-status">Genera la correlación lluvia → NDVI para visualizarla aquí.</p>;
  }

  const domainMax = Math.min(1, Math.max(0.5, ...data.map((d) => Math.abs(d.r_pearson ?? 0))));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis dataKey="lag_months" label={{ value: 'Rezago (meses)', position: 'insideBottom', offset: -4 }} />
          <YAxis domain={[0, domainMax]} tickFormatter={(value) => value.toFixed(2)} />
          <Tooltip formatter={(value) => value?.toFixed?.(2)} />
          <Bar dataKey="r_pearson" fill="#1e88e5" radius={[6, 6, 0, 0]} name="r Pearson" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NDVIForecastArea({ data }) {
  if (!data?.length) {
    return <p className="section-status">El pronóstico NDVI aparecerá cuando ejecutes la predicción.</p>;
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ndviArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis dataKey="date" tickMargin={8} minTickGap={24} />
          <YAxis domain={[0, 1]} tickFormatter={(value) => value.toFixed(2)} />
          <Tooltip />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
          <Area type="monotone" dataKey="upper" stroke="#93c5fd" fill="#93c5fd55" name="Límite superior" />
          <Area type="monotone" dataKey="lower" stroke="#86efac" fill="#86efac55" name="Límite inferior" />
          <Area type="monotone" dataKey="ndvi" stroke="#16a34a" fill="url(#ndviArea)" name="NDVI" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DatasetTable({ rows, onRefresh, loading, error }) {
  const errorMessage = formatErrorMessage(error);

  return (
    <div className="dataset-card">
      <div className="dataset-toolbar">
        <span>Inventario de archivos procesados</span>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {errorMessage ? (
        <div className="section-status section-error">
          <span>{errorMessage}</span>
          <button type="button" onClick={onRefresh} disabled={loading}>
            Reintentar
          </button>
        </div>
      ) : loading && !rows?.length ? (
        <p className="section-status">Cargando datasets…</p>
      ) : rows?.length ? (
        <div className="dataset-table-wrapper">
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
              {rows.map((row) => (
                <tr key={row.path}>
                  <td>{row.name}</td>
                  <td>
                    <span className={`dataset-kind dataset-kind-${row.kind}`}>{row.kind}</span>
                  </td>
                  <td>{row.rows ?? '—'}</td>
                  <td className="dataset-path">{row.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="section-status">No se encontraron archivos en la API.</p>
      )}
    </div>
  );
}

function Gallery({ plots, loading, onRefresh, error }) {
  const errorMessage = formatErrorMessage(error);

  return (
    <div className="gallery-card">
      <div className="gallery-toolbar">
        <span>Resultados guardados en data/results</span>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {errorMessage ? (
        <div className="section-status section-error">
          <span>{errorMessage}</span>
          <button type="button" onClick={onRefresh} disabled={loading}>
            Reintentar
          </button>
        </div>
      ) : loading && !plots?.length ? (
        <p className="section-status">Buscando gráficos generados…</p>
      ) : plots?.length ? (
        <div className="gallery-grid">
          {plots.map((plot) => (
            <figure key={plot.path ?? plot.name} className="gallery-item">
              <div className="gallery-preview">
                <img
                  src={plot.url ? `${API_BASE_URL}${plot.url}` : plot.path}
                  alt={plot.name}
                  loading="lazy"
                />
              </div>
              <figcaption>
                <strong>{plot.name}</strong>
                <span>{plot.plot_type}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="section-status">Aún no hay imágenes generadas.</p>
      )}
    </div>
  );
}

function PredictionPanel({ data, loading, onRefresh, pending, error }) {
  const errorMessage = formatErrorMessage(error);

  if (errorMessage && !loading) {
    return (
      <div className="prediction-empty">
        <p>{errorMessage}</p>
        <button type="button" onClick={onRefresh} disabled={pending || loading}>
          {pending || loading ? 'Procesando…' : 'Reintentar'}
        </button>
      </div>
    );
  }

  if (loading && !data) {
    return <p className="section-status">Calculando modelo de floración…</p>;
  }

  if (!data) {
    return (
      <div className="prediction-empty">
        <p>No hay predicciones disponibles todavía.</p>
        <button type="button" onClick={onRefresh} disabled={pending}>
          {pending ? 'Procesando…' : 'Generar predicción'}
        </button>
      </div>
    );
  }

  const { metrics, predictions, ndvi_forecast: forecastSeries } = data;
  const metricItems = [
    metrics?.accuracy != null && { label: 'Accuracy', value: metrics.accuracy.toFixed(2) },
    metrics?.roc_auc != null && { label: 'ROC AUC', value: metrics.roc_auc.toFixed(2) },
    metrics?.ndvi_rmse != null && { label: 'NDVI RMSE', value: metrics.ndvi_rmse.toFixed(2) },
    metrics?.ndvi_mae != null && { label: 'NDVI MAE', value: metrics.ndvi_mae.toFixed(2) },
    metrics?.positive_rate != null && { label: 'Tasa positiva', value: (metrics.positive_rate * 100).toFixed(1) + '%' }
  ].filter(Boolean);

  const sortedPredictions = [...(predictions ?? [])].sort((a, b) => {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);
    return aDate - bDate;
  });
  const gridItems = sortedPredictions.slice(0, 12);

  return (
    <div className="prediction-grid">
      <div className="prediction-sidebar">
        <div className="prediction-toolbar">
          <span>Modelo: {data.model}</span>
          <button type="button" onClick={onRefresh} disabled={pending}>
            {pending ? 'Procesando…' : 'Recalcular'}
          </button>
        </div>
        <div className="metrics-grid">
          {metricItems.length ? (
            metricItems.map((metric) => (
              <div key={metric.label} className="metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))
          ) : (
            <p className="section-status">No hay métricas calculadas.</p>
          )}
        </div>
        <div className="prediction-months">
          <p>Probabilidad mensual de floración</p>
          <div className="prediction-grid-months">
            {gridItems.length ? (
              gridItems.map((item) => {
                const monthDate = new Date(item.date);
                const hasDate = !Number.isNaN(monthDate.getTime());
                const probability = Number.isFinite(item.probability) ? item.probability : null;
                const display = probability != null ? `${Math.round(probability * 100)}%` : '—';
                const statusClass = probability != null && probability >= data.threshold
                  ? 'high'
                  : probability != null && probability >= data.threshold * 0.7
                  ? 'medium'
                  : 'low';
                return (
                  <div key={item.date} className={`prediction-chip prediction-${statusClass}`}>
                    <span>{hasDate ? monthFormatter.format(monthDate) : item.date}</span>
                    <strong>{display}</strong>
                  </div>
                );
              })
            ) : (
              <p className="section-status">El modelo no devolvió probabilidades.</p>
            )}
          </div>
        </div>
      </div>
      <div className="prediction-chart">
        <NDVIForecastArea data={forecastSeries} />
      </div>
    </div>
  );
}

function CLIActions({
  menu,
  onRunBloom,
  onRunCorrelation,
  onRunPredictions,
  onRunPlot,
  plotType,
  onPlotTypeChange,
  plotYear,
  onPlotYearChange,
  requiresYear,
  pendingAction,
  error,
  onReloadMenu,
  loadingMenu
}) {
  const errorMessage = formatErrorMessage(error);

  if (errorMessage) {
    return (
      <div className="section-status section-error">
        <span>{errorMessage}</span>
        {onReloadMenu && (
          <button type="button" onClick={onReloadMenu} disabled={loadingMenu}>
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (!menu?.length) {
    return <p className="section-status">El backend no expuso opciones del menú CLI.</p>;
  }

  return (
    <div className="cli-grid">
      {menu.map((item) => {
        const key = item.key;
        if (key === '2') {
          return (
            <div key={key} className="cli-card">
              <div>
                <p className="cli-title">{item.label}</p>
                <p className="cli-description">{item.description}</p>
              </div>
              <div className="cli-actions">
                <button type="button" className="cli-primary" onClick={() => onRunBloom('global')} disabled={pendingAction === 'bloom'}>
                  {pendingAction === 'bloom' ? 'Procesando…' : 'Umbral global'}
                </button>
                <button type="button" className="cli-secondary" onClick={() => onRunBloom('annual')} disabled={pendingAction === 'bloom'}>
                  {pendingAction === 'bloom' ? 'Procesando…' : 'Umbral anual'}
                </button>
              </div>
            </div>
          );
        }
        if (key === '6') {
          return (
            <div key={key} className="cli-card">
              <div>
                <p className="cli-title">{item.label}</p>
                <p className="cli-description">{item.description}</p>
              </div>
              <div className="cli-actions">
                <button type="button" className="cli-primary" onClick={onRunCorrelation} disabled={pendingAction === 'correlation'}>
                  {pendingAction === 'correlation' ? 'Procesando…' : 'Generar correlación'}
                </button>
              </div>
            </div>
          );
        }
        if (key === '3') {
          return (
            <div key={key} className="cli-card">
              <div>
                <p className="cli-title">{item.label}</p>
                <p className="cli-description">{item.description}</p>
              </div>
              <form className="plot-form" onSubmit={onRunPlot}>
                <label>
                  Tipo de gráfico
                  <select value={plotType} onChange={onPlotTypeChange}>
                    {plotOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {requiresYear && (
                  <label>
                    Año
                    <input type="number" value={plotYear} onChange={onPlotYearChange} min="2000" max="2100" />
                  </label>
                )}
                <button type="submit" className="cli-primary" disabled={pendingAction === 'plot'}>
                  {pendingAction === 'plot' ? 'Generando…' : 'Crear gráfico'}
                </button>
              </form>
            </div>
          );
        }
        if (key === '8') {
          return (
            <div key={key} className="cli-card">
              <div>
                <p className="cli-title">{item.label}</p>
                <p className="cli-description">{item.description}</p>
              </div>
              <div className="cli-actions">
                <button type="button" className="cli-primary" onClick={onRunPredictions} disabled={pendingAction === 'predictions'}>
                  {pendingAction === 'predictions' ? 'Procesando…' : 'Reentrenar modelo'}
                </button>
              </div>
            </div>
          );
        }
        return (
          <div key={key} className="cli-card cli-card-disabled">
            <div>
              <p className="cli-title">{item.label}</p>
              <p className="cli-description">{item.description}</p>
            </div>
            <span className="cli-hint">Disponible solo desde la terminal.</span>
          </div>
        );
      })}
    </div>
  );
}

function Header() {
  const location = useLocation();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="header-brand">
          <div className="brand-icon">
            <Flower2 />
          </div>
          <div>
            <h1>BloomWatch</h1>
            <p>Ciencia de datos ambiental en acción</p>
          </div>
        </Link>
        <nav className="header-nav">
          {NAVIGATION_LINKS.map(({ path, label, Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`header-nav-link${isActive ? ' header-nav-link-active' : ''}`}
              >
                <Icon /> {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return <footer className="app-footer">Hecho con 🌿 para investigación ambiental.</footer>;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    data: aoi,
    loading: loadingAoi,
    error: errorAoi,
    refetch: refetchAoi
  } = useApiData('/aoi');
  const {
    data: datasets,
    loading: loadingDatasets,
    error: errorDatasets,
    refetch: refetchDatasets
  } = useApiData('/datasets');
  const {
    data: timeseries,
    loading: loadingTimeseries,
    error: errorTimeseries,
    refetch: refetchTimeseries
  } = useApiData('/timeseries');
  const {
    data: bloom,
    loading: loadingBloom,
    error: errorBloom,
    refetch: refetchBloom
  } = useApiData('/analysis/bloom');
  const {
    data: correlation,
    loading: loadingCorrelation,
    error: errorCorrelation,
    refetch: refetchCorrelation
  } = useApiData('/analysis/correlation');
  const {
    data: predictions,
    loading: loadingPredictions,
    error: errorPredictions,
    refetch: refetchPredictions
  } = useApiData('/predictions/bloom');
  const {
    data: menuOptions,
    loading: loadingMenu,
    error: errorMenu,
    refetch: refetchMenu
  } = useApiData('/menu');
  const {
    data: plots,
    loading: loadingPlots,
    error: errorPlots,
    refetch: refetchPlots
  } = useApiData('/plots');

  const [pendingAction, setPendingAction] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [plotType, setPlotType] = useState(plotOptions[0].value);
  const [plotYear, setPlotYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    const path = location.pathname || '/';
    if (path === '/' || path === '') {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const targetId = SECTION_SCROLL_TARGETS[path];
    if (!targetId) {
      navigate('/', { replace: true });
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }

    const headerOffset = 88;
    const elementPosition = element.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = Math.max(elementPosition - headerOffset, 0);

    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }, [location.pathname, navigate]);

  const ndviSeries = useMemo(() => {
    if (!timeseries?.length) return [];
    return timeseries
      .map((row) => ({
        date: row.date,
        ndvi: row.ndvi ?? null,
        precipitation_mm: row.precipitation_mm ?? null
      }))
      .filter((row) => row.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [timeseries]);

  const bloomStats = useMemo(() => {
    if (!bloom?.length) {
      return null;
    }
    const ordered = [...bloom].sort((a, b) => a.year - b.year);
    const latest = ordered[ordered.length - 1];
    const durations = ordered
      .map((item) => item.duration_days)
      .filter((value) => Number.isFinite(value));
    const avgDuration = durations.length
      ? Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length)
      : null;

    let ndviDelta = null;
    if (ndviSeries.length >= 24) {
      const last12 = ndviSeries.slice(-12).map((row) => row.ndvi).filter((value) => value != null);
      const prev12 = ndviSeries
        .slice(-24, -12)
        .map((row) => row.ndvi)
        .filter((value) => value != null);
      if (last12.length && prev12.length) {
        const lastAvg = last12.reduce((a, b) => a + b, 0) / last12.length;
        const prevAvg = prev12.reduce((a, b) => a + b, 0) / prev12.length;
        ndviDelta = prevAvg === 0 ? null : (lastAvg - prevAvg) / Math.abs(prevAvg);
      }
    }

    const precipValues = ndviSeries
      .map((row) => row.precipitation_mm)
      .filter((value) => Number.isFinite(value));
    const precipAvg = precipValues.length
      ? Math.round(precipValues.reduce((a, b) => a + b, 0) / precipValues.length)
      : null;

    const formatDate = (value) => {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return fullDateFormatter.format(date);
    };

    return {
      lastStart: latest?.bloom_start ? formatDate(latest.bloom_start) : '—',
      lastEnd: latest?.bloom_end ? formatDate(latest.bloom_end) : '—',
      lastDuration: latest?.duration_days ?? null,
      avgDuration,
      ndviDelta,
      precipAvg
    };
  }, [bloom, ndviSeries]);

  const requiresYear = plotType === 'ndvi_year' || plotType === 'ndvi_rain_year';

  const anyLoading =
    loadingAoi ||
    loadingDatasets ||
    loadingTimeseries ||
    loadingBloom ||
    loadingCorrelation ||
    loadingPredictions ||
    loadingPlots ||
    loadingMenu ||
    pendingAction !== null;
  const firstError =
    errorAoi ||
    errorDatasets ||
    errorTimeseries ||
    errorBloom ||
    errorCorrelation ||
    errorPredictions ||
    errorPlots ||
    errorMenu;
  const heroStatusLabel = firstError ? 'Revisa el backend' : anyLoading ? 'Actualizando…' : 'Listo';
  const heroStatusHint = firstError
    ? formatErrorMessage(firstError)
    : 'NDVI • Lluvia • AOI sincronizados';

  const handleBloom = async (mode) => {
    try {
      setGlobalError(null);
      setPendingAction('bloom');
      await triggerAnalysis('/analysis/bloom', { mode });
      await Promise.all([refetchBloom(), refetchTimeseries(), refetchPlots()]);
    } catch (error) {
      setGlobalError(error.response?.data?.detail ?? error.message);
    } finally {
      setPendingAction(null);
export default function App() {
  const { data: aoi } = useApiData('/aoi');
  const { data: datasets, refetch: refetchDatasets } = useApiData('/datasets');
  const { data: timeseries, loading: loadingTs, refetch: refetchTs } = useApiData('/timeseries');
  const { data: bloom, loading: loadingBloom, refetch: refetchBloom } = useApiData('/analysis/bloom');
  const { data: correlation, loading: loadingCorr, refetch: refetchCorr } = useApiData('/analysis/correlation');
  const { data: predictions, loading: loadingPredictions, refetch: refetchPredictions } = useApiData('/predictions/bloom');
  const { data: menuOptions, loading: loadingMenu, error: menuError } = useApiData('/menu');
  const { data: plots, loading: loadingPlots, refetch: refetchPlots } = useApiData('/plots');

  const [runningBloom, setRunningBloom] = useState(false);
  const [runningCorr, setRunningCorr] = useState(false);
  const [runningPlot, setRunningPlot] = useState(false);
  const [plotType, setPlotType] = useState(plotOptions[0].value);
  const currentYear = new Date().getFullYear();
  const [plotYear, setPlotYear] = useState(String(currentYear));
  const [error, setError] = useState(null);

  const datasetRows = useMemo(() => {
    if (!datasets) return [];
    return datasets.map((item) => ({
      Archivo: item.name,
      Tipo: item.kind,
      Filas: item.rows ?? '—'
    }));
  }, [datasets]);

  const menuErrorMessage = menuError?.response?.data?.detail ?? menuError?.message;
  const requiresYear = plotType === 'ndvi_year' || plotType === 'ndvi_rain_year';

  const handlePlotTypeChange = (event) => {
    setPlotType(event.target.value);
  };

  const handlePlotYearChange = (event) => {
    setPlotYear(event.target.value);
  };

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
      setGlobalError(null);
      setPendingAction('correlation');
      await triggerAnalysis('/analysis/correlation', { max_lag: 3 });
      await refetchCorrelation();
    } catch (error) {
      setGlobalError(error.response?.data?.detail ?? error.message);
    } finally {
      setPendingAction(null);
    }
  };

  const handlePredictions = async () => {
    try {
      setGlobalError(null);
      setPendingAction('predictions');
      await refetchPredictions();
    } catch (error) {
      setGlobalError(error.response?.data?.detail ?? error.message);
    } finally {
      setPendingAction(null);
    }
  };

  const handlePlotSubmit = async (event) => {
    event.preventDefault();
    try {
      setGlobalError(null);
      setPendingAction('plot');
      const payload = { plot: plotType };
      if (requiresYear) {
        const numericYear = Number(plotYear);
        if (!Number.isFinite(numericYear)) {
      setError(null);
      setRunningCorr(true);
      await triggerAnalysis('/analysis/correlation', { max_lag: 3 });
      refetchCorr();
      refetchDatasets();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setRunningCorr(false);
    }
  };

  const handleGeneratePlot = async (event) => {
    event.preventDefault();
    try {
      setError(null);
      setRunningPlot(true);
      const payload = { plot: plotType };
      if (requiresYear) {
        const numericYear = Number(plotYear);
        if (!numericYear || Number.isNaN(numericYear)) {
          throw new Error('Debes indicar un año válido.');
        }
        payload.year = numericYear;
      }
      await requestPlot(payload);
      await refetchPlots();
    } catch (error) {
      setGlobalError(error.response?.data?.detail ?? error.message);
    } finally {
      setPendingAction(null);
      refetchPlots();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setRunningPlot(false);
    }
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="hero-card"
        >
          <div className="hero-copy">
            <h2>Monitoreo de Floración y Vegetación</h2>
            <p>
              Explora tendencias NDVI, precipitación y ventanas de floración generadas por el pipeline existente en BloomWatch.
            </p>
            <div className="hero-stats">
              <Stat
                icon={<CalendarDays className="stat-icon-figure" />}
                label="Inicio reciente"
                value={bloomStats?.lastStart ?? '—'}
              />
              <Stat
                icon={<Timer className="stat-icon-figure" />}
                label="Duración"
                value={bloomStats?.lastDuration ? `${bloomStats.lastDuration} días` : '—'}
                hint={bloomStats?.avgDuration ? `Promedio ${bloomStats.avgDuration} días` : undefined}
              />
              <Stat
                icon={<Flower2 className="stat-icon-figure" />}
                label="Δ NDVI (YoY)"
                value={
                  bloomStats?.ndviDelta != null
                    ? `${(bloomStats.ndviDelta * 100).toFixed(0)}%`
                    : '—'
                }
              />
              <Stat
                icon={<Droplets className="stat-icon-figure" />}
                label="Precipitación típica"
                value={bloomStats?.precipAvg ? `~${bloomStats.precipAvg} mm/mes` : '—'}
              />
            </div>
          </div>
          <div className="hero-status">
            <p>Estado del sistema</p>
            <strong>{heroStatusLabel}</strong>
            <span>{heroStatusHint}</span>
          </div>
        </motion.div>

        {globalError && <div className="global-error">{globalError}</div>}

        <div className="map-series-grid">
          <Section
            id="section-mapa"
            title="Mapa del área de estudio"
            icon={<MapIcon />}
            subtitle="Geometría provista por el backend"
          >
            {errorAoi ? (
              <div className="section-status section-error">
                <span>{formatErrorMessage(errorAoi)}</span>
                <button type="button" onClick={refetchAoi} disabled={loadingAoi}>
                  Reintentar
                </button>
              </div>
            ) : loadingAoi ? (
              <p className="section-status">Cargando geometría del sitio…</p>
            ) : (
              <MapView geometry={aoi} />
            )}
          </Section>
          <Section
            id="section-series"
            title="NDVI vs precipitación"
            icon={<LineChartIcon />}
            subtitle="Serie temporal combinada"
          >
            {errorTimeseries ? (
              <div className="section-status section-error">
                <span>{formatErrorMessage(errorTimeseries)}</span>
                <button type="button" onClick={refetchTimeseries} disabled={loadingTimeseries}>
                  Reintentar
                </button>
              </div>
            ) : loadingTimeseries ? (
              <p className="section-status">Cargando serie temporal…</p>
            ) : (
              <NDVIRainChart data={ndviSeries} />
            )}
          </Section>
        </div>

        <Section
          id="section-prediccion"
          title="Panel de predicción"
          icon={<Gauge />}
          subtitle="Métricas y pronóstico NDVI"
        >
          <PredictionPanel
            data={predictions}
            loading={loadingPredictions}
            onRefresh={handlePredictions}
            pending={pendingAction === 'predictions'}
            error={errorPredictions}
          />
        </Section>

        <Section
          title="Correlación lluvia → NDVI"
          icon={<Droplets />}
          subtitle="Coeficiente de Pearson por rezago"
        >
          {errorCorrelation ? (
            <div className="section-status section-error">
              <span>{formatErrorMessage(errorCorrelation)}</span>
              <button type="button" onClick={refetchCorrelation} disabled={loadingCorrelation}>
                Reintentar
              </button>
            </div>
          ) : loadingCorrelation ? (
            <p className="section-status">Consultando correlaciones…</p>
          ) : (
            <CorrelationBarChart data={correlation} />
          )}
        </Section>

        <Section title="Datasets disponibles" icon={<Info />} subtitle="Inventario de archivos procesados">
          <DatasetTable
            rows={datasets}
            loading={loadingDatasets}
            onRefresh={refetchDatasets}
            error={errorDatasets}
          />
        </Section>

        <Section
          id="section-galeria"
          title="Galería de imágenes"
          icon={<ImageIcon />}
          subtitle="Gráficos generados desde src/visualization.py"
        >
          <Gallery plots={plots} loading={loadingPlots} onRefresh={refetchPlots} error={errorPlots} />
        </Section>

        <Section
          title="Acciones rápidas (CLI)"
          icon={<Play />}
          subtitle="Orquesta tareas del menú principal"
        >
          <CLIActions
            menu={menuOptions}
            onRunBloom={handleBloom}
            onRunCorrelation={handleCorrelation}
            onRunPredictions={handlePredictions}
            onRunPlot={handlePlotSubmit}
            plotType={plotType}
            onPlotTypeChange={(event) => setPlotType(event.target.value)}
            plotYear={plotYear}
            onPlotYearChange={(event) => setPlotYear(event.target.value)}
            requiresYear={requiresYear}
            pendingAction={pendingAction}
            error={errorMenu}
            onReloadMenu={refetchMenu}
            loadingMenu={loadingMenu}
          />
        </Section>
      </main>
      <Footer />
      <header>
        <h1>BloomWatch Dashboard</h1>
        <p>Monitorea la floración y la relación con precipitaciones usando los procesamientos existentes.</p>
      </header>
      <main>
        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Área de estudio</h2>
          <MapView geometry={aoi} />
        </section>

        <section className="card">
          <h2>Resumen de floración</h2>
          {loadingBloom ? <p className="status">Consultando resultados...</p> : <SummaryCards bloomData={bloom} />}
          <div className="status" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => handleBloom('global')} disabled={runningBloom}>
              {runningBloom ? 'Procesando…' : 'Recalcular (umbral global)'}
            </button>
            <button onClick={() => handleBloom('annual')} disabled={runningBloom}>
              {runningBloom ? 'Procesando…' : 'Recalcular (umbral anual)'}
            </button>
            <button onClick={refetchBloom} disabled={loadingBloom}>Actualizar</button>
          </div>
        </section>

        <section className="card">
          <h2>Conjuntos de datos disponibles</h2>
          {datasets ? <DataTable rows={datasetRows} /> : <p className="status">Revisando archivos…</p>}
          <button onClick={refetchDatasets} style={{ marginTop: '1rem' }}>
            Actualizar listado
          </button>
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Series NDVI &amp; precipitación</h2>
          {loadingTs ? <p className="status">Cargando serie temporal…</p> : <BloomChart timeseries={timeseries} />}
          <button onClick={refetchTs} style={{ marginTop: '1rem' }}>Actualizar serie</button>
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Predicción de floraciones próximas</h2>
          <PredictionPanel data={predictions} loading={loadingPredictions} onRefresh={refetchPredictions} />
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Gráficos generados desde src/visualization.py</h2>
          <form className="plot-controls" onSubmit={handleGeneratePlot}>
            <label>
              Tipo de gráfico
              <select value={plotType} onChange={handlePlotTypeChange}>
                {plotOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {requiresYear ? (
              <label>
                Año
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={plotYear}
                  onChange={handlePlotYearChange}
                />
              </label>
            ) : null}
            <div className="plot-actions">
              <button type="submit" disabled={runningPlot}>
                {runningPlot ? 'Generando…' : 'Generar gráfico'}
              </button>
              <button type="button" onClick={refetchPlots} disabled={loadingPlots}>
                {loadingPlots ? 'Actualizando…' : 'Actualizar listado'}
              </button>
            </div>
          </form>
          {loadingPlots ? (
            <p className="status">Revisando gráficos disponibles…</p>
          ) : (
            <PlotGallery plots={plots} />
          )}
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Opciones del menú CLI reutilizadas</h2>
          {loadingMenu ? (
            <p className="status">Consultando menú…</p>
          ) : menuError ? (
            <p className="error">No se pudo cargar el menú ({menuErrorMessage}).</p>
          ) : (
            <ul className="menu-list">
              {menuOptions?.map((option) => (
                <li key={option.key}>
                  <div className="menu-item-head">
                    <span className="menu-key">{option.key})</span>
                    <span className="menu-label">{option.label}</span>
                  </div>
                  <p>{option.description}</p>
                  {option.parameters?.length ? (
                    <ul className="menu-params">
                      {option.parameters.map((param) => (
                        <li key={param.name}>
                          <code>{param.name}</code>
                          <span>{param.required ? ' (requerido)' : ' (opcional)'} – {param.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Correlación lluvia → NDVI</h2>
          {loadingCorr ? <p className="status">Calculando…</p> : <CorrelationChart data={correlation} />}
          <div className="status" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={handleCorrelation} disabled={runningCorr}>
              {runningCorr ? 'Procesando…' : 'Recalcular correlación'}
            </button>
            <button onClick={refetchCorr} disabled={loadingCorr}>Actualizar</button>
          </div>
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Mensajes</h2>
          {error ? <p className="error">{error}</p> : <p className="status">Todo listo para analizar.</p>}
        </section>
      </main>
    </div>
  );
}
