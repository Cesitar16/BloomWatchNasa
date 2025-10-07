import { useMemo, useState } from 'react';
import MapView from './components/MapView.jsx';
import BloomChart from './components/BloomChart.jsx';
import CorrelationChart from './components/CorrelationChart.jsx';
import DataTable from './components/DataTable.jsx';
import PlotGallery from './components/PlotGallery.jsx';
import PredictionPanel from './components/PredictionPanel.jsx';
import DashboardHeader from './components/layout/DashboardHeader.jsx';
import DashboardFooter from './components/layout/DashboardFooter.jsx';
import DashboardSection from './components/layout/DashboardSection.jsx';
import HeroPanel from './components/HeroPanel.jsx';
import StatCard from './components/StatCard.jsx';
import MenuActions from './components/MenuActions.jsx';
import { requestPlot, triggerAnalysis, useApiData } from './hooks/useApi.js';

const plotOptions = [
  { value: 'ndvi_trend', label: 'Tendencia NDVI con floración' },
  { value: 'ndvi_year', label: 'NDVI de un año específico' },
  { value: 'features_overview', label: 'Serie multivariable 2015-2025' },
  { value: 'ndvi_rain_year', label: 'NDVI vs lluvia por año' }
];

export default function App() {
  const { data: aoi } = useApiData('/aoi');
  const { data: datasets, loading: loadingDatasets, refetch: refetchDatasets } = useApiData('/datasets');
  const { data: timeseries, loading: loadingTs, refetch: refetchTs } = useApiData('/timeseries');
  const { data: bloom, loading: loadingBloom, refetch: refetchBloom } = useApiData('/analysis/bloom');
  const { data: correlation, loading: loadingCorr, refetch: refetchCorr } = useApiData('/analysis/correlation');
  const { data: predictions, loading: loadingPredictions, refetch: refetchPredictions } = useApiData('/predictions/bloom');
  const { data: menuOptions, loading: loadingMenu, error: menuError, refetch: refetchMenu } = useApiData('/menu');
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

  const heroStats = useMemo(() => {
    const latest = bloom?.[bloom.length - 1];
    const durations = bloom?.map((d) => d.duration_days).filter((value) => typeof value === 'number') ?? [];
    const avgDuration = durations.length ? Math.round(durations.reduce((acc, cur) => acc + cur, 0) / durations.length) : null;

    const sortedTimeseries = timeseries ? [...timeseries].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
    const lastYear = sortedTimeseries.slice(-12);
    const prevYear = sortedTimeseries.slice(-24, -12);

    const average = (arr, key) => {
      if (!arr.length) return null;
      const values = arr.map((item) => item[key]).filter((value) => typeof value === 'number');
      if (!values.length) return null;
      return values.reduce((acc, cur) => acc + cur, 0) / values.length;
    };

    const recentNdvi = average(lastYear, 'ndvi');
    const previousNdvi = average(prevYear, 'ndvi');
    const ndviDelta =
      recentNdvi != null && previousNdvi != null && previousNdvi !== 0
        ? ((recentNdvi - previousNdvi) / previousNdvi) * 100
        : null;

    const precipitation = average(lastYear, 'precipitation_mm');

    return [
      {
        label: 'Inicio reciente',
        card: (
          <StatCard
            icon={<span aria-hidden="true">📅</span>}
            label="Inicio reciente"
            value={latest?.bloom_start ?? '—'}
            hint={latest?.bloom_end ? `Fin ${latest.bloom_end}` : undefined}
            tone="emerald"
          />
        )
      },
      {
        label: 'Duración promedio',
        card: (
          <StatCard
            icon={<span aria-hidden="true">⏱️</span>}
            label="Duración promedio"
            value={avgDuration != null ? `${avgDuration} días` : '—'}
            hint={latest?.duration_days ? `Último ciclo: ${latest.duration_days} días` : undefined}
            tone="sky"
          />
        )
      },
      {
        label: 'Δ NDVI interanual',
        card: (
          <StatCard
            icon={<span aria-hidden="true">🌿</span>}
            label="Δ NDVI interanual"
            value={ndviDelta != null ? `${ndviDelta >= 0 ? '+' : ''}${ndviDelta.toFixed(1)}%` : '—'}
            hint="Comparación últimos 12 meses"
            tone="emerald"
          />
        )
      },
      {
        label: 'Precipitación típica',
        card: (
          <StatCard
            icon={<span aria-hidden="true">💧</span>}
            label="Precipitación típica"
            value={precipitation != null ? `${Math.round(precipitation)} mm/mes` : '—'}
            hint="Promedio móvil anual"
            tone="slate"
          />
        )
      }
    ];
  }, [bloom, timeseries]);

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
      refetchPlots();
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message);
    } finally {
      setRunningPlot(false);
    }
  };

  const systemStatus = {
    title: loadingBloom || loadingTs || loadingCorr ? 'Sincronizando' : 'Listo',
    hint: loadingBloom || loadingTs || loadingCorr ? 'Actualizando cálculos y series.' : 'NDVI · Lluvia · AOI sincronizados'
  };

  return (
    <div className="dashboard-shell">
      <DashboardHeader />

      <main className="dashboard-main">
        <HeroPanel
          stats={heroStats}
          description="Explora tendencias NDVI, precipitación y ventanas de floración calculadas con los procesos actuales."
          systemStatus={systemStatus}
          onRunGlobal={() => handleBloom('global')}
          onRunAnnual={() => handleBloom('annual')}
          onRefresh={refetchBloom}
          running={runningBloom}
          loading={loadingBloom}
        />

        <div className="dashboard-grid">
          <DashboardSection
            title="Mapa del área de estudio"
            subtitle="Vista general del polígono AOI"
            icon={<span className="icon-circle" aria-hidden="true">🗺️</span>}
          >
            <MapView geometry={aoi} />
          </DashboardSection>

          <DashboardSection
            title="NDVI vs precipitación"
            subtitle="Series temporales normalizadas"
            icon={<span className="icon-circle" aria-hidden="true">📈</span>}
            actions={(
              <div className="section-actions">
                <button type="button" onClick={refetchTs} disabled={loadingTs}>
                  {loadingTs ? 'Actualizando…' : 'Actualizar serie'}
                </button>
              </div>
            )}
          >
            {loadingTs ? <p className="status">Cargando serie temporal…</p> : <BloomChart timeseries={timeseries} />}
          </DashboardSection>
        </div>

        <DashboardSection
          title="Panel de predicción"
          subtitle="Métricas de clasificación y pronóstico NDVI"
          icon={<span className="icon-circle" aria-hidden="true">🎯</span>}
          fullWidth
        >
          <PredictionPanel data={predictions} loading={loadingPredictions} onRefresh={refetchPredictions} />
        </DashboardSection>

        <DashboardSection
          title="Correlación lluvia → NDVI"
          subtitle="Coeficiente de Pearson por rezago"
          icon={<span className="icon-circle" aria-hidden="true">🌧️</span>}
          actions={(
            <div className="section-actions">
              <button type="button" onClick={handleCorrelation} disabled={runningCorr}>
                {runningCorr ? 'Procesando…' : 'Recalcular'}
              </button>
              <button type="button" className="button--ghost" onClick={refetchCorr} disabled={loadingCorr}>
                {loadingCorr ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
          )}
        >
          {loadingCorr ? <p className="status">Calculando…</p> : <CorrelationChart data={correlation} />}
        </DashboardSection>

        <DashboardSection
          title="Conjuntos de datos disponibles"
          subtitle="Resumen de archivos procesados"
          icon={<span className="icon-circle" aria-hidden="true">🗂️</span>}
          actions={(
            <button type="button" className="button--ghost" onClick={refetchDatasets} disabled={loadingDatasets}>
              {loadingDatasets ? 'Actualizando…' : 'Actualizar listado'}
            </button>
          )}
        >
          {loadingDatasets && !datasets ? <p className="status">Revisando archivos…</p> : <DataTable rows={datasetRows} />}
        </DashboardSection>

        <DashboardSection
          title="Gráficos generados"
          subtitle="Solicitudes a src/visualization.py"
          icon={<span className="icon-circle" aria-hidden="true">🖼️</span>}
          fullWidth
          actions={(
            <button type="button" className="button--ghost" onClick={refetchPlots} disabled={loadingPlots}>
              {loadingPlots ? 'Actualizando…' : 'Actualizar listado'}
            </button>
          )}
        >
          <form className="plot-controls" onSubmit={handleGeneratePlot}>
            <label htmlFor="plot-type">
              Tipo de gráfico
              <select id="plot-type" value={plotType} onChange={handlePlotTypeChange}>
                {plotOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {requiresYear ? (
              <label htmlFor="plot-year">
                Año
                <input
                  id="plot-year"
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
            </div>
          </form>
          {loadingPlots ? <p className="status">Revisando gráficos disponibles…</p> : <PlotGallery plots={plots} />}
        </DashboardSection>

        <DashboardSection
          title="Acciones rápidas (CLI)"
          subtitle="Comandos disponibles reutilizados desde el backend"
          icon={<span className="icon-circle" aria-hidden="true">⚙️</span>}
          fullWidth
        >
          <MenuActions menu={menuOptions} loading={loadingMenu} error={menuErrorMessage} onRefresh={refetchMenu} />
        </DashboardSection>

        <DashboardSection
          title="Mensajes"
          subtitle="Estatus general del dashboard"
          icon={<span className="icon-circle" aria-hidden="true">ℹ️</span>}
          fullWidth
        >
          {error ? <p className="status status--error">{error}</p> : <p className="status">Todo listo para analizar.</p>}
        </DashboardSection>
      </main>

      <DashboardFooter />
    </div>
  );
}
