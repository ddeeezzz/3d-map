import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import {
  projectCoordinate,
  findProjectionOrigin,
} from "../lib/coordinates.js";

/**
 * data：解析后的 GeoJSON 数据
 * 在模块初始化时一次性解析，避免重复计算
 */
const data = JSON.parse(rawGeojson);

/**
 * extractPolygons：从几何体中提取多边形数组
 * 
 * 参数：geometry - GeoJSON geometry 对象
 * 返回：多边形坐标数组
 * 
 * 支持类型：
 * - Polygon：返回 [coordinates]（单个多边形）
 * - MultiPolygon：返回 coordinates（多个多边形）
 * - 其他：返回 []
 * 
 * 目的：统一接口，简化后续处理
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
 * convertRingToVector2：将经纬度环投影为平面坐标，并去重
 * 
 * 参数：
 * - ring：经纬度坐标环
 * - origin：投影原点
 * 
 * 返回：THREE.Vector2 数组
 * 
 * 处理步骤：
 * 1. 投影每个坐标
 * 2. 过滤连续重复的点（提升几何体质量）
 * 
 * 说明：GeoJSON 可能包含重复相邻点，需要过滤
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
 * createShapeFromPolygon：从单个多边形创建 THREE.Shape
 * 
 * 参数：
 * - polygon：坐标环数组 [[外环], [孔1], [孔2], ...]
 * - origin：投影原点
 * 
 * 返回：THREE.Shape 或 null
 * 
 * 流程：
 * 1. 提取外环和孔洞环
 * 2. 投影和清洗外环
 * 3. 对每个孔洞环执行相同操作
 * 4. 将孔洞添加到 Shape 中
 * 
 * 用途：表示包含岛屿的水体（湖泊中有岛）
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
 * buildWater：构建水系几何体
 * 
 * 参数：scene - THREE.Scene
 * 返回：包含水体的 Group
 * 
 * 流程：
 * 1. 查找投影原点（第一个建筑的位置）
 * 2. 从配置读取水系颜色
 * 3. 创建发光材质（emissive 增强可见性）
 * 4. 遍历所有 GeoJSON 要素
 * 5. 对每个水体（lake）：
 *    - 提取多边形（支持 MultiPolygon）
 *    - 创建 THREE.Shape 及其孔洞
 *    - 用 ExtrudeGeometry 拉伸成厚度为 WATER_DEPTH 的平面
 *    - 创建 Mesh 并添加 userData（用于交互/显示）
 *    - 添加到 Group
 * 6. 将 Group 挂载到场景
 * 
 * 材质特性：
 * - color：主体颜色（从配置读取，默认 #4fc3f7）
 * - transparent: true：启用透明度
 * - opacity: 0.6：透明度 60%，显示深度感
 * - side: THREE.DoubleSide：双面渲染（内外都可见）
 * - emissive：自发光颜色，使水体在阴影中也能看见
 * - emissiveIntensity: 0.25：发光强度（适中，不过强）
 * 
 * userData 包含：
 * - stableId：唯一标识符（用于交互检测）
 * - name：要素名称（用于信息显示）
 * - waterType：水体类型（lake/river/canal 等）
 */
export function buildWater(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const waterwayConfig = config.waterway || {};
  const waterDepth = Number(waterwayConfig.surfaceDepth) || 1;
  const rawSurfaceBaseY = Number(waterwayConfig.surfaceBaseY);
  const waterBaseY = Number.isFinite(rawSurfaceBaseY) ? rawSurfaceBaseY : 0;
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

  /**
   * 遍历 GeoJSON 所有要素
   */
  data.features.forEach((feature, index) => {
    const props = feature.properties || {};
    // 只处理标记为 lake 的水体要素
    if (props.featureType !== "lake") return;

    /**
     * 提取多边形数组（处理 Polygon 和 MultiPolygon）
     */
    const polygons = extractPolygons(feature.geometry);
    if (!polygons.length) return;

    /**
     * 对每个多边形创建一个 Mesh（支持多湖泊）
     */
    polygons.forEach((polygon) => {
      const shape = createShapeFromPolygon(polygon, origin);
      if (!shape) return;

      /**
       * 创建 3D 几何体
       * - ExtrudeGeometry 沿 Z 轴拉伸，深度 = WATER_DEPTH
       * - bevelEnabled: false：不添加倒角，保持锐利边界
       * - 旋转 -90° 使其在 XZ 平面（水平面）
       */
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: waterDepth,
        bevelEnabled: false,
      });
      geometry.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(geometry, material);
      // 水体不投影阴影、不接收阴影（保持透明效果）
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.position.y = waterBaseY;

      /**
       * userData：用于交互检测和信息显示
       * - stableId：picking 用，唯一标识水体
       * - name：UI 显示用
       * - waterType：数据来源（OSM 属性）
       */
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
