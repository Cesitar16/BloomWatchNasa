import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';

const defaultCenter = [-27.8, -70.8];
const fallbackBounds = [
  [defaultCenter[0] - 0.5, defaultCenter[1] - 0.5],
  [defaultCenter[0] + 0.5, defaultCenter[1] + 0.5]
];

function toLatLngPairs(geometry) {
  const coordinates = geometry?.geometry?.coordinates?.[0];
  if (!Array.isArray(coordinates)) {
    return [];
  }
  return coordinates
    .map(([lon, lat]) => [lat, lon])
    .filter(
      (pair) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        Number.isFinite(pair[0]) &&
        Number.isFinite(pair[1])
    );
}

function computeBounds(latLngs) {
  if (!latLngs.length) {
    return null;
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  latLngs.forEach(([lat, lng]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });

  if (!Number.isFinite(minLat) || !Number.isFinite(maxLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLng)) {
    return null;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng]
  ];
}

function computeCenter(latLngs) {
  if (!latLngs.length) {
    return defaultCenter;
  }

  const sums = latLngs.reduce(
    (acc, [lat, lng]) => {
      acc.lat += lat;
      acc.lng += lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return [sums.lat / latLngs.length, sums.lng / latLngs.length];
}

export default function MapView({ geometry }) {
  const latLngs = useMemo(() => toLatLngPairs(geometry), [geometry]);
  const bounds = useMemo(() => computeBounds(latLngs) ?? fallbackBounds, [latLngs]);
  const center = useMemo(() => computeCenter(latLngs), [latLngs]);

  if (!geometry) {
    return <p className="section-status">Cargando geometría del sitio...</p>;
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        key={`${center[0]}-${center[1]}-${bounds[0][0]}-${bounds[0][1]}`}
        className="map-canvas"
        center={center}
        bounds={bounds}
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
  );
}

MapView.propTypes = {
  geometry: PropTypes.shape({
    geometry: PropTypes.shape({
      coordinates: PropTypes.arrayOf(PropTypes.array)
    })
  })
};
