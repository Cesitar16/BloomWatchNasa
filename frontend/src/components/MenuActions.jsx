import PropTypes from 'prop-types';

export default function MenuActions({ menu, loading, error, onRefresh }) {
  if (loading) {
    return <p className="status">Consultando menú…</p>;
  }

  if (error) {
    return (
      <div className="status status--error">
        <p>No se pudo cargar el menú ({error}).</p>
        <button type="button" onClick={onRefresh} className="button--ghost">Reintentar</button>
      </div>
    );
  }

  if (!menu?.length) {
    return <p className="status">No hay comandos registrados.</p>;
  }

  return (
    <div className="menu-actions">
      {menu.map((item) => (
        <article key={item.key} className="menu-actions__item">
          <header>
            <span className="menu-actions__key">{item.key}</span>
            <h3>{item.label}</h3>
          </header>
          <p>{item.description}</p>
          {item.parameters?.length ? (
            <ul className="menu-actions__params">
              {item.parameters.map((param) => (
                <li key={param.name}>
                  <code>{param.name}</code>
                  <span>{param.required ? 'Requerido' : 'Opcional'} · {param.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="menu-actions__buttons">
            <button type="button" disabled>
              <span aria-hidden="true">▶</span> Ejecutar
            </button>
            <button type="button" className="button--ghost" onClick={onRefresh}>
              <span aria-hidden="true">↻</span> Actualizar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

MenuActions.propTypes = {
  menu: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      parameters: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string.isRequired,
          required: PropTypes.bool,
          description: PropTypes.string
        })
      )
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func
};

MenuActions.defaultProps = {
  menu: [],
  loading: false,
  error: null,
  onRefresh: () => {}
};
