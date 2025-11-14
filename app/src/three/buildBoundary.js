/**
 * 校园围墙几何体构建模块
 * 
 * 职责：
 * 从 GeoJSON 中提取校园边界（campusBoundary）要素，转换为 3D 的"条带"几何体
 * 模拟现实中的围墙，支持控制宽度和高度
 * 
 * 特点：
 * - 使用"条带"结构：沿边界线向两侧扩展，再用 ExtrudeGeometry 拉伸成立体
 * - 支持复杂的不规则边界
 * - 数值稳定性处理：过滤掉无效点、处理缩并情况
 * 
 * 依赖：
 * - config：围墙配置（宽度、高度、颜色）
 * - coordinates.js：坐标投影工具
 * - useSceneStore：基准缩放因子
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
 * EPSILON：浮点数比较精度阈值
 * 用于判断两个浮点点是否相等
 */
const EPSILON = 1e-6;

/**
 * sanitizeRing：清洗边界环，移除无效点
 * 
 * 参数：
 * - ring：经纬度坐标环
 * - origin：投影原点
 * 
 * 返回：有效的 THREE.Vector2 数组
 * 
 * 清洗步骤：
 * 1. 检查每个坐标的有效性（必须是数组且长度 >= 2）
 * 2. 投影为平面坐标
 * 3. 检查投影结果是否为有限值（避免 NaN/Infinity）
 * 4. 累积有效点到结果数组
 */
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

/**
 * prepareClosedRing：确保环闭合
 * 
 * 参数：points - THREE.Vector2 数组
 * 返回：闭合的点数组（首尾相同）
 * 
 * 逻辑：
 * 1. 复制所有点（避免修改原始数组）
 * 2. 检查首尾是否已相同，若相同则删除末尾（去重）
 * 3. 在末尾添加首点的克隆，形成闭合
 * 
 * 用途：Three.js Shape 需要首尾点相同以形成闭合轮廓
 */
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

/**
 * buildBoundaryGeometry：从点序列构建围墙几何体
 * 
 * 参数：
 * - points：闭合点序列（THREE.Vector2 数组）
 * - thickness：围墙宽度（米）
 * - height：围墙高度（米）
 * 
 * 返回：THREE.ExtrudeGeometry 或 null（若输入无效）
 * 
 * 流程：
 * 1. 参数校验
 * 2. 根据点序列计算垂直向量（指向围墙两侧）
 * 3. 沿垂直方向扩展点序列，生成"条带"轮廓
 * 4. 用 ExtrudeGeometry 拉伸成 3D 立体
 * 
 * 详细逻辑见下方
 */
