import PropTypes from 'prop-types';

export default function DashboardSection({ title, subtitle, icon, actions, children, fullWidth }) {
  return (
    <section className={`dashboard-section${fullWidth ? ' dashboard-section--wide' : ''}`}>
      <header className="dashboard-section__head">
        <div className="dashboard-section__title">
          {icon ? <span className="dashboard-section__icon" aria-hidden="true">{icon}</span> : null}
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="dashboard-section__actions">{actions}</div> : null}
      </header>
      <div className="dashboard-section__content">{children}</div>
    </section>
  );
}

DashboardSection.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  icon: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
  fullWidth: PropTypes.bool
};

DashboardSection.defaultProps = {
  subtitle: undefined,
  icon: null,
  actions: null,
  fullWidth: false
};
