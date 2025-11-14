/**
 * 场地渲染模块：负责根据 GeoJSON 数据生成矮柱形场地 Mesh
 *
 * 职责：
 * - 消费 featureType = "site" 的要素，生成统一高度/基准面的 ExtrudeGeometry
 * - 颜色按照 config.colors.site 映射，材质保持半透明以体现层级
 * - 输出一个 THREE.Group，交由 App.jsx 管理可见性与场景变换
 *
 * 依赖：
 * - config：提供 site 的高度、基线以及配色
 * - coordinates：投影工具，确保与建筑共用原点，避免坐标漂移
 */

import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import { findProjectionOrigin, projectGeometry } from "../lib/coordinates.js";

/**
 * data：缓存解析后的 GeoJSON，避免重复 IO
 */
const data = JSON.parse(rawGeojson);

/**
 * SITE_GROUP_NAME：统一的场地 Group 名称，方便调试与拾取定位
 */
const SITE_GROUP_NAME = "sites";

/**
 * SITE_OPACITY：场地 Mesh 的默认透明度
 */
const SITE_OPACITY = 0.85;

/**
 * parseNumeric：通用数值解析，去除字符串中的非数字字符
 * @param {unknown} value 原始输入
 * @returns {number|null} 解析成功返回数值，否则 null
 */
function parseNumeric(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(String(value).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * createShapeFromProjectedPolygon：基于投影后的多边形坐标生成 Shape
 * @param {Array<Array<[number, number]>>} polygon 多边形坐标（第一条为外环，其他为内洞）
 * @returns {THREE.Shape|null} 可用于 Extrude 的 Shape
 */
function createShapeFromProjectedPolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return null;
  }

  const [outerRing, ...holes] = polygon;
  const outerPoints = convertRingToVector2(outerRing);
  if (outerPoints.length < 3) {
    return null;
  }

  const shape = new THREE.Shape(outerPoints);
  holes.forEach((ring) => {
    const holePoints = convertRingToVector2(ring);
    if (holePoints.length >= 3) {
      shape.holes.push(new THREE.Path(holePoints));
    }
  });
  return shape;
}

/**
 * convertRingToVector2：将二维数组转换为 Vector2 列表并去重
 * @param {Array<[number, number]>} ring 多边形环坐标
 * @returns {THREE.Vector2[]} 转换后的点集合
 */
function convertRingToVector2(ring) {
  const points = [];
  if (!Array.isArray(ring)) return points;

  ring.forEach((coord) => {
    if (!Array.isArray(coord) || coord.length < 2) return;
    const [x, y] = coord;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const last = points[points.length - 1];
    if (last && last.x === x && last.y === y) {
      return;
    }
    points.push(new THREE.Vector2(x, y));
  });

  if (points.length >= 3) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first.equals(last)) {
      points.push(first.clone());
    }
  }

  return points;
}

/**
 * getSiteMaterial：根据分类缓存/复用 MeshPhongMaterial
 * @param {string} category 场地分类
 * @param {Map<string, THREE.Material>} cache 材质缓存
 * @returns {THREE.Material} 供场地 Mesh 使用的材质
 */
function getSiteMaterial(category, cache) {
  if (cache.has(category)) {
    return cache.get(category);
  }
  const siteColors = config.colors?.site || {};
  const color = siteColors[category] || siteColors.默认 || "#999999";
  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: SITE_OPACITY,
    side: THREE.DoubleSide,
  });
  cache.set(category, material);
  return material;
}

/**
 * resolveSiteElevation：确定场地挤出高度
 * @param {object} props 要素属性
 * @param {number} fallbackHeight 配置提供的默认高度
 * @returns {number} 最终挤出高度
 */
function resolveSiteElevation(props, fallbackHeight) {
  const fromProps = parseNumeric(props?.elevation);
  if (fromProps != null) {
    return fromProps;
  }
  return fallbackHeight;
}

/**
 * buildSites：生成场地 Group 并挂载到场景
 * @param {THREE.Scene} scene Three.js 场景
 * @returns {THREE.Group} 场地 Group
 */
export function buildSites(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const group = new THREE.Group();
  group.name = SITE_GROUP_NAME;

  const origin = findProjectionOrigin(data.features);
  const materialCache = new Map();
  const siteConfig = config.site || {};
  const siteHeightFallback =
    parseNumeric(siteConfig.height) ||
    parseNumeric(config.heights?.site) ||
    2;
  const baseY = parseNumeric(siteConfig.baseY) ?? 0;

  data.features.forEach((feature, featureIndex) => {
    const props = feature.properties || {};
    if (props.featureType !== "site") return;

    const projectedGeometry = projectGeometry(feature.geometry, origin);
    if (!projectedGeometry) return;

    const elevation = resolveSiteElevation(props, siteHeightFallback);
    if (!elevation || elevation <= 0) {
      return;
    }

    const siteCategory = props.siteCategory || "默认";
    const stableId = props.stableId || feature.id || `site-${featureIndex}`;
    const displayName = props.displayName || props.name || "未命名场地";
    const sportsType = props.sportsType;

    const polygons =
      projectedGeometry.type === "Polygon"
        ? [projectedGeometry.coordinates]
        : projectedGeometry.coordinates;

    polygons.forEach((polygon, polygonIndex) => {
      const shape = createShapeFromProjectedPolygon(polygon);
      if (!shape) return;

      const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: elevation,
        bevelEnabled: false,
      });
      extrudeGeometry.rotateX(-Math.PI / 2);
      extrudeGeometry.computeVertexNormals();

      const mesh = new THREE.Mesh(
        extrudeGeometry,
        getSiteMaterial(siteCategory, materialCache)
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = baseY;
      mesh.name = `${SITE_GROUP_NAME}-${stableId}-${polygonIndex}`;
      mesh.userData = {
        stableId,
        displayName,
        siteCategory,
        sportsType: sportsType || null,
      };

      group.add(mesh);
    });
  });

  scene.add(group);
  return group;
}