function buildBoundaryGeometry(points, thickness, height) {
  if (thickness <= 0 || height <= 0) {
    return null;
  }

  const closedPoints = prepareClosedRing(points);
  if (closedPoints.length < 2) {
    return null;
  }

  /**
   * 条带宽度（单侧）
   * thickness 是总宽度，两侧各占 thickness/2
   */
  const halfWidth = thickness / 2;
  const leftSide = [];
  const rightSide = [];
  let fallbackNormal = new THREE.Vector2(0, 1);

  /**
   * 计算每个顶点的外侧垂直方向
   * 通过相邻两条边的法线平均化，得到"平滑"的转角法线
   * 
   * 流程（对每个顶点 i）：
   * 1. 取前一条边 prev（i-1 -> i）和后一条边 next（i -> i+1）
   * 2. 计算 prev 和 next 的单位方向向量
   * 3. 计算每条边的垂直方向（法线）
   * 4. 平均化两条法线，得到顶点处的"外侧法线"
   * 5. 单位化法线，用于后续扩展
   */
  const segmentCount = closedPoints.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const current = closedPoints[i];
    const prev = i === 0 ? closedPoints[segmentCount - 1] : closedPoints[i - 1];
    const next = closedPoints[i + 1];

    /**
     * 计算方向向量
     */
    let dirPrev = new THREE.Vector2().subVectors(current, prev);
    let dirNext = new THREE.Vector2().subVectors(next, current);

    /**
     * 检查边长，若太短则跳过或使用另一条边
     * 避免数值不稳定
     */
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

    /**
     * 单位化方向向量
     */
    dirPrev.normalize();
    dirNext.normalize();

    /**
     * 计算法线（垂直于方向，指向左侧）
     * 2D 中，(x, y) 的左侧法线为 (-y, x)
     */
    const normalPrev = new THREE.Vector2(-dirPrev.y, dirPrev.x);
    const normalNext = new THREE.Vector2(-dirNext.y, dirNext.x);

    /**
     * 平均化两条法线，平滑处理转角
     */
    let normal = new THREE.Vector2().addVectors(normalPrev, normalNext);

    /**
     * 若两条法线方向相反（如 180° 转角），normal 可能为零向量
     * 此时使用回退法线
     */
    if (normal.lengthSq() === 0) {
      normal = fallbackNormal.clone();
    } else {
      normal.normalize();
      fallbackNormal = normal.clone();
    }

    /**
     * 沿法线方向扩展点，生成条带的两侧
     */
    const offset = normal.clone().multiplyScalar(halfWidth);
    leftSide.push(new THREE.Vector2().addVectors(current, offset));
    rightSide.push(new THREE.Vector2().subVectors(current, offset));
  }

  /**
   * 校验条带有效性
   */
  if (leftSide.length < 3 || rightSide.length < 3) {
    return null;
  }

  /**
   * 合并左右两侧形成闭合轮廓
   * 顺序：左侧 -> 右侧（反向），确保逆时针方向
   */
  const contour = [...leftSide, ...rightSide.reverse()];
  if (!contour[0].equals(contour[contour.length - 1])) {
    contour.push(contour[0].clone());
  }

  /**
   * 创建 Shape 并用 ExtrudeGeometry 拉伸
   */
  const shape = new THREE.Shape(contour);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });

  /**
   * 坐标系转换：将 Shape 从 XY 平面旋转到 XZ 平面
   * 使围墙沿 Z 轴（高度）向上
   */
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function computeSignedArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function ensureCounterClockwise(points) {
  const cloned = points
    .map((point) =>
      point instanceof THREE.Vector2 ? point.clone() : new THREE.Vector2(point.x, point.y),
    )
    .filter(Boolean);
  if (cloned.length >= 2) {
    const first = cloned[0];
    const last = cloned[cloned.length - 1];
    if (first.equals(last)) {
      cloned.pop();
    }
  }
  if (computeSignedArea(cloned) < 0) cloned.reverse();
  return cloned;
}

function intersectLines(originA, dirA, originB, dirB) {
  const det = dirA.x * dirB.y - dirA.y * dirB.x;
  if (Math.abs(det) < EPSILON) {
    return null;
  }
  const diff = new THREE.Vector2().subVectors(originB, originA);
  const t = (diff.x * dirB.y - diff.y * dirB.x) / det;
  return new THREE.Vector2(
    originA.x + dirA.x * t,
    originA.y + dirA.y * t,
  );
}

function offsetRing(points, offsetDistance, outward = false) {
  if (!Array.isArray(points) || points.length < 3 || offsetDistance <= 0) {
    return [];
  }
  const closed = prepareClosedRing(points);
  const length = closed.length - 1;
  if (length < 3) return [];
  const result = [];
  const orientationSign = Math.sign(computeSignedArea(points));

  for (let i = 0; i < length; i += 1) {
    const prev = closed[(i - 1 + length) % length];
    const current = closed[i];
    const next = closed[(i + 1) % length];

    const dirPrev = new THREE.Vector2().subVectors(current, prev);
    const dirNext = new THREE.Vector2().subVectors(next, current);

    if (dirPrev.lengthSq() === 0 || dirNext.lengthSq() === 0) {
      continue;
    }

    dirPrev.normalize();
    dirNext.normalize();

    const makeInteriorNormal = (direction) =>
      orientationSign > 0
        ? new THREE.Vector2(-direction.y, direction.x)
        : new THREE.Vector2(direction.y, -direction.x);

    const interiorNormalPrev = makeInteriorNormal(dirPrev).normalize();
    const interiorNormalNext = makeInteriorNormal(dirNext).normalize();

    const targetNormalPrev = interiorNormalPrev.clone().multiplyScalar(outward ? -1 : 1);
    const targetNormalNext = interiorNormalNext.clone().multiplyScalar(outward ? -1 : 1);

    const originA = current.clone().add(targetNormalPrev.clone().multiplyScalar(offsetDistance));
    const originB = current.clone().add(targetNormalNext.clone().multiplyScalar(offsetDistance));
    const intersection = intersectLines(originA, dirPrev, originB, dirNext);
    if (intersection) {
      result.push(intersection);
    } else {
      const fallback = targetNormalPrev.clone().add(targetNormalNext).normalize();
      if (fallback.lengthSq() === 0) {
        fallback.copy(targetNormalPrev);
      }
      result.push(current.clone().add(fallback.multiplyScalar(offsetDistance)));
    }
  }

  return result;
}

