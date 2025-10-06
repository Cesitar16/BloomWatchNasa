import PropTypes from 'prop-types';
import { useMemo } from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';

const defaultCenter = [-27.8, -70.8];

const fallback = (() => {
  const base = L.latLngBounds([
    [defaultCenter[0] - 0.5, defaultCenter[1] - 0.5],
    [defaultCenter[0] + 0.5, defaultCenter[1] + 0.5]
  ]);
  return {
    bounds: base,
    center: base.getCenter()
  };
})();

function buildGeoJSONFeature(geometry) {
  if (!geometry) return null;

  if (geometry.type === 'Feature') {
    return geometry;
  }

  if (geometry.geometry) {
    return {
      type: 'Feature',
      properties: geometry.properties ?? {},
      geometry: geometry.geometry
    };
  }

  if (geometry.type && geometry.coordinates) {
    return {
      type: 'Feature',
      properties: {},
      geometry
    };
  }

  return null;
}

export default function MapView({ geometry }) {
  const { feature, bounds, center } = useMemo(() => {
    const geojsonFeature = buildGeoJSONFeature(geometry);

    if (!geojsonFeature) {
      return { feature: null, bounds: fallback.bounds, center: fallback.center };
    }

    try {
      const layer = L.geoJSON(geojsonFeature);
      const derivedBounds = layer.getBounds();

      if (!derivedBounds.isValid()) {
        return { feature: geojsonFeature, bounds: fallback.bounds, center: fallback.center };
      }

      return {
        feature: geojsonFeature,
        bounds: derivedBounds,
        center: derivedBounds.getCenter()
      };
    } catch (error) {
      console.error('No se pudo interpretar la geometría del AOI:', error);
      return { feature: null, bounds: fallback.bounds, center: fallback.center };
    }
  }, [geometry]);

  if (!geometry) {
    return <p className="section-status">Cargando geometría del sitio...</p>;
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        key={`${center.lat ?? center[0]}-${center.lng ?? center[1]}`}
        className="map-canvas"
        center={center}
        bounds={bounds}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &middot; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {feature && <GeoJSON data={feature} pathOptions={{ color: '#22c55e', weight: 2, fillOpacity: 0.2 }} />}
      </MapContainer>
    </div>
  );
}

MapView.propTypes = {
  geometry: PropTypes.oneOfType([
    PropTypes.shape({
      type: PropTypes.string,
      coordinates: PropTypes.array
    }),
    PropTypes.shape({
      type: PropTypes.string,
      properties: PropTypes.object,
      geometry: PropTypes.object
    })
  ])
};
