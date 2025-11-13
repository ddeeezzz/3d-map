import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import { projectCoordinate, findProjectionOrigin } from "../lib/coordinates.js";
import { SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";

const data = JSON.parse(rawGeojson);
const EPSILON = 1e-6;

function sanitizeRing(ring, origin) {
  const projected = [];
  for (const coord of ring) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    projected.push(new THREE.Vector2(x, y));
  }
  return projected;
}

function prepareClosedRing(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }
  const closed = points.map((point) =>
    point instanceof THREE.Vector2 ? point.clone() : new THREE.Vector2(point.x, point.y),
  );
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (last && last.equals(first)) {
    closed.pop();
  }
  closed.push(first.clone());
  return closed;
}

function buildBoundaryGeometry(points, thickness, height) {
  if (thickness <= 0 || height <= 0) {
    return null;
  }

  const closedPoints = prepareClosedRing(points);
  if (closedPoints.length < 2) {
    return null;
  }

  const halfWidth = thickness / 2;
  const leftSide = [];
  const rightSide = [];
  let fallbackNormal = new THREE.Vector2(0, 1);

  const segmentCount = closedPoints.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const current = closedPoints[i];
    const prev = i === 0 ? closedPoints[segmentCount - 1] : closedPoints[i - 1];
    const next = closedPoints[i + 1];

    let dirPrev = new THREE.Vector2().subVectors(current, prev);
    let dirNext = new THREE.Vector2().subVectors(next, current);

    const prevLen = dirPrev.lengthSq();
    const nextLen = dirNext.lengthSq();

    if (prevLen <= EPSILON && nextLen <= EPSILON) {
      continue;
    }

    if (prevLen <= EPSILON) {
      dirPrev = dirNext.clone();
    }
    if (nextLen <= EPSILON) {
      dirNext = dirPrev.clone();
    }

    dirPrev.normalize();
    dirNext.normalize();

    const normalPrev = new THREE.Vector2(-dirPrev.y, dirPrev.x);
    const normalNext = new THREE.Vector2(-dirNext.y, dirNext.x);
    let normal = new THREE.Vector2().addVectors(normalPrev, normalNext);

    if (normal.lengthSq() === 0) {
      normal = fallbackNormal.clone();
    } else {
      normal.normalize();
      fallbackNormal = normal.clone();
    }

    const offset = normal.clone().multiplyScalar(halfWidth);
    leftSide.push(new THREE.Vector2().addVectors(current, offset));
    rightSide.push(new THREE.Vector2().subVectors(current, offset));
  }

  if (leftSide.length < 3 || rightSide.length < 3) {
    return null;
  }

const contour = [...leftSide, ...rightSide.reverse()];
  if (!contour[0].equals(contour[contour.length - 1])) {
    contour.push(contour[0].clone());
  }

  const shape = new THREE.Shape(contour);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export const __boundaryInternals = {
  sanitizeRing,
  projectRingWithDuplicates: sanitizeRing,
  prepareClosedRing,
  buildBoundaryGeometry,
};

export function buildBoundary(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const color = config.colors?.围墙 || "#f5deb3";
  const boundaryWidth = Number(config.boundary?.width) || 1;
  const boundaryHeight = Number(config.boundary?.height) || 2;
  const baseScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const thickness = boundaryWidth / baseScale;

  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });

  const group = new THREE.Group();
  group.name = "boundary";

  data.features.forEach((feature, featureIndex) => {
    const props = feature.properties || {};
    if (props.featureType !== "campusBoundary") return;

    const geometry = feature.geometry;
    if (!geometry) return;

    const polygons =
      geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];

    polygons.forEach((polygon) => {
      if (!Array.isArray(polygon) || !polygon.length) return;
      const outerRing = sanitizeRing(polygon[0], origin);
      if (outerRing.length < 2) return;

      const stripGeometry = buildBoundaryGeometry(outerRing, thickness, boundaryHeight);
      if (!stripGeometry) return;

      const mesh = new THREE.Mesh(stripGeometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = {
        stableId: props.stableId || feature.id || `boundary-${featureIndex}`,
        name: props.name || "校园围墙",
        boundaryType: props.boundaryType || "campus",
      };

      group.add(mesh);
    });
  });

  scene.add(group);
  return group;
}
