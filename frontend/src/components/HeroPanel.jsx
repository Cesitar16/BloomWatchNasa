import PropTypes from 'prop-types';

export default function HeroPanel({
  stats,
  description,
  systemStatus,
  onRunGlobal,
  onRunAnnual,
  onRefresh,
  running,
  loading
}) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__content">
        <h2>Monitoreo de floraciones y vegetación</h2>
        <p>{description}</p>

        <div className="hero-panel__actions">
          <button type="button" onClick={onRunGlobal} disabled={running}>
            {running ? 'Procesando…' : 'Recalcular (umbral global)'}
          </button>
          <button type="button" onClick={onRunAnnual} disabled={running}>
            {running ? 'Procesando…' : 'Recalcular (umbral anual)'}
          </button>
          <button type="button" onClick={onRefresh} disabled={loading} className="button--ghost">
            {loading ? 'Actualizando…' : 'Actualizar resumen'}
          </button>
        </div>
      </div>

      <aside className="hero-panel__status" aria-label="Estado del sistema">
        <div className="hero-panel__status-card">
          <p className="hero-panel__status-label">Estado del sistema</p>
          <p className="hero-panel__status-value">{systemStatus.title}</p>
          <p className="hero-panel__status-hint">{systemStatus.hint}</p>
        </div>
      </aside>

      <div className="hero-panel__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="hero-panel__stat">
            {stat.card}
          </div>
        ))}
      </div>
    </section>
  );
}

HeroPanel.propTypes = {
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      card: PropTypes.node.isRequired
    })
  ).isRequired,
  description: PropTypes.string.isRequired,
  systemStatus: PropTypes.shape({
    title: PropTypes.string.isRequired,
    hint: PropTypes.string.isRequired
  }).isRequired,
  onRunGlobal: PropTypes.func.isRequired,
  onRunAnnual: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  running: PropTypes.bool,
  loading: PropTypes.bool
};

HeroPanel.defaultProps = {
  running: false,
  loading: false
};
