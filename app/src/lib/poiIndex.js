import poiRaw from "../data/pois.geojson?raw";
import campusRaw from "../data/campus.geojson?raw";
import { projectCoordinate, findProjectionOrigin } from "./coordinates";

const poiData = JSON.parse(poiRaw);
const campusData = JSON.parse(campusRaw);
const projectionOrigin = findProjectionOrigin(campusData.features || []);

const poiByName = new Map();
const poiList = [];

(poiData.features || []).forEach((feature) => {
  const props = feature.properties || {};
  const name = props.name?.trim();
  if (!name) return;
  const coordinate = feature.geometry?.coordinates;
  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    return;
  }
  const [projectedX, projectedY] = projectCoordinate(coordinate, projectionOrigin);
  const record = {
    poiId: props.poiId,
    name,
    worldX: projectedX,
    worldZ: -projectedY,
    coordinate,
  };
  if (!poiByName.has(name)) {
    poiByName.set(name, record);
  }
  poiList.push(record);
});

export function findPoiByName(name) {
  if (!name) return null;
  return poiByName.get(name.trim()) || null;
}

export function listPoiNames() {
  return Array.from(poiByName.keys());
}

export function getPoiRecords() {
  return poiList.slice();
}
