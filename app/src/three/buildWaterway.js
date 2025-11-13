/**
 * 水道（河流）几何体构建模块
 * 
 * 职责：
 * 从 GeoJSON 中提取河流/水道（river）要素，转换为 3D 条形几何体
 * 使用条形生成算法（strip geometry）创建可视化河流
 * 
 * 特点：
 * - 线性路径基础上两侧平行扩展
 * - 支持 LineString 和 MultiLineString
 * - 宽度基于配置与场景缩放自适应
 * 
 * 依赖：
 * - config：河流宽度/高度配置
 * - coordinates.js：坐标投影
 * - store：场景基础变换（用于缩放补偿）
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
 * projectLineString：投影 LineString，并去重相邻点
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
 * 5. 移除相邻重复点
 * 
 * 说明：此函数用于 LineString（线性路径），与 Polygon 不同
 */
function projectLineString(coordinates, origin) {
  const points = [];
  for (const coord of coordinates) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    // 投影经纬度为平面坐标（米）
    const [x, y] = projectCoordinate(coord, origin);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    // 过滤连续重复的点
    const last = points[points.length - 1];
    if (last && last.x === x && last.y === y) continue;
    points.push(new THREE.Vector2(x, y));
  }
  return points;
}

/**
 * buildStripGeometry：从线段数组构建条形 3D 几何体
 * 
 * 参数：
 * - points：2D 路径点数组
 * - thickness：条形宽度（米）
 * - height：条形高度/深度（米）
 * 
 * 返回：THREE.ExtrudeGeometry 或 null
 * 
 * 算法概述：
 * 条形生成是一个复杂的几何算法，目的是在二维路径两侧平行扩展
 * 
 * 步骤：
 * 1. 计算半宽度（用于左右两侧扩展）
 * 2. 对每个顶点计算法向量：
 *    - 获取前后两条边的方向向量
 *    - 分别旋转 90° 得到两条法向量（垂直于边）
 *    - 平均这两个法向量，得到该顶点处的最终法向量
 *    - 若平均后长度为 0（180° 折返），使用上次有效的法向量
 * 3. 沿法向量方向移动半宽度距离，分别生成左侧和右侧点
 * 4. 合并左右点序列，形成闭合轮廓（多边形）
 * 5. 用 THREE.Shape 和 ExtrudeGeometry 挤出成 3D 几何
 * 
 * 材质特性：
 * - 高度控制河流的立体感
 * - 厚度控制河流的宽度
 * 
 * 边界情况处理：
 * - 点数 < 2：无法形成线段，返回 null
 * - 厚度或高度 ≤ 0：参数无效，返回 null
 * - 零长度段（相邻点重合）：跳过该顶点
 * - 180° 折返（法向量平均为零）：使用上次有效法向量
 */
function buildStripGeometry(points, thickness, height) {
  if (points.length < 2 || thickness <= 0 || height <= 0) return null;

  const halfWidth = thickness / 2;
  const leftSide = [];
  const rightSide = [];
  // 默认法向量（处理无法计算时的降级方案）
  let fallbackNormal = new THREE.Vector2(0, 1);

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    // 对于线性路径（非闭合），使用直接前后邻接点
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];

    // 计算前后两条边的方向向量
    const dirPrev = new THREE.Vector2().subVectors(current, prev);
    const dirNext = new THREE.Vector2().subVectors(next, current);
    if (dirPrev.lengthSq() === 0 || dirNext.lengthSq() === 0) {
      // 零长度段，跳过该顶点
      continue;
    }
    dirPrev.normalize();
    dirNext.normalize();

    // 旋转 90° 得到垂直于边的法向量（左手坐标系）
    const normalPrev = new THREE.Vector2(-dirPrev.y, dirPrev.x);
    const normalNext = new THREE.Vector2(-dirNext.y, dirNext.x);
    
    // 平均两个法向量，平滑处理转角
    let normal = new THREE.Vector2().addVectors(normalPrev, normalNext);

    if (normal.lengthSq() === 0) {
      // 180° 折返，平均后为零向量，使用上次有效法向量
      normal = fallbackNormal.clone();
    } else {
      // 标准情况：正规化并记录，用于下次折返的降级
      normal.normalize();
      fallbackNormal = normal.clone();
    }

    // 沿法向量方向移动半宽度，得到左右两侧的点
    const offset = normal.clone().multiplyScalar(halfWidth);
    leftSide.push(new THREE.Vector2().addVectors(current, offset));
    rightSide.push(new THREE.Vector2().subVectors(current, offset));
  }

  if (leftSide.length < 2 || rightSide.length < 2) return null;

  // 合并左右两侧，形成闭合轮廓（多边形）
  const contour = [...leftSide, ...rightSide.reverse()];
  if (!contour[0].equals(contour[contour.length - 1])) {
    // 确保轮廓闭合
    contour.push(contour[0].clone());
  }

  // 用 THREE.Shape 和 ExtrudeGeometry 创建 3D 几何
  const shape = new THREE.Shape(contour);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  // 旋转到水平面（XZ 平面）
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
 * - LineString：返回 [coordinates]
 * - MultiLineString：返回 coordinates
 * - 其他：返回 []
 * 
 * 目的：统一接口处理单线和多线
 */
