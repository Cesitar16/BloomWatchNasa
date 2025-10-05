import PropTypes from 'prop-types';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CorrelationChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="status">Sin resultados de correlación disponibles.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
        <XAxis dataKey="lag_months" label={{ value: 'Desfase (meses)', position: 'insideBottom', offset: -5 }} />
        <YAxis domain={[-1, 1]} label={{ value: 'r de Pearson', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Bar dataKey="r_pearson" fill="#22c55e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

CorrelationChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      lag_months: PropTypes.number.isRequired,
      r_pearson: PropTypes.number,
      n_pairs: PropTypes.number
    })
  )
};
