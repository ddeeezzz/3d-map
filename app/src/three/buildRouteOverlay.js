import * as THREE from "three";
import config from "../config/index.js";
import { buildRoadGeometry } from "./buildRoads";
import { SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";

const DEFAULT_HIGHLIGHT_OPTIONS = {
  width: 4,
  height: 0.3,
  yOffset: 0.05,
  color: "#FF5252",
  opacity: 0.85,
  renderOrder: 200,
};

/**
 * mergeOptions：合并配置、默认值与调用入参
 * 目的：确保渲染时有完整参数（宽度/颜色/高度等）
 * 返回：叠加后的新对象
 */
const mergeOptions = (options = {}) => ({
  ...DEFAULT_HIGHLIGHT_OPTIONS,
  ...(config.poiRoute?.highlightMesh || {}),
  ...(options || {}),
});

/**
 * POINT_EPSILON：相邻点去重阈值
 * 单位：米
 * 作用：避免重复坐标导致法线为零
 */
const POINT_EPSILON = 1e-4;

/**
 * toVectorPath：将 pointPath 转为 THREE.Vector2 数组并去除重复点
 * @param {Array} pointPath - 包含 worldX/worldZ 的节点序列
 * @returns {THREE.Vector2[]} - 适合传入道路建模算法的二维向量数组
 */
const toVectorPath = (pointPath = []) => {
  const vectors = [];
  let lastVector = null;
  pointPath.forEach((node) => {
    const x = Number(node?.worldX);
    const z = Number(node?.worldZ);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return;
    }
    // 将 Three.js z 轴坐标还原为投影平面的 y（挤出算法输入）
    const planarY = -z;
    const current = new THREE.Vector2(x, planarY);
    if (
      lastVector &&
      lastVector.distanceToSquared(current) <= POINT_EPSILON
    ) {
      return;
    }
    vectors.push(current);
    lastVector = current;
  });
  return vectors;
};

/**
 * createHighlightMesh：复用道路建模方案构建路线 Mesh
 * @param {THREE.Vector2[]} vectorPath - 处理后的二维路径
 * @param {object} mergedOptions - 含宽度/高度/颜色等的配置
 * @returns {THREE.Mesh|null} - 渲染用 Mesh，失败时返回 null
 */
const createHighlightMesh = (vectorPath, mergedOptions) => {
  if (!Array.isArray(vectorPath) || vectorPath.length < 2) {
    return null;
  }
  const baseSceneScale = SCENE_BASE_ALIGNMENT?.scale ?? 1;
  const widthValue = Number(mergedOptions.width);
  const heightValue = Number(mergedOptions.height);
  const yOffsetValue = Number(mergedOptions.yOffset);
  const opacityValue = Number(mergedOptions.opacity);
  const renderOrderValue = Number(mergedOptions.renderOrder);
  const thicknessSource = Number.isFinite(widthValue)
    ? widthValue
    : DEFAULT_HIGHLIGHT_OPTIONS.width;
  const depthSource = Number.isFinite(heightValue)
    ? heightValue
    : DEFAULT_HIGHLIGHT_OPTIONS.height;
  const thickness = thicknessSource / baseSceneScale;
  if (!Number.isFinite(thickness) || thickness <= 0) {
    return null;
  }
  const depth = Math.max(depthSource, 0.01);
  const geometry = buildRoadGeometry(vectorPath, thickness, depth);
  if (!geometry) {
    return null;
  }
  const colorHex = mergedOptions.color || DEFAULT_HIGHLIGHT_OPTIONS.color;
  const opacity = Number.isFinite(opacityValue)
    ? Math.min(Math.max(opacityValue, 0.05), 1)
    : DEFAULT_HIGHLIGHT_OPTIONS.opacity;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.6,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const yOffset = Number.isFinite(yOffsetValue)
    ? yOffsetValue
    : DEFAULT_HIGHLIGHT_OPTIONS.yOffset;
  // 将路线 Mesh 整体抬升到指定高度，使其悬浮在道路表面之上
  mesh.position.y = yOffset;
  const renderOrder = Number.isFinite(renderOrderValue)
    ? renderOrderValue
    : DEFAULT_HIGHLIGHT_OPTIONS.renderOrder;
  mesh.renderOrder = renderOrder;
  return mesh;
};

function disposeChild(child) {
  if (child?.geometry?.dispose) {
    child.geometry.dispose();
  }
  if (Array.isArray(child?.material)) {
    child.material.forEach((mat) => mat?.dispose?.());
  } else if (child?.material?.dispose) {
    child.material.dispose();
  }
}

export function buildRouteOverlay(parentGroup, scene) {
  const overlayGroup = new THREE.Group();
  overlayGroup.name = "routeOverlay";
  const host = parentGroup || scene;
  if (!host) {
    throw new Error("route overlay requires a host group or scene");
  }
  host.add(overlayGroup);

  const clearRouteOverlay = () => {
    [...overlayGroup.children].forEach((child) => {
      disposeChild(child);
      overlayGroup.remove(child);
    });
  };

  const renderRouteOverlay = (pointPath = [], options = {}) => {
    clearRouteOverlay();
    if (!Array.isArray(pointPath) || pointPath.length < 2) {
      return;
    }
    const merged = mergeOptions(options);
    const vectorPath = toVectorPath(pointPath);
    if (vectorPath.length < 2) {
      return;
    }
    const mesh = createHighlightMesh(vectorPath, merged);
    if (!mesh) {
      return;
    }
    overlayGroup.add(mesh);
  };

  return {
    group: overlayGroup,
    renderRouteOverlay,
    clearRouteOverlay,
  };
}
