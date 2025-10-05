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

  return (
    <div className="app-shell">
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
