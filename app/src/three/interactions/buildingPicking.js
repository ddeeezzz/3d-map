/**
 * 建筑交互拾取模块
 * 
 * 职责：
 * 处理建筑 Mesh 的鼠标悬停（hover）和点击（select）事件
 * 提供视觉反馈（高亮）和数据回调
 * 
 * 特点：
 * - 使用 Raycaster 进行三维射线检测
 * - 自动高亮悬停建筑，鼠标移出时恢复
 * - 支持建筑信息回调（用于 UI 展示和状态管理）
 * 
 * 依赖：
 * - THREE.js Raycaster、Vector2、Color
 */

import * as THREE from "three";

/**
 * getTopLevelMesh：找到在 buildingGroup 直接下的顶层 Mesh
 * 
 * 参数：
 * - mesh：Raycaster 击中的对象
 * - group：buildingGroup（建筑容器）
 * 
 * 返回：顶层 Mesh
 * 
 * 用途：
 * ExtrudeGeometry 可能包含多个子 Geometry 或嵌套 Mesh
 * 此函数确保只返回 group 的直接子级 Mesh，避免内部细节暴露
 * 
 * 算法：
 * 从击中点向上遍历父链，直到找到 group 的直接子级
 */
function getTopLevelMesh(mesh, group) {
  let current = mesh;
  while (current && current.parent && current.parent !== group) {
    current = current.parent;
  }
  return current;
}

/**
 * highlightMesh：对建筑应用高亮效果
 * 
 * 参数：mesh - 要高亮的 Mesh
 * 
 * 流程：
 * 1. 检查是否已高亮（__originalMaterial 为 falsy）
 * 2. 保存原材质到 userData.__originalMaterial
 * 3. 克隆材质
 * 4. 修改克隆材质的发光属性：
 *    - 若有 emissive：设为暖色（#fbbf24，琥珀色），强度 0.7
 *    - 若无 emissive：增亮 color（HSL 偏移 +0.2 亮度）
 * 5. 应用克隆材质到 Mesh
 * 
 * 说明：
 * - 克隆避免修改共享材质
 * - 发光效果使建筑在阴影中也能看见
 * - 防御性检查防止重复高亮
 */
function highlightMesh(mesh) {
  if (!mesh || mesh.userData.__originalMaterial) return;
  // 保存原材质供恢复使用
  mesh.userData.__originalMaterial = mesh.material;
  const cloned = mesh.material.clone();
  // 优先使用发光效果
  if (cloned.emissive) {
    cloned.emissive = new THREE.Color("#fbbf24");
    cloned.emissiveIntensity = 0.7;
  } else if (cloned.color) {
    // 备选方案：增亮颜色
    cloned.color = cloned.color.clone();
    cloned.color.offsetHSL(0, 0, 0.2);
  }
  mesh.material = cloned;
}

/**
 * restoreMesh：恢复被高亮的 Mesh 到原材质
 * 
 * 参数：mesh - 要恢复的 Mesh
 * 
 * 流程：
 * 1. 检查 userData.__originalMaterial
 * 2. 释放克隆的材质（清理 GPU 资源）
 * 3. 还原原材质
 * 4. 清空缓存字段
 * 
 * 说明：
 * - dispose() 释放 GPU 贴图/缓冲
 * - 避免内存泄漏和状态污染
 */
function restoreMesh(mesh) {
  if (mesh?.userData.__originalMaterial) {
    // 释放克隆材质的 GPU 资源
    mesh.material.dispose?.();
    // 还原原材质
    mesh.material = mesh.userData.__originalMaterial;
    mesh.userData.__originalMaterial = null;
  }
}

/**
 * extractInfo：从 userData 中提取回调用的信息
 * 
 * 参数：userData - Mesh 的用户数据
 * 返回：{stableId, name, category} 对象或 null
 * 
 * 用途：
 * 过滤出用于 UI/业务逻辑的字段
 * 隐藏内部字段（如 __originalMaterial）
 * 
 * 说明：
 * 仅暴露建筑标识、名称、类别
 * 其他字段（材质、几何数据）不暴露给回调
 */
function extractInfo(userData) {
  if (!userData) return null;
  const { stableId, name, category } = userData;
  return { stableId, name, category };
}

