/**
 * 道路交互拾取模块
 * 
 * 职责：
 * 处理道路（road）Mesh 的鼠标悬停（hover）和点击（select）事件
 * 提供 emissive 高亮反馈
 * 
 * 特点：
 * - 使用 Raycaster 进行三维射线检测
 * - 通过改变 emissive 颜色实现高亮（白色，与道路灰色对比明显）
 * - 支持图层可见性检查
 * - 函数命名更详细（enableHover/disableHover/pickRoadMesh 等）
 * 
 * 依赖：
 * - THREE.js Raycaster、Vector2、Color
 * 
 * 说明：
 * 道路高亮采用白色（#ffffff），与道路的灰色形成对比
 * 相比水系的青蓝色，白色高亮更适合灰色道路的可见性
 */

import * as THREE from "three";

/**
 * HOVER_EMISSIVE_COLOR：道路高亮颜色
 * #ffffff 为白色，与灰色道路形成明显对比
 */
const HOVER_EMISSIVE_COLOR = new THREE.Color("#ffffff");

/**
 * HOVER_EMISSIVE_INTENSITY：高亮强度
 * 0.4 表示较柔和的发光强度
 */
const HOVER_EMISSIVE_INTENSITY = 0.4;

/**
 * computePointerPosition：计算归一化设备坐标（NDC）
 * 
 * 参数：
 * - event：PointerEvent
 * - domElement：DOM 容器
 * - pointer：THREE.Vector2（传出结果）
 * 
 * 用途：将屏幕坐标转换为 NDC
 * 
 * 说明：
 * 函数名改为 computePointerPosition（相比 computePointer 更具体）
 */
function computePointerPosition(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

/**
 * enableHover：启用道路高亮效果
 * 
 * 参数：mesh - 要高亮的 Mesh
 * 
 * 流程：
 * 1. 校验 material.emissive
 * 2. 复制高亮颜色
 * 3. 设置强度
 * 
 * 说明：
 * 函数名改为 enableHover（相比 highlightMesh 更操作性）
 */
function enableHover(mesh) {
  if (mesh?.material?.emissive) {
    mesh.material.emissive.copy(HOVER_EMISSIVE_COLOR);
    mesh.material.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
  }
}

/**
 * disableHover：禁用道路高亮效果
 * 
 * 参数：mesh - 要还原的 Mesh
 * 
 * 流程：
 * 仅重置 emissiveIntensity 为 0
 * 
 * 说明：
 * 函数名改为 disableHover（相比 resetMesh 更清晰）
 */
function disableHover(mesh) {
  if (mesh?.material?.emissive) {
    mesh.material.emissiveIntensity = 0;
  }
}

/**
 * pickRoadMesh：通过 Raycaster 拾取道路 Mesh
 * 
 * 参数：
 * - raycaster：THREE.Raycaster
 * - pointer：THREE.Vector2（NDC）
 * - camera：THREE.Camera
 * - roadsGroup：道路 Group
 * 
 * 返回：击中的 Mesh 或 null
 * 
 * 流程：
 * 1. 从相机沿指针方向投射射线
 * 2. 与 roadsGroup 的子对象相交
 * 3. 返回最近的击中对象（第一个）
 * 
 * 说明：
 * 此函数从 handlePointerMove 中提取，增强代码模块化
 */
function pickRoadMesh(raycaster, pointer, camera, roadsGroup) {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(roadsGroup.children, true);
  if (!hits.length) {
    return null;
  }
  return hits[0].object;
}

/**
 * attachRoadPicking：绑定道路拾取交互
 * 
 * 参数：
 * - domElement：DOM 容器
 * - camera：THREE.Camera
 * - roadsGroup：道路 Group
 * - onHover：function(userData | null)，悬停/离开时回调
 * - onSelect：function(userData)，点击时回调
 * 
 * 返回：{dispose, clearHover} 对象
 * - dispose：清理函数
 * - clearHover：手动清除高亮函数
 * 
 * 交互流程：
 * 1. 监听 pointermove：
 *    - 检查 roadsGroup 是否可见
 *    - 计算鼠标坐标
 *    - pickRoadMesh 拾取击中的 Mesh
 *    - 若与上次不同：禁用旧高亮、启用新高亮、回调
 * 2. 监听 click：
 *    - 检查 roadsGroup 可见性
 *    - 回调 onSelect
 * 
 * 特性：
 * - 图层可见性联动
 * - clearHover 支持手动清除
 * - userData 直接暴露
 * 
 * 内存管理：
 * - dispose 移除事件监听和清除高亮状态
 */
export function attachRoadPicking({
  domElement,
  camera,
  roadsGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !roadsGroup) {
    throw new Error("attachRoadPicking 需要 domElement、camera 和 roadsGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  /**
   * clearHover：清除当前高亮状态
   */
  const clearHover = () => {
    if (!hoveredMesh) return;
    disableHover(hoveredMesh);
    hoveredMesh = null;
    onHover?.(null);
  };

  /**
   * handlePointerMove：鼠标移动事件处理
   */
  const handlePointerMove = (event) => {
    if (!roadsGroup.visible) {
      clearHover();
      return;
    }

    computePointerPosition(event, domElement, pointer);
    const mesh = pickRoadMesh(raycaster, pointer, camera, roadsGroup);

    if (mesh === hoveredMesh) {
      return;
    }

    clearHover();

    if (mesh) {
      hoveredMesh = mesh;
      enableHover(mesh);
      onHover?.(mesh.userData || null);
    }
  };

  /**
   * handleClick：鼠标点击事件处理
   */
  const handleClick = () => {
    if (!roadsGroup.visible || !hoveredMesh) {
      return;
    }
    onSelect?.(hoveredMesh.userData || null);
  };

  // 绑定事件
  domElement.addEventListener("pointermove", handlePointerMove);
  domElement.addEventListener("click", handleClick);

  /**
   * dispose：清理函数
   */
  const dispose = () => {
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("click", handleClick);
    clearHover();
  };

  return { dispose, clearHover };
}