function createPathFromRing(ringPoints, ensureClockwise = true) {
  if (!Array.isArray(ringPoints) || ringPoints.length < 3) {
    return null;
  }
  const cloned = ringPoints.map((point) => point.clone());
  const area = computeSignedArea(cloned);
  const shouldReverse = ensureClockwise ? area > 0 : area < 0;
  if (shouldReverse) cloned.reverse();
  return new THREE.Path(cloned);
}

function createGateHolePath(gate, origin, options) {
  if (!gate || !Array.isArray(gate.center) || gate.center.length < 2) {
    return null;
  }
  const [gx, gy] = projectCoordinate(gate.center, origin);
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
  const center = new THREE.Vector2(gx, gy);
  const width = Number(gate.width) || options.width;
  const depth = Number(gate.depth) || options.depth;
  if (!(width > 0) || !(depth > 0)) return null;
  const tangent = Array.isArray(gate.tangent)
    ? new THREE.Vector2(
        Number(gate.tangent[0]) || 0,
        Number(gate.tangent[1]) || 0,
      )
    : new THREE.Vector2(1, 0);
  if (tangent.lengthSq() === 0) {
    tangent.set(1, 0);
  }
  tangent.normalize();

  const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x).normalize();
  if (outwardNormal.lengthSq() === 0) {
    outwardNormal.set(0, 1);
  }

  const maxDepth = Math.max(options.maxDepth - 0.05, 0.1);
  const clampedDepth = Math.min(depth, maxDepth);
  const halfWidth = width / 2;
  const halfDepth = clampedDepth / 2;

  const widthVec = tangent.clone().multiplyScalar(halfWidth);
  const depthVec = outwardNormal.clone().multiplyScalar(halfDepth);
  const gateCenter = center.clone().add(outwardNormal.clone().multiplyScalar(halfDepth));

  const corners = [
    gateCenter.clone().add(widthVec).add(depthVec),
    gateCenter.clone().sub(widthVec).add(depthVec),
    gateCenter.clone().sub(widthVec).sub(depthVec),
    gateCenter.clone().add(widthVec).sub(depthVec),
  ];

  const area = computeSignedArea(corners);
  if (area > 0) {
    corners.reverse();
  }

  return {
    path: new THREE.Path(corners),
    id: gate.stableId || gate.id || null,
  };
}

function buildClosedWallShape({
  innerRing,
  wallThickness,
  gates,
  origin,
  gateWidth,
  gateDepth,
}) {
  if (!innerRing || innerRing.length < 3 || wallThickness <= 0) {
    return null;
  }

  const normalizedInner = ensureCounterClockwise(innerRing);
  if (normalizedInner.length < 3) return null;

  const outerRing = offsetRing(normalizedInner, wallThickness, true);
  if (outerRing.length < 3) return null;

  const outerShapePoints = ensureCounterClockwise(outerRing);
  if (outerShapePoints.length < 3) return null;

  const shape = new THREE.Shape(outerShapePoints);
  const appliedGateIds = [];

  const innerPath = createPathFromRing(normalizedInner, true);
  if (innerPath) {
    shape.holes.push(innerPath);
  }

  if (Array.isArray(gates) && gates.length) {
    gates.forEach((gate) => {
      const hole = createGateHolePath(gate, origin, {
        width: gateWidth,
        depth: gateDepth,
        maxDepth: wallThickness,
      });
      if (hole?.path) {
        shape.holes.push(hole.path);
        if (hole.id) {
          appliedGateIds.push(hole.id);
        }
      }
    });
  }

  return { shape, appliedGateIds };
}

/**
 * __boundaryInternals：导出内部工具函数供测试使用
 * 不建议在生产代码中使用
 */
export const __boundaryInternals = {
  sanitizeRing,
  projectRingWithDuplicates: sanitizeRing,
  prepareClosedRing,
  buildBoundaryGeometry,
  computeSignedArea,
  ensureCounterClockwise,
  offsetRing,
  buildClosedWallShape,
};

