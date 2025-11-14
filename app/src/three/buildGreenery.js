/**
 * 绿化渲染模块：负责加载并绘制校园范围内的绿化要素
 *
 * 职责：
 * - 处理 featureType = "greenery" 的 GeoJSON 要素
 * - 面状绿化使用 Shape + ExtrudeGeometry 生成 0.5m 厚度的平板
 * - 线状绿化（tree_row 及其余线性类型）沿用河道 offset 逻辑生成条带
 * - 输出统一的 THREE.Group，供 App.jsx 控制可见性与场景变换
 *
 * 依赖：
 * - config：颜色、树行宽高、可选的 baseY 偏移
 * - coordinates：WGS84 → 平面坐标投影工具
 * - useSceneStore：读取基准缩放，保证与其他层保持一致视觉比例
 */

import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import { projectCoordinate, findProjectionOrigin } from "../lib/coordinates.js";
import { SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";

/**
 * data：解析后的 GeoJSON 对象
 * 说明：只解析一次，避免重复 IO
 */
const data = JSON.parse(rawGeojson);

/**
 * GREENERY_HEIGHT：面状绿化默认厚度（米）
 * 取值：0.5m，贴地但具备一定体积防止 z-fighting
 */
const GREENERY_HEIGHT = 0.5;

/**
 * GREENERY_COLOR：绿化统一配色
 * 优先取 config.colors.绿化，缺省为 #4caf50
 */
const GREENERY_COLOR = config.colors?.绿化 || "#4caf50";

/**
 * GREENERY_OPACITY：材质透明度，增强层次感
 */
const GREENERY_OPACITY = 0.6;

/**
 * projectLineString：将 LineString 坐标投影为 THREE.Vector2 数组
 *
 * 参数：
 * - coordinates：原始经纬度数组
 * - origin：投影基准点
 *
 * 返回值：THREE.Vector2[]
 * 逻辑：过滤非法坐标、去重、投影为平面坐标
 */
function projectLineString(coordinates, origin) {
  const points = [];
  if (!Array.isArray(coordinates)) return points;

  coordinates.forEach((coord) => {
    if (!Array.isArray(coord) || coord.length < 2) return;
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const last = points[points.length - 1];
    if (last && last.x === x && last.y === y) {
      return;
    }
    points.push(new THREE.Vector2(x, y));
  });

  return points;
}

/**
 * buildStripGeometry：根据路径点生成条带挤出几何
 *
 * 参数：
 * - points：路径点数组（THREE.Vector2[]）
 * - thickness：条带宽度（米）
 * - height：条带挤出高度（米）
 *
 * 返回值：THREE.ExtrudeGeometry | null
 * 说明：参考 buildWaterway 的 offset 算法，保证转角平滑
 */
function buildStripGeometry(points, thickness, height) {
  if (points.length < 2 || thickness <= 0 || height <= 0) {
    return null;
  }

  const halfWidth = thickness / 2;
  const leftSide = [];
  const rightSide = [];
  let fallbackNormal = new THREE.Vector2(0, 1);

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const prev = points[i - 1 >= 0 ? i - 1 : 0];
    const next = points[i + 1 < points.length ? i + 1 : points.length - 1];

    const dirPrev = new THREE.Vector2().subVectors(current, prev);
    const dirNext = new THREE.Vector2().subVectors(next, current);

    if (dirPrev.lengthSq() === 0 && dirNext.lengthSq() === 0) {
      continue;
    }

    if (dirPrev.lengthSq() === 0) {
      dirPrev.copy(dirNext);
    }
    if (dirNext.lengthSq() === 0) {
      dirNext.copy(dirPrev);
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

  if (leftSide.length < 2 || rightSide.length < 2) {
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

/**
 * convertRingToVector2：将多边形环投影为 THREE.Vector2 数组
 */
function convertRingToVector2(ring, origin) {
  const points = [];
  if (!Array.isArray(ring)) return points;
  ring.forEach((coord) => {
    if (!Array.isArray(coord) || coord.length < 2) return;
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const last = points[points.length - 1];
    if (last && last.x === x && last.y === y) return;
    points.push(new THREE.Vector2(x, y));
  });
  return points;
}

/**
 * createShapeFromPolygon：基于投影后的多边形生成 THREE.Shape
 */
function createShapeFromPolygon(polygon, origin) {
  if (!polygon?.length) return null;
  const [outerRing, ...holes] = polygon;
  const outerPoints = convertRingToVector2(outerRing, origin);
  if (outerPoints.length < 3) {
    return null;
  }
  const shape = new THREE.Shape(outerPoints);
  holes.forEach((ring) => {
    const holePoints = convertRingToVector2(ring, origin);
    if (holePoints.length >= 3) {
      shape.holes.push(new THREE.Path(holePoints));
    }
  });
  return shape;
}

/**
 * buildGreenery：创建绿化 Group 并挂载到场景
 *
 * 参数：scene - THREE.Scene 实例
 * 返回值：THREE.Group
 */
export function buildGreenery(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const group = new THREE.Group();
  group.name = "greenery";

  const baseScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const treeRowConfig = config.greenery?.treeRow || {};
  const stripWidth = Number(treeRowConfig.width) || 2;
  const stripHeight = Number(treeRowConfig.height) || 0.3;
  const stripBaseY =
    Number.isFinite(treeRowConfig.baseY) && !Number.isNaN(treeRowConfig.baseY)
      ? Number(treeRowConfig.baseY)
      : 0;
  const thickness = stripWidth / baseScale;

  const material = new THREE.MeshPhongMaterial({
    color: GREENERY_COLOR,
    transparent: true,
    opacity: GREENERY_OPACITY,
    side: THREE.DoubleSide,
  });

  data.features.forEach((feature, featureIndex) => {
    const props = feature.properties || {};
    if (props.featureType !== "greenery") return;
    const geometry = feature.geometry;
    if (!geometry) return;

    const greenType = props.greenType || props.landuse || "unknown";
    const stableId =
      props.stableId || feature.id || `greenery-${featureIndex.toString()}`;
    const name = props.name || "绿化区域";

    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const polygons =
        geometry.type === "MultiPolygon"
          ? geometry.coordinates
          : [geometry.coordinates];
      polygons.forEach((polygon) => {
        const shape = createShapeFromPolygon(polygon, origin);
        if (!shape) return;
        const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: GREENERY_HEIGHT,
          bevelEnabled: false,
        });
        extrudeGeometry.rotateX(-Math.PI / 2);
        extrudeGeometry.computeVertexNormals();

        const mesh = new THREE.Mesh(extrudeGeometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.position.y = 0;
        mesh.userData = {
          stableId,
          name,
          greenType,
        };
        group.add(mesh);
      });
      return;
    }

    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const segments =
        geometry.type === "MultiLineString"
          ? geometry.coordinates
          : [geometry.coordinates];

      segments.forEach((segment, segmentIndex) => {
        const projected = projectLineString(segment, origin);
        if (projected.length < 2) return;
        const stripGeometry = buildStripGeometry(
          projected,
          thickness,
          stripHeight
        );
        if (!stripGeometry) return;
        const mesh = new THREE.Mesh(stripGeometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.position.y = stripBaseY;
        mesh.userData = {
          stableId: `${stableId}-${segmentIndex}`,
          name,
          greenType,
        };
        group.add(mesh);
      });
    }
  });

  scene.add(group);
  return group;
}
