import { useMemo, useState } from 'react';
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
import {
  CalendarDays,
  Droplets,
  Flower2,
  Gauge,
  Image as ImageIcon,
  Info,
  LineChart as LineChartIcon,
  Map as MapIcon,
  Play,
  RefreshCw,
  Timer
} from 'lucide-react';
import { motion } from 'framer-motion';
import MapView from './components/MapView.jsx';
import { API_BASE_URL, requestPlot, triggerAnalysis, useApiData } from './hooks/useApi.js';

const plotOptions = [
  { value: 'ndvi_trend', label: 'Tendencia NDVI con floración' },
  { value: 'ndvi_year', label: 'NDVI de un año específico' },
  { value: 'features_overview', label: 'Serie multivariable 2015-2025' },
  { value: 'ndvi_rain_year', label: 'NDVI vs lluvia por año' }
];

const monthFormatter = new Intl.DateTimeFormat('es', { month: 'short' });
const fullDateFormatter = new Intl.DateTimeFormat('es', {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
});

function Section({ title, icon, subtitle, children }) {
  return (
    <section className="section-card">
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

function DatasetTable({ rows, onRefresh, loading }) {
  return (
    <div className="dataset-card">
      <div className="dataset-toolbar">
        <span>Inventario de archivos procesados</span>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {loading && !rows?.length ? (
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

function Gallery({ plots, loading, onRefresh }) {
  return (
    <div className="gallery-card">
      <div className="gallery-toolbar">
        <span>Resultados guardados en data/results</span>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {loading && !plots?.length ? (
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

function PredictionPanel({ data, loading, onRefresh, pending }) {
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
  pendingAction
}) {
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
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="brand-icon">
            <Flower2 />
          </div>
          <div>
            <h1>BloomWatch</h1>
            <p>Ciencia de datos ambiental en acción</p>
          </div>
        </div>
        <nav className="header-nav">
          <button type="button">
            <MapIcon /> Mapa
          </button>
          <button type="button">
            <LineChartIcon /> Series
          </button>
          <button type="button">
            <Gauge /> Predicción
          </button>
          <button type="button">
            <ImageIcon /> Galería
          </button>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return <footer className="app-footer">Hecho con 🌿 para investigación ambiental.</footer>;
}

export default function App() {
  const { data: aoi } = useApiData('/aoi');
  const { data: datasets, loading: loadingDatasets, refetch: refetchDatasets } = useApiData('/datasets');
  const {
    data: timeseries,
    loading: loadingTimeseries,
    refetch: refetchTimeseries
  } = useApiData('/timeseries');
  const { data: bloom, loading: loadingBloom, refetch: refetchBloom } = useApiData('/analysis/bloom');
  const {
    data: correlation,
    loading: loadingCorrelation,
    refetch: refetchCorrelation
  } = useApiData('/analysis/correlation');
  const {
    data: predictions,
    loading: loadingPredictions,
    refetch: refetchPredictions
  } = useApiData('/predictions/bloom');
  const { data: menuOptions } = useApiData('/menu');
  const {
    data: plots,
    loading: loadingPlots,
    refetch: refetchPlots
  } = useApiData('/plots');

  const [pendingAction, setPendingAction] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [plotType, setPlotType] = useState(plotOptions[0].value);
  const [plotYear, setPlotYear] = useState(String(new Date().getFullYear()));

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
            <strong>{loadingBloom || loadingTimeseries ? 'Actualizando…' : 'Listo'}</strong>
            <span>NDVI • Lluvia • AOI sincronizados</span>
          </div>
        </motion.div>

        {globalError && <div className="global-error">{globalError}</div>}

        <div className="map-series-grid">
          <Section
            title="Mapa del área de estudio"
            icon={<MapIcon />}
            subtitle="Geometría provista por el backend"
          >
            <MapView geometry={aoi} />
          </Section>
          <Section
            title="NDVI vs precipitación"
            icon={<LineChartIcon />}
            subtitle="Serie temporal combinada"
          >
            {loadingTimeseries ? (
              <p className="section-status">Cargando serie temporal…</p>
            ) : (
              <NDVIRainChart data={ndviSeries} />
            )}
          </Section>
        </div>

        <Section
          title="Panel de predicción"
          icon={<Gauge />}
          subtitle="Métricas y pronóstico NDVI"
        >
          <PredictionPanel
            data={predictions}
            loading={loadingPredictions}
            onRefresh={handlePredictions}
            pending={pendingAction === 'predictions'}
          />
        </Section>

        <Section
          title="Correlación lluvia → NDVI"
          icon={<Droplets />}
          subtitle="Coeficiente de Pearson por rezago"
        >
          {loadingCorrelation ? (
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
          />
        </Section>

        <Section title="Galería de imágenes" icon={<ImageIcon />} subtitle="Gráficos generados desde src/visualization.py">
          <Gallery plots={plots} loading={loadingPlots} onRefresh={refetchPlots} />
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
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
