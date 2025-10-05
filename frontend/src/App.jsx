import { useMemo, useState } from 'react';
import MapView from './components/MapView.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import BloomChart from './components/BloomChart.jsx';
import CorrelationChart from './components/CorrelationChart.jsx';
import DataTable from './components/DataTable.jsx';
import { triggerAnalysis, useApiData } from './hooks/useApi.js';

export default function App() {
  const { data: aoi } = useApiData('/aoi');
  const { data: datasets, refetch: refetchDatasets } = useApiData('/datasets');
  const { data: timeseries, loading: loadingTs, refetch: refetchTs } = useApiData('/timeseries');
  const { data: bloom, loading: loadingBloom, refetch: refetchBloom } = useApiData('/analysis/bloom');
  const { data: correlation, loading: loadingCorr, refetch: refetchCorr } = useApiData('/analysis/correlation');

  const [runningBloom, setRunningBloom] = useState(false);
  const [runningCorr, setRunningCorr] = useState(false);
  const [error, setError] = useState(null);

  const datasetRows = useMemo(() => {
    if (!datasets) return [];
    return datasets.map((item) => ({
      Archivo: item.name,
      Tipo: item.kind,
      Filas: item.rows ?? '—'
    }));
  }, [datasets]);

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
