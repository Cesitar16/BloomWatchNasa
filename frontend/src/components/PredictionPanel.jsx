import PropTypes from 'prop-types';
import DataTable from './DataTable.jsx';
import ForecastChart from './ForecastChart.jsx';
import { API_BASE_URL } from '../hooks/useApi.js';

function formatPercent(value) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.parseFloat(value).toFixed(digits);
}

export default function PredictionPanel({ data, loading, onRefresh }) {
  if (loading) {
    return <p className="status">Calculando predicciones…</p>;
  }

  if (!data) {
    return (
      <div>
        <p className="status">No hay predicciones disponibles todavía.</p>
        <button onClick={onRefresh}>Intentar nuevamente</button>
      </div>
    );
  }

  const forecastRows = (data.predictions ?? []).map((item) => ({
    Fecha: item.date,
    'Prob. floración': formatPercent(item.probability),
    'Floración estimada': item.predicted ? 'Sí' : 'No',
    NDVI: formatNumber(item.ndvi, 3),
    'Origen NDVI': item.ndvi_source === 'forecast' ? 'Pronosticado' : 'Observado',
    'Precipitación (mm)': formatNumber(item.precipitation_mm, 2),
    'LST (°C)': formatNumber(item.lst_c, 1),
    'Humedad suelo': formatNumber(item.soil_moisture, 3),
    'NDVI Sentinel-2': formatNumber(item.sentinel_ndvi, 3),
  }));

  const metrics = data.metrics ?? {};
  const thresholdPercent = data.threshold != null ? `${(data.threshold * 100).toFixed(0)}%` : '—';
  const accuracy = metrics.accuracy != null ? formatPercent(metrics.accuracy) : '—';
  const rocAuc = metrics.roc_auc != null ? metrics.roc_auc.toFixed(3) : '—';
  const positiveRate = metrics.positive_rate != null ? formatPercent(metrics.positive_rate) : '—';
  const ndviRmse = metrics.ndvi_rmse != null ? metrics.ndvi_rmse.toFixed(3) : '—';
  const ndviMae = metrics.ndvi_mae != null ? metrics.ndvi_mae.toFixed(3) : '—';
  const trainingRange = data.training_range;
  const forecast = data.forecast;
  const ndviForecast = data.ndvi_forecast ?? [];
  const forecastPlot = data.ndvi_forecast_plot;
  const forecastPlotUrl = forecastPlot ? `${API_BASE_URL}${forecastPlot.url}` : null;

  return (
    <div className="prediction-panel">
      <div className="prediction-meta">
        <div className="prediction-stat">
          <span className="label">Modelo</span>
          <strong>{data.model}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">Umbral</span>
          <strong>{thresholdPercent}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">Exactitud (train)</span>
          <strong>{accuracy}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">ROC-AUC</span>
          <strong>{rocAuc}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">Meses en floración</span>
          <strong>{positiveRate}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">Muestras</span>
          <strong>{data.training_samples}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">RMSE NDVI</span>
          <strong>{ndviRmse}</strong>
        </div>
        <div className="prediction-stat">
          <span className="label">MAE NDVI</span>
          <strong>{ndviMae}</strong>
        </div>
        {trainingRange?.start && trainingRange?.end ? (
          <div className="prediction-stat" style={{ flexBasis: '100%' }}>
            <span className="label">Entrenamiento</span>
            <strong>{trainingRange.start} → {trainingRange.end}</strong>
          </div>
        ) : null}
        {forecast ? (
          <div className="prediction-stat" style={{ flexBasis: '100%' }}>
            <span className="label">Pronóstico NDVI</span>
            <strong>
              {forecast.months} meses
              {forecast.start && forecast.end ? ` (${forecast.start} → ${forecast.end})` : ''}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="prediction-actions">
        <button onClick={onRefresh}>Actualizar predicciones</button>
      </div>

      <section className="prediction-section">
        <h3>Serie NDVI observada vs pronosticada</h3>
        <ForecastChart series={ndviForecast} />
        {forecastPlot ? (
          <p className="status" style={{ marginTop: '0.75rem' }}>
            También puedes revisar el gráfico estático generado en el backend:{' '}
            <a href={forecastPlotUrl} target="_blank" rel="noreferrer">{forecastPlot.path}</a>
          </p>
        ) : null}
      </section>

      <section className="prediction-section">
        <h3>Probabilidades mensuales de floración</h3>
        <DataTable rows={forecastRows} />
      </section>
    </div>
  );
}

PredictionPanel.propTypes = {
  data: PropTypes.shape({
    model: PropTypes.string,
    threshold: PropTypes.number,
    metrics: PropTypes.shape({
      accuracy: PropTypes.number,
      roc_auc: PropTypes.number,
      positive_rate: PropTypes.number,
      ndvi_rmse: PropTypes.number,
      ndvi_mae: PropTypes.number,
    }),
    training_samples: PropTypes.number,
    training_range: PropTypes.shape({
      start: PropTypes.string,
      end: PropTypes.string,
    }),
    predictions: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string.isRequired,
        probability: PropTypes.number.isRequired,
        predicted: PropTypes.bool.isRequired,
        ndvi: PropTypes.number,
        ndvi_source: PropTypes.oneOf(['observed', 'forecast']),
        precipitation_mm: PropTypes.number,
        lst_c: PropTypes.number,
        soil_moisture: PropTypes.number,
        sentinel_ndvi: PropTypes.number,
      })
    ),
    forecast: PropTypes.shape({
      months: PropTypes.number,
      start: PropTypes.string,
      end: PropTypes.string,
      ndvi_model: PropTypes.string,
      ndvi_rmse: PropTypes.number,
      ndvi_mae: PropTypes.number,
    }),
    ndvi_forecast: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string.isRequired,
        ndvi: PropTypes.number.isRequired,
        lower: PropTypes.number,
        upper: PropTypes.number,
        source: PropTypes.oneOf(['historical', 'forecast']).isRequired,
      })
    ),
    ndvi_forecast_plot: PropTypes.shape({
      path: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
    }),
  }),
  loading: PropTypes.bool,
  onRefresh: PropTypes.func.isRequired,
};

PredictionPanel.defaultProps = {
  data: null,
  loading: false,
};
