/**
 * 河流交互拾取模块
 * 
 * 职责：
 * 处理河流/水道（river）Mesh 的鼠标悬停（hover）和点击（select）事件
 * 提供 emissive 高亮反馈
 * 
 * 特点：
 * - 使用 Raycaster 进行三维射线检测
 * - 通过改变 emissive 颜色实现高亮
 * - 支持图层可见性检查
 * - 结构与 waterPicking 一致，针对河流要素
 * 
 * 依赖：
 * - THREE.js Raycaster、Vector2、Color
 * 
 * 说明：
 * riverPicking 与 waterPicking 几乎完全相同，区别仅在于目标 Group 名称
 * 两者都使用相同的高亮策略和交互流程
 */

import * as THREE from "three";

/**
 * HOVER_COLOR：河流高亮颜色
 * #5ad0ff 为青蓝色，与水系配色一致
 */
const HOVER_COLOR = new THREE.Color("#5ad0ff");

/**
 * HOVER_INTENSITY：高亮强度
 * 0.5 表示中等发光强度
 */
const HOVER_INTENSITY = 0.5;

/**
 * computePointer：计算归一化设备坐标（NDC）
 * 
 * 参数：
 * - event：PointerEvent
 * - domElement：DOM 容器
 * - pointer：THREE.Vector2（传出结果）
 * 
 * 用途：将屏幕坐标转换为 NDC，供 Raycaster 使用
 */
function computePointer(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

/**
 * highlightMesh：对河流应用 emissive 高亮
 * 
 * 参数：mesh - 要高亮的 Mesh
 * 
 * 流程：
 * 1. 校验 material.emissive
 * 2. 复制高亮颜色到 emissive
 * 3. 设置发光强度
 */
function highlightMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissive.copy(HOVER_COLOR);
  mesh.material.emissiveIntensity = HOVER_INTENSITY;
}

/**
 * resetMesh：还原河流 emissive 高亮
 * 
 * 参数：mesh - 要还原的 Mesh
 * 
 * 流程：
 * 仅重置 emissiveIntensity 为 0
 */
function resetMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissiveIntensity = 0;
}

/**
 * attachRiverPicking：绑定河流拾取交互
 * 
 * 参数：
 * - domElement：DOM 容器
 * - camera：THREE.Camera
 * - riverGroup：河流/水道 Group
 * - onHover：function(userData | null)，悬停/离开时回调
 * - onSelect：function(userData)，点击时回调
 * 
 * 返回：{dispose, clearHover} 对象
 * - dispose：清理函数
 * - clearHover：手动清除高亮函数
 * 
 * 交互流程：
 * 1. 监听 pointermove：
 *    - 检查 riverGroup 是否可见
 *    - 计算鼠标坐标
 *    - Raycaster 拾取击中的 Mesh
 *    - 若与上次不同：清除旧高亮、高亮新对象、回调
 * 2. 监听 click：
 *    - 检查 riverGroup 可见性
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
export function attachRiverPicking({
  domElement,
  camera,
  riverGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !riverGroup) {
    throw new Error("attachRiverPicking 需要 domElement、camera 与 riverGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  /**
   * clearHover：清除当前高亮状态
   */
  const clearHover = () => {
    if (!hoveredMesh) return;
    resetMesh(hoveredMesh);
    hoveredMesh = null;
    onHover?.(null);
  };

  /**
   * handlePointerMove：鼠标移动事件处理
   */
  const handlePointerMove = (event) => {
    if (!riverGroup.visible) {
      clearHover();
      return;
    }

    computePointer(event, domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(riverGroup.children, true);
    const nextMesh = hits.length ? hits[0].object : null;

    if (nextMesh === hoveredMesh) {
      return;
    }

    clearHover();

    if (nextMesh) {
      hoveredMesh = nextMesh;
      highlightMesh(nextMesh);
      onHover?.(nextMesh.userData || null);
    }
  };

  /**
   * handleClick：鼠标点击事件处理
   */
  const handleClick = () => {
    if (!riverGroup.visible || !hoveredMesh) {
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
