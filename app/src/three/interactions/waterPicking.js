/**
 * 水系交互拾取模块
 * 
 * 职责：
 * 处理水体（lake/water）Mesh 的鼠标悬停（hover）和点击（select）事件
 * 提供 emissive 高亮反馈
 * 
 * 特点：
 * - 使用 Raycaster 进行三维射线检测
 * - 通过改变 emissive 颜色实现高亮（不克隆材质，直接修改）
 * - 支持图层可见性检查（若水系隐藏则清除高亮）
 * - 支持手动清除高亮
 * 
 * 依赖：
 * - THREE.js Raycaster、Vector2、Color
 */

import * as THREE from "three";

/**
 * HOVER_COLOR：水体高亮颜色
 * #5ad0ff 为青蓝色，与水体配色相近，高亮效果明显
 */
const HOVER_COLOR = new THREE.Color("#5ad0ff");

/**
 * HOVER_INTENSITY：高亮强度
 * 0.5 表示发光强度为 50%，相对温和，不会过度刺眼
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
 * highlightMesh：对水体应用 emissive 高亮
 * 
 * 参数：mesh - 要高亮的 Mesh
 * 
 * 特点：
 * - 仅修改 emissive 属性，不克隆材质
 * - 多个水体可同时高亮（便于群组效果）
 * - 防御性检查 material.emissive
 * 
 * 说明：
 * 与 buildingPicking 的克隆策略不同
 * 水体通常不需要完全恢复原样，简单改变发光强度即可
 */
function highlightMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissive.copy(HOVER_COLOR);
  mesh.material.emissiveIntensity = HOVER_INTENSITY;
}

/**
 * resetMesh：还原水体 emissive 高亮
 * 
 * 参数：mesh - 要还原的 Mesh
 * 
 * 流程：
 * 仅重置 emissiveIntensity 为 0，color 保留不变
 * 这样下次高亮时不需要重新 copy
 */
function resetMesh(mesh) {
  if (!mesh?.material?.emissive) return;
  mesh.material.emissiveIntensity = 0;
}

/**
 * attachWaterPicking：绑定水系拾取交互
 * 
 * 参数：
 * - domElement：DOM 容器（获取鼠标坐标用）
 * - camera：THREE.Camera（用于 Raycaster）
 * - waterGroup：水系 Group（拾取范围）
 * - onHover：function(userData | null)，悬停/离开时回调
 * - onSelect：function(userData)，点击时回调
 * 
 * 返回：{dispose, clearHover} 对象
 * - dispose：清理函数，移除事件监听
 * - clearHover：手动清除高亮函数
 * 
 * 交互流程：
 * 1. 监听 pointermove 事件：
 *    - 检查 waterGroup 是否可见
 *    - 计算鼠标坐标和 Raycaster 射线
 *    - 拾取击中的第一个 Mesh
 *    - 若与上次不同，清除旧高亮并高亮新对象
 * 2. 监听 click 事件：
 *    - 检查 waterGroup 可见性和悬停 Mesh 存在
 *    - 回调 onSelect（用于 UI 展示）
 * 
 * 特性：
 * - 图层可见性联动：若 waterGroup.visible = false，自动清除高亮
 * - clearHover 支持手动清除（如 UI 关闭时）
 * - userData 直接暴露（不过滤，便于灵活使用）
 * 
 * 内存管理：
 * - dispose 移除事件监听
 * - 清除高亮状态
 * - 清空缓存引用
 */
export function attachWaterPicking({
  domElement,
  camera,
  waterGroup,
  onHover,
  onSelect,
}) {
  if (!domElement || !camera || !waterGroup) {
    throw new Error("attachWaterPicking 需要 domElement、camera 与 waterGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  /**
   * clearHover：清除当前高亮状态
   * 
   * 用途：
   * - 鼠标移出水体时调用
   * - 水系图层隐藏时调用
   * - dispose 时调用
   */
  const clearHover = () => {
    if (!hoveredMesh) return;
    resetMesh(hoveredMesh);
    hoveredMesh = null;
    onHover?.(null);
  };

  /**
   * handlePointerMove：鼠标移动事件处理
   * 
   * 流程：
   * 1. 检查水系是否可见（若不可见则清除高亮）
   * 2. 计算鼠标坐标
   * 3. Raycaster 拾取击中的 Mesh
   * 4. 与上次悬停建筑对比
   * 5. 若不同：清除旧高亮、高亮新对象、回调
   */
  const handlePointerMove = (event) => {
    if (!waterGroup.visible) {
      clearHover();
      return;
    }

    computePointer(event, domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(waterGroup.children, true);
    // 取最近击中的 Mesh（第一个）
    const nextMesh = hits.length ? hits[0].object : null;

    if (nextMesh === hoveredMesh) {
      return;
    }

    clearHover();

    if (nextMesh) {
      hoveredMesh = nextMesh;
      highlightMesh(nextMesh);
      // 直接暴露 userData（不过滤）
      onHover?.(nextMesh.userData || null);
    }
  };

  /**
   * handleClick：鼠标点击事件处理
   * 
   * 流程：
   * 检查水系可见性和悬停 Mesh 存在
   * 若满足条件，回调 onSelect（用于导航或详情展示）
   */
  const handleClick = () => {
    if (!waterGroup.visible || !hoveredMesh) {
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