/**
 * attachBuildingPicking：绑定建筑拾取交互
 * 
 * 参数：
 * - domElement：DOM 容器（获取鼠标坐标用）
 * - camera：THREE.Camera（用于 Raycaster）
 * - buildingGroup：建筑 Group（拾取范围）
 * - onHover：function(info | null)，悬停/离开时回调
 * - onSelect：function(info)，点击时回调
 * 
 * 返回：detach 函数，调用时解绑所有事件
 * 
 * 交互流程：
 * 1. 监听 pointermove 事件：
 *    - 计算归一化鼠标坐标（NDC）
 *    - Raycaster 射线拾取
 *    - 与上次悬停建筑对比
 *    - 若不同：恢复旧建筑、高亮新建筑、回调 onHover
 * 2. 监听 click 事件：
 *    - 若当前悬停建筑存在，回调 onSelect
 * 
 * NDC 坐标系：
 * - x: [-1, 1]，左到右
 * - y: [-1, 1]，上到下（注意 y 反向）
 * 
 * Raycaster 检测：
 * - intersectObjects(..., true) 递归检测子 Mesh
 * - 返回按距离排序的击中列表
 * - 使用第一个（最近）击中
 * 
 * 内存管理：
 * - detach 函数移除事件监听
 * - 恢复悬停建筑的材质
 * - 清空缓存引用
 */
export function attachBuildingPicking({
  domElement,
  camera,
  buildingGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !buildingGroup) {
    throw new Error("attachBuildingPicking 需要 domElement、camera 和 buildingGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  /**
   * computePointer：计算归一化设备坐标（NDC）
   * 
   * 参数：event - PointerEvent
   * 
   * 公式：
   * - x = (clientX - left) / width * 2 - 1
   * - y = ((clientY - top) / height * 2 - 1) * -1
   * 
   * 结果存放在 pointer 向量
   */
  const computePointer = (event) => {
    const rect = domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.set(x, y);
  };

  /**
   * pickMesh：通过 Raycaster 拾取 Mesh
   * 
   * 返回：顶层 Mesh 或 null
   * 
   * 流程：
   * 1. 从相机沿指针方向投射射线
   * 2. 与 buildingGroup 的所有子对象相交（递归）
   * 3. 返回最近的击中点对应的 Mesh（顶层）
   */
  const pickMesh = () => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, true);
    if (!hits.length) return null;
    return getTopLevelMesh(hits[0].object, buildingGroup);
  };

  /**
   * handlePointerMove：鼠标移动事件处理
   * 
   * 流程：
   * 1. 计算鼠标坐标
   * 2. 拾取新的 Mesh
   * 3. 与上次悬停建筑对比：
   *    - 若相同：快速返回，无需处理
   *    - 若不同：恢复旧建筑、高亮新建筑、回调
   * 4. 回调 onHover(null) 表示无悬停建筑
   */
  const handlePointerMove = (event) => {
    computePointer(event);
    const mesh = pickMesh();
    if (mesh === hoveredMesh) {
      return;
    }
    // 恢复旧建筑
    if (hoveredMesh) {
      restoreMesh(hoveredMesh);
      onHover?.(null);
    }
    // 高亮新建筑
    if (mesh) {
      highlightMesh(mesh);
      hoveredMesh = mesh;
      onHover?.(extractInfo(mesh.userData));
    } else {
      hoveredMesh = null;
    }
  };

  /**
   * handleClick：鼠标点击事件处理
   * 
   * 流程：
   * 若当前有悬停建筑，回调 onSelect（用于建筑选中/导航）
   */
  const handleClick = () => {
    if (!hoveredMesh) return;
    onSelect?.(extractInfo(hoveredMesh.userData));
  };

  // 绑定事件
  domElement.addEventListener("pointermove", handlePointerMove);
  domElement.addEventListener("click", handleClick);

  /**
   * 返回 detach 函数，用于清理
   * 调用时：移除事件、恢复高亮、清空缓存
   */
  return () => {
    domElement.removeEventListener("pointermove", handlePointerMove);
    domElement.removeEventListener("click", handleClick);
    if (hoveredMesh) {
      restoreMesh(hoveredMesh);
      hoveredMesh = null;
    }
  };
}
