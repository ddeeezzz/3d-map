/**
 * 道路几何体构建模块
 * 
 * 职责：
 * 从 GeoJSON 中提取道路（road）要素，转换为 3D 条形几何体
 * 支持复杂的道路宽度估算（直接宽度、车道数、OSM 等级默认值）
 * 
 * 特点：
 * - 多级道路宽度推断系统
 * - 轻微挤出（config.road.height 0.2m）形成立体感
 * - 支持 LineString 和 MultiLineString
 * - 每条道路独立材质（避免全局材质复用导致的配色问题）
 * 
 * 依赖：
 * - config：道路颜色、宽度映射表、默认宽度
 * - coordinates.js：坐标投影
 * - store：场景基础变换（缩放补偿）
 */

import * as THREE from "three";
import rawGeojson from "../data/campus.geojson?raw";
import config from "../config/index.js";
import { projectCoordinate, findProjectionOrigin } from "../lib/coordinates.js";
import { SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";

/**
 * data：解析后的 GeoJSON 数据
 */
const data = JSON.parse(rawGeojson);

/**
 * config.road.height：道路挤出高度
 * 单位：米
 * 用途：增加立体感，使道路不仅仅是平面
 * 值 0.2 足够小，不会遮挡建筑底部，但能显示层级
 */
const DEFAULT_ROAD_VOLUME = {
  height: 0.2,
  baseY: 0.04,
};

/**
 * DEFAULT_LANE_WIDTH：单车道标准宽度
 * 单位：米
 * 用途：当道路属性中有 lanes（车道数）但无 width 时，用此宽度乘以车道数
 */
const DEFAULT_LANE_WIDTH = 3.5;

/**
 * resolveRoadVolume锛氫粠 config 涓瘡娆¤В鏋愭潯褰㈡亸绉婚珮搴︽弿杩板拰榛樿鍊?
 */
function resolveRoadVolume() {
  const rawHeight = Number(config.road?.height);
  const rawBaseY = Number(config.road?.baseY);
  const height =
    Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : DEFAULT_ROAD_VOLUME.height;
  const baseY = Number.isFinite(rawBaseY) ? rawBaseY : DEFAULT_ROAD_VOLUME.baseY;
  return { height, baseY };
}

/**
 * determineRoadColor：获取道路颜色
 * 
 * 返回：十六进制颜色字符串
 * 
 * 流程：
 * 1. 从配置读取道路配色
 * 2. 若未配置，返回默认灰色 #d0d0d0
 * 
 * 说明：
 * 分离为函数以便未来支持按道路类型分色
 */
function determineRoadColor() {
  return config.colors.道路 || "#d0d0d0";
}

/**
 * createRoadMaterial：创建道路材质
 * 
 * 返回：THREE.MeshPhongMaterial 实例
 * 
 * 材质特性：
 * - color：道路颜色
 * - transparent: true + opacity: 0.95：高透明度，使道路略显透明感
 * - emissiveIntensity: 0：无自发光，不会在夜间发光
 * 
 * 说明：
 * 每条道路创建独立材质实例，避免复用同一材质导致的批处理问题
 */
function createRoadMaterial() {
  return new THREE.MeshPhongMaterial({
    color: determineRoadColor(),
    transparent: true,
    opacity: 0.95,
    emissiveIntensity: 0,
  });
}

/**
 * parsePositiveNumber：安全解析正数
 * 
 * 参数：value - 任意值
 * 返回：正数或 null
 * 
 * 校验规则：
 * 1. 转换为 Number
 * 2. 检查是否为有限数值
 * 3. 检查是否为正数
 * 
 * 用途：防御性编程，处理可能的无效/负数属性
 */
function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * estimateRoadWidth：多级宽度推断
 * 
 * 参数：properties - GeoJSON properties（道路属性）
 * 返回：道路宽度（米）
 * 
 * 推断顺序（优先级降序）：
 * 1. width 属性（直接宽度，最准确）
 * 2. lanes 属性 × DEFAULT_LANE_WIDTH（车道数推算）
 * 3. highway 类型对应的配置宽度（OSM 道路等级，如 motorway/residential）
 * 4. 配置中的默认宽度（fallback）
 * 
 * 说明：
 * OSM 数据中这些属性可能缺失或不规范
 * 此函数通过多个降级方案确保总能返回一个合理的宽度
 * 避免因属性缺失导致道路不可见
 */
function estimateRoadWidth(properties = {}) {
  // 第一优先级：直接的宽度属性
  const width = parsePositiveNumber(properties.width);
  if (width) {
    return width;
  }

  // 第二优先级：车道数 × 单车道宽度
  const lanes = parsePositiveNumber(properties.lanes);
  if (lanes) {
    return lanes * DEFAULT_LANE_WIDTH;
  }

  // 第三优先级：按道路类型（highway tag）查表
  const highwayType = properties.highway;
  if (highwayType && config.roadWidths?.[highwayType]) {
    return config.roadWidths[highwayType];
  }

  // 最后降级：配置中的默认宽度
  return config.roadWidths?.默认 || 6;
}

/**
 * projectLineString：投影 LineString 坐标
 * 
 * 参数：
 * - coordinates：经纬度坐标数组
 * - origin：投影原点
 * 
 * 返回：投影后的 THREE.Vector2 数组
 * 
 * 处理步骤：
 * 1. 遍历原始坐标
 * 2. 校验格式（Array，长度≥2）
 * 3. 投影到平面坐标系
 * 4. 检查有效性（数值有限）
 * 5. 添加到结果数组
 * 
 * 说明：
 * 与 water/waterway 的 projectLineString 基本相同，
 * 但本版本不进行相邻点去重（因为道路可能包含必要的细节弯曲）
 */
function projectLineString(coordinates, origin) {
  const projected = [];

  for (const coord of coordinates) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    // 投影经纬度为平面坐标（米）
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    projected.push(new THREE.Vector2(x, y));
  }

  return projected;
}

