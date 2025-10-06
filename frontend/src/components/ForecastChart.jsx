import PropTypes from 'prop-types';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

function buildChartData(series) {
  return series.map((point) => {
    const isForecast = point.source !== 'historical';
    const lower = isForecast ? (point.lower ?? point.ndvi) : 0;
    const upper = isForecast ? (point.upper ?? point.ndvi) : 0;
    const band = isForecast ? Math.max(0, upper - lower) : 0;

    return {
      date: point.date,
      historical: !isForecast ? point.ndvi : null,
      forecast: isForecast ? point.ndvi : null,
      lower,
      band,
      intervalLower: isForecast ? lower : null,
      intervalUpper: isForecast ? lower + band : null,
      isForecast
    };
  });
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const items = payload.reduce((acc, entry) => {
    if (entry.dataKey === 'historical' && entry.value != null) {
      acc.push({ label: 'NDVI observado', value: entry.value });
    }
    if (entry.dataKey === 'forecast' && entry.value != null) {
      acc.push({ label: 'NDVI pronosticado', value: entry.value });
    }
    if (entry.dataKey === 'band') {
      const { intervalLower, intervalUpper } = entry.payload;
      if (intervalLower != null && intervalUpper != null) {
        acc.push({ label: 'Intervalo 95%', value: `${intervalLower.toFixed(3)} – ${intervalUpper.toFixed(3)}` });
      }
    }
    return acc;
  }, []);

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <strong>{typeof item.value === 'number' ? item.value.toFixed(3) : item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

ForecastTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string
};

export default function ForecastChart({ series }) {
  if (!series || series.length === 0) {
    return <p className="status">No hay información de pronóstico NDVI.</p>;
  }

  const chartData = buildChartData(series);
  const forecastStart = chartData.find((item) => item.isForecast);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
        <XAxis dataKey="date" minTickGap={20} tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} label={{ value: 'NDVI', angle: -90, position: 'insideLeft' }} />
        <Tooltip content={<ForecastTooltip />} />
        <Legend />
        <Area
          type="monotone"
          dataKey="lower"
          stackId="forecast"
          stroke="none"
          fill="rgba(124, 58, 237, 0)"
          fillOpacity={0}
          isAnimationActive={false}
          name=""
        />
        <Area
          type="monotone"
          dataKey="band"
          stackId="forecast"
          stroke="none"
          fill="rgba(124, 58, 237, 0.2)"
          isAnimationActive={false}
          name="Intervalo 95%"
        />
        <Line
          type="monotone"
          dataKey="historical"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          connectNulls
          name="NDVI observado"
        />
        <Line
          type="monotone"
          dataKey="forecast"
          stroke="#7c3aed"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          connectNulls
          name="NDVI pronosticado"
        />
        {forecastStart ? (
          <ReferenceLine x={forecastStart.date} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Pronóstico', position: 'top' }} />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

ForecastChart.propTypes = {
  series: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      ndvi: PropTypes.number.isRequired,
      lower: PropTypes.number,
      upper: PropTypes.number,
      source: PropTypes.oneOf(['historical', 'forecast']).isRequired
    })
  )
};
