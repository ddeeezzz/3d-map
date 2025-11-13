import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import { projectCoordinate, findProjectionOrigin } from "../lib/coordinates.js";
import { SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";

const data = JSON.parse(rawGeojson);

function projectLineString(coordinates, origin) {
  const points = [];
  for (const coord of coordinates) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const last = points[points.length - 1];
    if (last && last.x === x && last.y === y) continue;
    points.push(new THREE.Vector2(x, y));
  }
  return points;
}

function buildStripGeometry(points, thickness, height) {
  if (points.length < 2 || thickness <= 0 || height <= 0) return null;

  const halfWidth = thickness / 2;
  const leftSide = [];
  const rightSide = [];
  let fallbackNormal = new THREE.Vector2(0, 1);

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];

    const dirPrev = new THREE.Vector2().subVectors(current, prev);
    const dirNext = new THREE.Vector2().subVectors(next, current);
    if (dirPrev.lengthSq() === 0 || dirNext.lengthSq() === 0) {
      continue;
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

  if (leftSide.length < 2 || rightSide.length < 2) return null;

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

function toSegments(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

export function buildWaterway(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const baseScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const riverConfig = config.waterway?.river || {};
  const stripWidth = Number(riverConfig.width) || 5;
  const stripHeight = Number(riverConfig.height) || 1;
  const thickness = stripWidth / baseScale;

  const group = new THREE.Group();
  group.name = "waterways";

  const material = new THREE.MeshPhongMaterial({
    color: config.colors?.水系 || "#4fc3f7",
    transparent: true,
    opacity: 0.8,
  });

  data.features.forEach((feature) => {
    const props = feature.properties || {};
    if (props.featureType !== "river") return;

    const segments = toSegments(feature.geometry);
    segments.forEach((segment, index) => {
      const projected = projectLineString(segment, origin);
      if (projected.length < 2) return;
      const geometry = buildStripGeometry(projected, thickness, stripHeight);
      if (!geometry) return;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = {
        stableId: props.stableId || feature.id || `river-${index}`,
        name: props.name || "河流",
        waterType: props.waterType || "river",
      };
      group.add(mesh);
    });
  });

  if (group.children.length > 0) {
    scene.add(group);
    return group;
  }
  return null;
}