/**
 * buildRoadGeometry：从路径点构建道路 3D 几何体
 * 
 * 参数：
 * - points：2D 路径点数组
 * - thickness：道路宽度（米）
 * 
 * 返回：THREE.ExtrudeGeometry 或 null
 * 
 * 算法概述：
 * 使用法向量平均法（类似 buildWaterway 中的条形算法）
 * 
 * 步骤：
 * 1. 参数校验（最少 2 点，正宽度）
 * 2. 计算每个顶点处的平均法向量：
 *    - 对于开放路径（非闭合），计算相邻两条边的法向量并求和
 *    - 路径中间的点同时受前后两条边影响
 *    - 路径端点只受一条边影响
 * 3. 正规化法向量，处理零向量（折返）情况
 * 4. 沿法向量两侧平行扩展，形成左右两条边界
 * 5. 闭合轮廓，创建 THREE.Shape
 * 6. 用 ExtrudeGeometry 挤出成 3D（高度 config.road.height）
 * 
 * 区别于 buildWaterway：
 * - buildWaterway 使用循环法向量（闭合路径）
 * - buildRoads 使用端点法向量（开放路径）
 * - buildRoads 不做相邻点去重（保留路径细节）
 * 
 * 边界情况处理：
 * - 点数 < 2：返回 null
 * - 厚度 ≤ 0：返回 null
 * - 零长度段：跳过该边
 * - 轮廓 < 3 点：返回 null（无法形成面）
 */