/**
 * buildBoundary：构建校园围墙几何体
 * 
 * 参数：scene - THREE.Scene
 * 返回：包含围墙的 Group
 * 
 * 流程：
 * 1. 查找投影原点
 * 2. 从配置读取围墙参数（颜色、宽度、高度）
 * 3. 创建共享材质
 * 4. 遍历所有 campusBoundary 要素
 * 5. 对每个边界：
 *    - 提取外环坐标
 *    - 清洗坐标（投影、去重、校验）
 *    - 构建条带几何体
 *    - 创建 Mesh 并添加 userData
 * 6. 挂载到场景
 */
export function buildBoundary(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const origin = findProjectionOrigin(data.features);
  const color = config.colors?.围墙 || "#f5deb3";
  const boundaryWidth = Number(config.boundary?.width) || 1;
  const boundaryHoleInset = Number(config.boundary?.holeInset) || 0;
  const boundaryHeight = Number(config.boundary?.height) || 2;
  const rawBoundaryBaseY = Number(config.boundary?.baseY);
  const boundaryBaseY = Number.isFinite(rawBoundaryBaseY) ? rawBoundaryBaseY : 0;
  const boundaryGateWidth = Number(config.boundary?.gateWidth) || boundaryWidth;
  const boundaryGateDepth = Number(config.boundary?.gateDepth) || boundaryWidth;
  const baseScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const stripThickness = boundaryWidth / baseScale;
  const wallThickness = (boundaryWidth + boundaryHoleInset) / baseScale;
  const gateWidthScaled = boundaryGateWidth / baseScale;
  const gateDepthScaled = boundaryGateDepth / baseScale;

  const material = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });

  const group = new THREE.Group();
  group.name = "boundary";

  /**
   * 遍历 GeoJSON 要素，筛选校园边界
   */
  data.features.forEach((feature, featureIndex) => {
    const props = feature.properties || {};
    if (props.featureType !== "campusBoundary") return;

    const geometry = feature.geometry;
    if (!geometry) return;

    /**
     * 边界可能为 Polygon 或 MultiPolygon
     * 统一处理为多边形数组
     */
    const polygons =
      geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];

    polygons.forEach((polygon) => {
      if (!Array.isArray(polygon) || !polygon.length) return;

      /**
       * 提取外环（polygon[0]）作为围墙边界
       * 通常校园边界不需要孔洞，只考虑外环
       */
      const outerRing = sanitizeRing(polygon[0], origin);
      if (outerRing.length < 2) return;
      const gates = Array.isArray(props.boundaryGates) ? props.boundaryGates : [];

      const closedShapeResult =
        wallThickness > EPSILON
          ? buildClosedWallShape({
              innerRing: outerRing,
              wallThickness,
              gates,
              origin,
              gateWidth: gateWidthScaled,
              gateDepth: gateDepthScaled,
            })
          : null;

      let mesh = null;

      if (closedShapeResult?.shape) {
        const extrudeGeometry = new THREE.ExtrudeGeometry(closedShapeResult.shape, {
          depth: boundaryHeight,
          bevelEnabled: false,
        });
        extrudeGeometry.rotateX(-Math.PI / 2);
        extrudeGeometry.computeVertexNormals();
        mesh = new THREE.Mesh(extrudeGeometry, material);
        mesh.userData = {
          stableId: props.stableId || feature.id || `boundary-${featureIndex}`,
          name: props.name || "校园围墙",
          boundaryType: props.boundaryType || "campus",
          wallMode: "closedSubtractive",
          gateIds: closedShapeResult.appliedGateIds,
        };
      } else {
        const stripGeometry = buildBoundaryGeometry(outerRing, stripThickness, boundaryHeight);
        if (!stripGeometry) return;
        mesh = new THREE.Mesh(stripGeometry, material);
        mesh.userData = {
          stableId: props.stableId || feature.id || `boundary-${featureIndex}`,
          name: props.name || "校园围墙",
          boundaryType: props.boundaryType || "campus",
          wallMode: "stripFallback",
          gateIds: [],
        };
      }

      mesh.position.y = boundaryBaseY;
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      group.add(mesh);
    });
  });

  scene.add(group);
  return group;
}
