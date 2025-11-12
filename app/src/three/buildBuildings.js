import * as THREE from "three";
import config from "../config/index.js";
import rawGeojson from "../data/campus.geojson?raw";

// 解析静态导入的 GeoJSON，避免多次解析
const data = JSON.parse(rawGeojson);

// 简单的经纬度→米制近似比例（只求相对位置，无需严格投影）
const metersPerDegree = 111320;

/**
 * 将经纬度转换为以 origin 为原点的局部平面坐标
 */
function projectCoordinate([lng, lat], origin) {
  if (!origin) return new THREE.Vector2(lng, lat);
  const x =
    (lng - origin.lng) *
    metersPerDegree *
    Math.cos((origin.lat * Math.PI) / 180);
  const y = (lat - origin.lat) * metersPerDegree;
  return new THREE.Vector2(x, y);
}

/**
 * 针对多边形每个环执行投影
 */
function projectPolygon(polygon, origin) {
  return polygon.map((ring) =>
    ring.map((coord) => projectCoordinate(coord, origin))
  );
}

/**
 * Polygon / MultiPolygon → 投影后的坐标数组
 */
function convertGeometry(feature, origin) {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return [projectPolygon(geometry.coordinates, origin)];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) =>
      projectPolygon(polygon, origin)
    );
  }
  return null;
}

/**
 * 根据分类取颜色，若无匹配则使用默认色
 */
function determineColor(category) {
  return config.colors[category] || config.colors.默认 || "#999999";
}

/**
 * 构建建筑 Mesh，返回包含所有建筑的 Group
 */
export function buildBuildings(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  // 选第一栋建筑作为投影原点，保证数值稳定
  const originFeature = data.features.find(
    (f) => f.properties?.featureType === "building"
  );
  const originCoord =
    originFeature?.geometry?.coordinates?.[0]?.[0] || [0, 0];
  const origin = { lng: originCoord[0], lat: originCoord[1] };

  const group = new THREE.Group();
  group.name = "buildings";

  // 分类使用共享材质，减少 GPU/CPU 开销
  const materialCache = new Map();

  for (const feature of data.features) {
    const props = feature.properties || {};
    if (props.featureType !== "building") continue;

    const projectedPolygons = convertGeometry(feature, origin);
    if (!projectedPolygons) continue;

    const height = Number(props.elevation) || config.heights.默认 || 10;
    const category = props.category || "默认";
    const color = determineColor(category);

    let material = materialCache.get(color);
    if (!material) {
      material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      materialCache.set(color, material);
    }

    projectedPolygons.forEach((polygon) => {
      if (!polygon.length) return;

      // 第一环为外轮廓，后续环表示洞
      const shape = new THREE.Shape(polygon[0]);
      const holes = polygon.slice(1).map((ring) => new THREE.Path(ring));
      holes.forEach((hole) => shape.holes.push(hole));

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false,
      });
      geometry.computeVertexNormals();
      geometry.rotateX(-Math.PI / 2); // 让建筑沿 Y 轴生长

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        stableId:
          props.stableId ||
          props.id ||
          feature.id ||
          `building-${mesh.uuid}`,
        name: props.name || "未命名建筑",
        category,
      };

      group.add(mesh);
    });
  }

  scene.add(group);
  return group;
}
