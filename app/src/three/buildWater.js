import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import {
  projectCoordinate,
  findProjectionOrigin,
} from "../lib/coordinates.js";

/**
 * 解析校园 GeoJSON，供水系构建使用。
 * 静态导入 + JSON.parse 可保证只在模块初始化时执行一次。
 */
const data = JSON.parse(rawGeojson);

/**
 * 水面挤出厚度（米）。
 * 保持 1m 既能避免与地面重合，也不会造成视觉上的“高墙”。
 */
const WATER_DEPTH = 1;

/**
 * 将 GeoJSON 几何提取为多边形数组，统一处理 Polygon/MultiPolygon。
 */
function extractPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }
  return [];
}

/**
 * 将经纬度环投影到校园平面坐标系，并移除连续重复点。
 */
function convertRingToVector2(ring, origin) {
  return ring
    .map((coord) => {
      const [x, y] = projectCoordinate(coord, origin);
      return new THREE.Vector2(x, y);
    })
    .filter((point, index, array) => {
      if (index === 0) return true;
      return !point.equals(array[index - 1]);
    });
}

/**
 * 根据单个湖泊多边形（含洞）创建 THREE.Shape。
 */
function createShapeFromPolygon(polygon, origin) {
  if (!polygon?.length) return null;
  const [outerRing, ...holes] = polygon;
  if (!outerRing || outerRing.length < 3) return null;

  const outerPoints = convertRingToVector2(outerRing, origin);
  if (outerPoints.length < 3) return null;

  const shape = new THREE.Shape(outerPoints);
  holes.forEach((ring) => {
    if (!ring || ring.length < 3) return;
    const holePoints = convertRingToVector2(ring, origin);
    if (holePoints.length >= 3) {
      const holePath = new THREE.Path(holePoints);
      shape.holes.push(holePath);
    }
  });
  return shape;
}

/**
 * 构建水系 group 并挂载到场景。
 */
export function buildWater(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const materialColor = config.colors?.水系 || "#4fc3f7";
  const material = new THREE.MeshPhongMaterial({
    color: materialColor,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(materialColor),
    emissiveIntensity: 0.25,
  });

  const group = new THREE.Group();
  group.name = "water";

  data.features.forEach((feature, index) => {
    const props = feature.properties || {};
    if (props.featureType !== "lake") return;

    const polygons = extractPolygons(feature.geometry);
    if (!polygons.length) return;

    polygons.forEach((polygon) => {
      const shape = createShapeFromPolygon(polygon, origin);
      if (!shape) return;

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: WATER_DEPTH,
        bevelEnabled: false,
      });
      geometry.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = {
        stableId: props.stableId || feature.id || `lake-${index}`,
        name: props.name || "未命名水体",
        waterType: props.waterType || props.water || props.natural || "未知",
      };

      group.add(mesh);
    });
  });

  scene.add(group);
  return group;
}
