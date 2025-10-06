import PropTypes from 'prop-types';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';

const defaultCenter = [-27.8, -70.8];

export default function MapView({ geometry }) {
  if (!geometry) {
    return <p className="status">Cargando geometría del sitio...</p>;
  }

  const coordinates = geometry.geometry.coordinates?.[0] ?? [];
  const latLngs = coordinates.map(([lat, lon]) => [lat, lon]);

  return (
    <MapContainer center={latLngs[0] ?? defaultCenter} zoom={9} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {latLngs.length > 0 && (
        <Polygon positions={latLngs} pathOptions={{ color: '#2563eb', weight: 2 }} />
      )}
    </MapContainer>
  );
}

MapView.propTypes = {
  geometry: PropTypes.shape({
    geometry: PropTypes.shape({
      coordinates: PropTypes.arrayOf(PropTypes.array)
    })
  })
};
