/**
 * 场地拾取交互模块
 *
 * 职责：
 * - 处理 featureType = site 的 Mesh 的 hover / click 行为
 * - 通过 Raycaster 精确拾取当前鼠标下的场地
 * - 在 hover 时临时替换材质以突出显示
 * - 将悬停与选中信息回调给 React/Zustand
 */

// 引入 Three.js 工具，用于 Raycaster、向量与材质操作
import * as THREE from "three";

/**
 * SITE_EMISSIVE_COLOR：场地高亮时的发光颜色
 * 选用 #34d399（薄荷绿）强调体育/公共场地的清爽视觉
 */
const SITE_EMISSIVE_COLOR = new THREE.Color("#34d399");

/**
 * SITE_EMISSIVE_INTENSITY：发光强度，0.55 兼顾透明材质与可读性
 */
const SITE_EMISSIVE_INTENSITY = 0.55;

/**
 * getTopLevelSiteMesh：从射线结果上溯找到 sitesGroup 的直接子 Mesh
 * @param {THREE.Object3D} mesh 射线命中的对象
 * @param {THREE.Group} sitesGroup 场地 group
 * @returns {THREE.Mesh|null} 可用于高亮的顶层 Mesh
 */
function getTopLevelSiteMesh(mesh, sitesGroup) {
  let current = mesh;
  while (current && current.parent && current.parent !== sitesGroup) {
    current = current.parent;
  }
  return current || null;
}

/**
 * highlightSiteMesh：对场地 Mesh 应用高亮材质
 * @param {THREE.Mesh} mesh 需要高亮的 Mesh
 */
function highlightSiteMesh(mesh) {
  if (!mesh || mesh.userData.__siteOriginalMaterial) {
    return;
  }
  mesh.userData.__siteOriginalMaterial = mesh.material;

  let highlightMaterial;
  if (mesh.material && typeof mesh.material.clone === "function") {
    highlightMaterial = mesh.material.clone();
  } else {
    const fallbackColor = mesh.material?.color
      ? mesh.material.color.clone()
      : new THREE.Color("#ffffff");
    highlightMaterial = new THREE.MeshPhongMaterial({
      color: fallbackColor,
      transparent: true,
      opacity: mesh.material?.opacity ?? 0.85,
    });
  }

  if (highlightMaterial.emissive) {
    highlightMaterial.emissive = SITE_EMISSIVE_COLOR.clone();
    highlightMaterial.emissiveIntensity = SITE_EMISSIVE_INTENSITY;
  }
  if (typeof highlightMaterial.opacity === "number") {
    highlightMaterial.opacity = Math.min(
      1,
      (highlightMaterial.opacity ?? 1) + 0.1,
    );
  }
  highlightMaterial.transparent = true;
  mesh.material = highlightMaterial;
}

/**
 * restoreSiteMesh：恢复 Mesh 的原始材质
 * @param {THREE.Mesh} mesh 待恢复的 Mesh
 */
function restoreSiteMesh(mesh) {
  if (!mesh?.userData?.__siteOriginalMaterial) {
    return;
  }
  mesh.material?.dispose?.();
  mesh.material = mesh.userData.__siteOriginalMaterial;
  mesh.userData.__siteOriginalMaterial = null;
}

/**
 * extractSiteInfo：抽取 userData 中对 UI 有意义的字段
 * @param {object} userData Mesh.userData
 * @returns {{stableId: string|null, displayName: string|null, siteCategory: string|null, sportsType: string|null}|null}
 */
function extractSiteInfo(userData) {
  if (!userData) return null;
  const { stableId, displayName, siteCategory, sportsType } = userData;
  return {
    stableId: stableId ?? null,
    displayName: displayName ?? null,
    siteCategory: siteCategory ?? null,
    sportsType: sportsType ?? null,
  };
}

/**
 * computePointer：计算标准化设备坐标
 * @param {PointerEvent} event 指针事件
 * @param {HTMLElement} domElement 渲染容器
 * @param {THREE.Vector2} pointer 承载结果的向量
 */
function computePointer(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

/**
 * pickSiteMesh：执行 Raycaster 拾取
 * @param {THREE.Raycaster} raycaster Raycaster 实例
 * @param {THREE.Vector2} pointer NDC 坐标
 * @param {THREE.Camera} camera 渲染使用的相机
 * @param {THREE.Group} sitesGroup 场地 group
 * @returns {THREE.Mesh|null} 命中的顶层 Mesh
 */
function pickSiteMesh(raycaster, pointer, camera, sitesGroup) {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(sitesGroup.children, true);
  if (!hits.length) {
    return null;
  }
  return getTopLevelSiteMesh(hits[0].object, sitesGroup);
}

/**
 * attachSitePicking：绑定场地 hover/click 交互
 * @param {object} params 参数集合
 * @param {HTMLElement} params.domElement 渲染容器
 * @param {THREE.Camera} params.camera Three.js 相机
 * @param {THREE.Group} params.sitesGroup 场地 group
 * @param {(info: object|null) => void} [params.onHover] hover 回调
 * @param {(info: object|null) => void} [params.onSelect] click 回调
 * @returns {{dispose: () => void, clearHover: () => void}} 资源清理接口
 */
export function attachSitePicking({
  domElement,
  camera,
  sitesGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !sitesGroup) {
    throw new Error("attachSitePicking 需要 domElement/camera/sitesGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  const clearHover = () => {
    if (!hoveredMesh) return;
    restoreSiteMesh(hoveredMesh);
    hoveredMesh = null;
    onHover?.(null);
  };

  const handlePointerMove = (event) => {
    if (!sitesGroup.visible) {
      clearHover();
      return;
    }

    computePointer(event, domElement, pointer);
    const mesh = pickSiteMesh(raycaster, pointer, camera, sitesGroup);
    if (mesh === hoveredMesh) {
      return;
    }

    clearHover();
    if (mesh) {
      hoveredMesh = mesh;
      highlightSiteMesh(mesh);
      onHover?.(extractSiteInfo(mesh.userData));
    }
  };

  const handleClick = () => {
    if (!sitesGroup.visible || !hoveredMesh) {
      return;
    }
    onSelect?.(extractSiteInfo(hoveredMesh.userData));
  };

  domElement.addEventListener("pointermove", handlePointerMove);
  domElement.addEventListener("click", handleClick);

  const dispose = () => {
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("click", handleClick);
    clearHover();
  };

  return { dispose, clearHover };
}
