import PropTypes from 'prop-types';
import DataTable from './DataTable.jsx';

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
  const trainingRange = data.training_range;

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
        {trainingRange?.start && trainingRange?.end ? (
          <div className="prediction-stat" style={{ flexBasis: '100%' }}>
            <span className="label">Entrenamiento</span>
            <strong>{trainingRange.start} → {trainingRange.end}</strong>
          </div>
        ) : null}
      </div>

      <div className="prediction-actions">
        <button onClick={onRefresh}>Actualizar predicciones</button>
      </div>

      <DataTable rows={forecastRows} />
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
        precipitation_mm: PropTypes.number,
        lst_c: PropTypes.number,
        soil_moisture: PropTypes.number,
        sentinel_ndvi: PropTypes.number,
      })
    ),
  }),
  loading: PropTypes.bool,
  onRefresh: PropTypes.func.isRequired,
};

PredictionPanel.defaultProps = {
  data: null,
  loading: false,
};
