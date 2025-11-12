const METERS_PER_DEGREE = 111320;

export function projectCoordinate([lng, lat], origin) {
  if (!origin) {
    return [lng, lat];
  }
  const x =
    (lng - origin.lng) *
    METERS_PER_DEGREE *
    Math.cos((origin.lat * Math.PI) / 180);
  const y = (lat - origin.lat) * METERS_PER_DEGREE;
  return [x, y];
}

export function projectPolygon(polygon, origin) {
  return polygon.map((ring) =>
    ring.map((coord) => projectCoordinate(coord, origin))
  );
}

export function projectGeometry(geometry, origin) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: projectPolygon(geometry.coordinates, origin),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) =>
        projectPolygon(polygon, origin)
      ),
    };
  }
  return null;
}

export function findProjectionOrigin(features) {
  const originFeature = features.find(
    (feature) => feature.properties?.featureType === "building"
  );
  const coord = originFeature?.geometry?.coordinates?.[0]?.[0] ?? [0, 0];
  return { lng: coord[0], lat: coord[1] };
}

export function projectFeatureCollection(featureCollection, origin, filterFn) {
  const features = featureCollection.features
    .filter((feature) => (filterFn ? filterFn(feature) : true))
    .map((feature) => {
      const geometry = projectGeometry(feature.geometry, origin);
      if (!geometry) return null;
      return {
        type: "Feature",
        properties: { ...feature.properties },
        geometry,
      };
    })
    .filter(Boolean);

  return {
    type: "FeatureCollection",
    features,
  };
}

export function toCartesianCoordinates(coordinates) {
  return coordinates.map((ring) =>
    ring.map(([x, y]) => [x, y, 0])
  );
}
