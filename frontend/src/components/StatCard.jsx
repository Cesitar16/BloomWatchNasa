import PropTypes from 'prop-types';

export default function StatCard({ icon, label, value, hint, tone }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__icon" aria-hidden="true">{icon}</span>
      <div>
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        {hint ? <p className="stat-card__hint">{hint}</p> : null}
      </div>
    </article>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  hint: PropTypes.string,
  tone: PropTypes.oneOf(['emerald', 'sky', 'slate', 'amber'])
};

StatCard.defaultProps = {
  hint: undefined,
  tone: 'emerald'
};
