import PropTypes from 'prop-types';
import { API_BASE_URL } from '../hooks/useApi.js';

function PlotFigure({ plot }) {
  const imageUrl = `${API_BASE_URL}${plot.url}`;
  const subtitleParts = [];
  if (plot.year) {
    subtitleParts.push(`Año ${plot.year}`);
  }
  if (plot.generated_at) {
    const date = new Date(plot.generated_at);
    if (!Number.isNaN(date.getTime())) {
      subtitleParts.push(`Actualizado ${date.toLocaleString()}`);
    }
  }

  return (
    <figure className="plot-item">
      <img src={imageUrl} alt={`Gráfico ${plot.plot_type}`} loading="lazy" />
      <figcaption>
        <strong>{plot.name}</strong>
        {subtitleParts.length ? <span>{subtitleParts.join(' · ')}</span> : null}
      </figcaption>
    </figure>
  );
}

PlotFigure.propTypes = {
  plot: PropTypes.shape({
    name: PropTypes.string.isRequired,
    plot_type: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    generated_at: PropTypes.string,
    year: PropTypes.number
  }).isRequired
};

export default function PlotGallery({ plots }) {
  if (!plots || plots.length === 0) {
    return <p className="status">Aún no se han generado gráficos desde los scripts de visualización.</p>;
  }

  return (
    <div className="plot-gallery">
      {plots.map((plot) => (
        <PlotFigure plot={plot} key={plot.path} />
      ))}
    </div>
  );
}

PlotGallery.propTypes = {
  plots: PropTypes.arrayOf(PlotFigure.propTypes.plot)
};
