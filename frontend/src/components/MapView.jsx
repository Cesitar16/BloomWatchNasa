import PropTypes from 'prop-types';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';

const defaultCenter = [-27.8, -70.8];

export default function MapView({ geometry }) {
  if (!geometry) {
    return <p className="section-status">Cargando geometría del sitio...</p>;
  }

  const coordinates = geometry.geometry.coordinates?.[0] ?? [];
  const latLngs = coordinates
    .map(([lon, lat]) => [lat, lon])
    .filter((pair) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));

  const center = latLngs[0] ?? defaultCenter;
  const bounds = latLngs.length ? latLngs : undefined;

  return (
    <div className="map-wrapper">
      <MapContainer
        className="map-canvas"
        center={center}
        bounds={bounds}
        zoom={bounds ? 10 : 9}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &middot; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {latLngs.length > 0 && (
          <Polygon positions={latLngs} pathOptions={{ color: '#22c55e', weight: 2 }} />
        )}
      </MapContainer>
    </div>
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