function toSegments(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

/**
 * buildWaterway：构建河流/水道几何体
 * 
 * 参数：scene - THREE.Scene
 * 返回：包含河流的 Group 或 null
 * 
 * 流程：
 * 1. 校验参数
 * 2. 查找投影原点
 * 3. 从配置读取河流参数（宽度、高度）
 * 4. 根据场景缩放调整实际宽度（保持相对比例）
 * 5. 创建 PhongMaterial（发光，支持阴影）
 * 6. 遍历所有 river 要素：
 *    - 提取线段（支持 MultiLineString）
 *    - 投影坐标
 *    - 构建条形几何
 *    - 创建 Mesh 并添加 userData
 *    - 添加到 Group
 * 7. 若 Group 有子对象，挂载到场景；否则返回 null
 * 
 * 材质特性：
 * - color：河流颜色（从水系配色继承）
 * - transparent: true + opacity: 0.8：半透明，显示流体感
 * - 与建筑/水体相比，河流略显半透，区分不同类型的水系
 */
export function buildWaterway(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  // 从场景基础变换读取缩放因子，用于自适应河流宽度
  const baseScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const riverConfig = config.waterway?.river || {};
  // 配置中的宽度单位为米
  const stripWidth = Number(riverConfig.width) || 5;
  const stripHeight = Number(riverConfig.height) || 1;
  // 补偿场景缩放，保持视觉一致性
  const thickness = stripWidth / baseScale;

  const group = new THREE.Group();
  group.name = "waterways";

  // 河流材质：使用水系配色
  const material = new THREE.MeshPhongMaterial({
    color: config.colors?.水系 || "#4fc3f7",
    transparent: true,
    opacity: 0.8,
  });

  /**
   * 遍历所有 GeoJSON 要素
   */
  data.features.forEach((feature) => {
    const props = feature.properties || {};
    // 只处理标记为 river 的水道要素
    if (props.featureType !== "river") return;

    /**
     * 提取线段（支持 MultiLineString）
     */
    const segments = toSegments(feature.geometry);
    segments.forEach((segment, index) => {
      // 投影坐标
      const projected = projectLineString(segment, origin);
      if (projected.length < 2) return;
      
      // 构建条形几何
      const geometry = buildStripGeometry(projected, thickness, stripHeight);
      if (!geometry) return;

      const mesh = new THREE.Mesh(geometry, material);
      // 河流不投影/接收阴影（保持透明效果）
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      
      /**
       * userData：用于交互和信息显示
       */
      mesh.userData = {
        stableId: props.stableId || feature.id || `river-${index}`,
        name: props.name || "河流",
        waterType: props.waterType || "river",
      };
      group.add(mesh);
    });
  });

  // 若成功添加河流，则挂载；否则返回 null
  if (group.children.length > 0) {
    scene.add(group);
    return group;
  }
  return null;
}
