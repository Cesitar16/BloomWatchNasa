import PropTypes from 'prop-types';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function BloomChart({ timeseries }) {
  if (!timeseries || timeseries.length === 0) {
    return <p className="status">Se necesitan datos de NDVI para graficar.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={timeseries} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
        <YAxis yAxisId="left" label={{ value: 'NDVI', angle: -90, position: 'insideLeft' }} domain={[0, 1]} />
        <YAxis yAxisId="right" orientation="right" label={{ value: 'Precipitación (mm)', angle: -90, position: 'insideRight' }} />
        <Tooltip />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="ndvi" stroke="#2563eb" dot={false} name="NDVI" />
        <Area yAxisId="right" type="monotone" dataKey="precipitation_mm" fill="#38bdf8" stroke="#0ea5e9" name="Precipitación" opacity={0.6} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

BloomChart.propTypes = {
  timeseries: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      ndvi: PropTypes.number,
      precipitation_mm: PropTypes.number
    })
  )
};
