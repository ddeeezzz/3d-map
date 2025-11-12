import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import { projectCoordinate, findProjectionOrigin } from "../lib/coordinates.js";
import { SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";

const data = JSON.parse(rawGeojson);
const ROAD_HEIGHT = 0.2;
const DEFAULT_LANE_WIDTH = 3.5;

function determineRoadColor() {
  return config.colors.道路 || "#d0d0d0";
}

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function estimateRoadWidth(properties = {}) {
  const width = parsePositiveNumber(properties.width);
  if (width) {
    return width;
  }

  const lanes = parsePositiveNumber(properties.lanes);
  if (lanes) {
    return lanes * DEFAULT_LANE_WIDTH;
  }

  const highwayType = properties.highway;
  if (highwayType && config.roadWidths?.[highwayType]) {
    return config.roadWidths[highwayType];
  }

  return config.roadWidths?.默认 || 6;
}

function projectLineString(coordinates, origin) {
  const projected = [];

  for (const coord of coordinates) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    projected.push(new THREE.Vector2(x, y));
  }

  return projected;
}

function buildRoadGeometry(points, thickness) {
  if (points.length < 2 || thickness <= 0) {
    return null;
  }

  const halfWidth = thickness / 2;
  const normals = points.map(() => new THREE.Vector2(0, 0));

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const direction = new THREE.Vector2().subVectors(next, current);
    if (direction.lengthSq() === 0) continue;
    direction.normalize();
    const normal = new THREE.Vector2(-direction.y, direction.x);
    normals[i].add(normal);
    normals[i + 1].add(normal);
  }

  let fallbackNormal = new THREE.Vector2(0, 1);
  const leftSide = [];
  const rightSide = [];

  for (let i = 0; i < points.length; i += 1) {
    const baseNormal = normals[i];
    let normal = baseNormal.clone();
    if (normal.lengthSq() === 0) {
      normal = fallbackNormal.clone();
    } else {
      normal.normalize();
      fallbackNormal = normal.clone();
    }

    const offset = normal.clone().multiplyScalar(halfWidth);
    leftSide.push(new THREE.Vector2().addVectors(points[i], offset));
    rightSide.push(new THREE.Vector2().subVectors(points[i], offset));
  }

  if (leftSide.length < 2 || rightSide.length < 2) {
    return null;
  }

  const contour = [...leftSide, ...rightSide.reverse()];
  if (contour.length < 3) {
    return null;
  }

  if (!contour[0].equals(contour[contour.length - 1])) {
    contour.push(contour[0].clone());
  }

  const shape = new THREE.Shape(contour);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: ROAD_HEIGHT,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function toSegments(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates;
  }
  return [];
}

export function buildRoads(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const color = determineRoadColor();
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.95,
  });

  const group = new THREE.Group();
  group.name = "roads";

  const baseSceneScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;

  for (const feature of data.features) {
    const properties = feature.properties || {};
    if (properties.featureType !== "road") continue;

    const segments = toSegments(feature.geometry);
    if (!segments.length) continue;

    const estimatedWidth = estimateRoadWidth(properties);
    const thickness = estimatedWidth / baseSceneScale;

    for (const segment of segments) {
      const projected = projectLineString(segment, origin);
      const geometry = buildRoadGeometry(projected, thickness);
      if (!geometry) continue;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.userData = {
        stableId:
          properties.stableId ||
          properties.id ||
          feature.id ||
          `road-${mesh.uuid}`,
        highway: properties.highway || "未知道路等级",
        name: properties.name || "未命名道路",
        estimatedWidth,
      };
      group.add(mesh);
    }
  }

  scene.add(group);
  return group;
}