export function buildRoadGeometry(points, thickness, depth) {
  if (points.length < 2 || thickness <= 0) {
    return null;
  }
  if (!Number.isFinite(depth) || depth <= 0) {
    return null;
  }

  const halfWidth = thickness / 2;
  // 初始化法向量数组，每个顶点一个
  const normals = points.map(() => new THREE.Vector2(0, 0));

  /**
   * 第一步：计算法向量
   * 对每条边（从点 i 到点 i+1），计算其法向量
   * 将法向量累加到相邻两个顶点的法向量数组
   */
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const direction = new THREE.Vector2().subVectors(next, current);
    if (direction.lengthSq() === 0) continue;
    direction.normalize();
    // 旋转 90° 得到垂直于边的法向量
    const normal = new THREE.Vector2(-direction.y, direction.x);
    normals[i].add(normal);
    normals[i + 1].add(normal);
  }

  let fallbackNormal = new THREE.Vector2(0, 1);
  const leftSide = [];
  const rightSide = [];

  /**
   * 第二步：生成左右两条边界
   * 对每个顶点，用其平均法向量向外扩展，形成路面的两条边缘
   */
  for (let i = 0; i < points.length; i += 1) {
    const baseNormal = normals[i];
    let normal = baseNormal.clone();
    if (normal.lengthSq() === 0) {
      // 孤立点或特殊情况，使用上次有效法向量
      normal = fallbackNormal.clone();
    } else {
      // 正规化并记录，供下次使用
      normal.normalize();
      fallbackNormal = normal.clone();
    }

    // 沿法向量两侧移动半宽度
    const offset = normal.clone().multiplyScalar(halfWidth);
    leftSide.push(new THREE.Vector2().addVectors(points[i], offset));
    rightSide.push(new THREE.Vector2().subVectors(points[i], offset));
  }

  if (leftSide.length < 2 || rightSide.length < 2) {
    return null;
  }

  // 合并左右两侧形成闭合轮廓
  const contour = [...leftSide, ...rightSide.reverse()];
  if (contour.length < 3) {
    return null;
  }

  // 确保轮廓闭合
  if (!contour[0].equals(contour[contour.length - 1])) {
    contour.push(contour[0].clone());
  }

  // 创建 3D 几何
  const shape = new THREE.Shape(contour);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * toSegments：从几何体中提取线段数组
 * 
 * 参数：geometry - GeoJSON geometry 对象
 * 返回：坐标数组
 * 
 * 支持类型：
 * - LineString：返回 [coordinates]（单条线）
 * - MultiLineString：返回 coordinates（多条线）
 * - 其他：返回 []
 * 
 * 目的：统一接口处理单线和多线
 */
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

/**
 * buildRoads：构建道路网络几何体
 * 
 * 参数：scene - THREE.Scene
 * 返回：包含道路的 Group
 * 
 * 流程：
 * 1. 校验参数
 * 2. 查找投影原点
 * 3. 创建 Group（roads）
 * 4. 获取场景缩放因子（用于自适应道路宽度）
 * 5. 遍历所有 GeoJSON 要素：
 *    - 筛选 road 类型
 *    - 提取线段（支持 MultiLineString）
 *    - 推断道路宽度（多级降级策略）
 *    - 补偿场景缩放
 *    - 投影坐标
 *    - 构建几何
 *    - 创建独立材质
 *    - 创建 Mesh 并添加 userData
 *    - 添加到 Group
 * 6. 挂载到场景并返回
 * 
 * 材质策略：
 * - 每条道路使用独立材质（避免复用同一材质的批处理问题）
 * - 所有道路共用同一颜色（灰色），以区分于建筑
 * 
 * userData 包含：
 * - stableId：唯一标识符（用于 picking）
 * - highway：OSM 道路等级（motorway/residential/footway 等）
 * - name：道路名称
 * - estimatedWidth：推断的宽度（用于调试/展示）
 */
export function buildRoads(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);

  const group = new THREE.Group();
  group.name = "roads";

  // 从场景基础变换获取缩放因子，用于补偿
  const baseSceneScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const roadVolume = resolveRoadVolume();

  /**
   * 遍历所有 GeoJSON 要素
   */
  for (const feature of data.features) {
    const properties = feature.properties || {};
    // 只处理标记为 road 的要素
    if (properties.featureType !== "road") continue;

    /**
     * 提取线段（支持 MultiLineString）
     */
    const segments = toSegments(feature.geometry);
    if (!segments.length) continue;

    // 多级推断道路宽度
    const estimatedWidth = estimateRoadWidth(properties);
    // 补偿场景缩放，保持视觉一致性
    const thickness = estimatedWidth / baseSceneScale;

    /**
     * 对每条线段构建 Mesh
     */
    for (const segment of segments) {
      const projected = projectLineString(segment, origin);
      const geometry = buildRoadGeometry(projected, thickness, roadVolume.height);
      if (!geometry) continue;

      // 创建独立材质
      const meshMaterial = createRoadMaterial();
      const mesh = new THREE.Mesh(geometry, meshMaterial);
      mesh.position.y = roadVolume.baseY;
      // 道路接收阴影（增加立体感）
      mesh.receiveShadow = true;
      
      /**
       * userData：用于交互和信息显示
       */
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
