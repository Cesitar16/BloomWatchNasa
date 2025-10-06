import PropTypes from 'prop-types';

function SummaryItem({ title, value, subtitle }) {
  return (
    <div className="summary-card">
      <strong>{title}</strong>
      <span>{value}</span>
      {subtitle && <small className="status">{subtitle}</small>}
    </div>
  );
}

SummaryItem.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  subtitle: PropTypes.string
};

export default function SummaryCards({ bloomData }) {
  if (!bloomData || bloomData.length === 0) {
    return <p className="status">Aún no hay resultados de floración.</p>;
  }

  const latest = bloomData[bloomData.length - 1];
  const durations = bloomData.map((d) => d.duration_days);
  const avgDuration = durations.reduce((acc, cur) => acc + cur, 0) / durations.length;

  return (
    <div className="summary-grid">
      <SummaryItem
        title={`Último año analizado (${latest.year})`}
        value={`${latest.bloom_start} → ${latest.bloom_end}`}
        subtitle={`Duración: ${latest.duration_days} días`}
      />
      <SummaryItem
        title="Duración promedio"
        value={`${Math.round(avgDuration)} días`}
        subtitle={`Años con floración: ${bloomData.length}`}
      />
    </div>
  );
}

SummaryCards.propTypes = {
  bloomData: PropTypes.arrayOf(
    PropTypes.shape({
      year: PropTypes.number.isRequired,
      bloom_start: PropTypes.string.isRequired,
      bloom_end: PropTypes.string.isRequired,
      duration_days: PropTypes.number.isRequired
    })
  )
};
