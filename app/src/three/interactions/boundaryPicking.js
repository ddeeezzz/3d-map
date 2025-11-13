/**
 * 边界交互拾取模块
 * 
 * 职责：
 * 处理校园边界/围墙（boundary）Mesh 的鼠标悬停（hover）和点击（select）事件
 * 提供 emissive 高亮反馈和日志记录
 * 
 * 特点：
 * - 使用 Raycaster 进行三维射线检测
 * - 采用 WeakMap 缓存原始 emissive 状态（避免内存泄漏）
 * - 仅支持悬停交互，不暴露 onHover/onSelect 回调
 * - 点击时输出日志，便于调试和审计
 * - 黄色高亮（#ffe082），与边界灰色形成对比
 * 
 * 依赖：
 * - THREE.js Raycaster、Vector2、Color、WeakMap
 * - logger.js 用于记录交互
 */

import * as THREE from "three";
import { logInfo } from "../../logger/logger.js";

/**
 * HOVER_COLOR：边界高亮颜色
 * #ffe082 为浅黄色，与灰色边界形成明显对比
 */
const HOVER_COLOR = new THREE.Color("#ffe082");

/**
 * HOVER_INTENSITY：高亮强度
 * 0.5 表示中等发光强度
 */
const HOVER_INTENSITY = 0.5;

/**
 * emissiveCache：存储原始 emissive 状态的缓存
 * 
 * 用途：
 * - 保存高亮前的颜色和强度
 * - 恢复时精确还原原样
 * 
 * 使用 WeakMap 的优势：
 * - 当 Mesh 被垃圾回收时，缓存条目自动释放
 * - 避免内存泄漏和引用计数问题
 * 
 * 结构：{color: Color, intensity: number}
 */
const emissiveCache = new WeakMap();

/**
 * computePointer：计算归一化设备坐标（NDC）
 * 
 * 参数：
 * - event：PointerEvent
 * - domElement：DOM 容器
 * - pointer：THREE.Vector2（传出结果）
 * 
 * 用途：将屏幕坐标转换为 NDC
 */
function computePointer(event, domElement, pointer) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

/**
 * applyHover：对边界应用高亮效果
 * 
 * 参数：mesh - 要高亮的 Mesh
 * 
 * 流程：
 * 1. 校验 material.emissive
 * 2. 若首次高亮此 Mesh：
 *    - 克隆原始 emissive（颜色 + 强度）
 *    - 存入 WeakMap
 * 3. 复制高亮颜色
 * 4. 设置发光强度（取较大值，避免覆盖已有的强度）
 * 
 * 说明：
 * Math.max(..., HOVER_INTENSITY) 确保高亮强度不低于 0.5
 * 某些场景下 emissive 可能已有初值，此处保留并增强
 */
function applyHover(mesh) {
  if (!mesh?.material?.emissive) return;
  // 首次高亮时缓存原始状态
  if (!emissiveCache.has(mesh)) {
    emissiveCache.set(mesh, {
      color: mesh.material.emissive.clone(),
      intensity: mesh.material.emissiveIntensity ?? 0,
    });
  }
  // 应用高亮
  mesh.material.emissive.copy(HOVER_COLOR);
  mesh.material.emissiveIntensity = Math.max(
    mesh.material.emissiveIntensity ?? 0,
    HOVER_INTENSITY,
  );
}

/**
 * resetHover：恢复边界原始 emissive 状态
 * 
 * 参数：mesh - 要恢复的 Mesh
 * 
 * 流程：
 * 1. 从 WeakMap 读取缓存
 * 2. 若缓存存在：
 *    - 复制原始颜色
 *    - 恢复原始强度
 *    - 删除缓存条目
 * 3. 否则返回（可能从未高亮过）
 * 
 * 说明：
 * WeakMap 的 delete 操作是可选的（垃圾回收时自动清理）
 * 但主动删除能加快内存回收
 */
function resetHover(mesh) {
  const cache = emissiveCache.get(mesh);
  if (!cache || !mesh?.material?.emissive) return;
  // 精确恢复原始状态
  mesh.material.emissive.copy(cache.color);
  mesh.material.emissiveIntensity = cache.intensity;
  // 清理缓存
  emissiveCache.delete(mesh);
}

/**
 * attachBoundaryPicking：绑定边界拾取交互
 * 
 * 参数：
 * - domElement：DOM 容器
 * - camera：THREE.Camera
 * - boundaryGroup：边界 Group
 * 
 * 返回：{dispose, clearHover} 对象
 * - dispose：清理函数
 * - clearHover：手动清除高亮函数
 * 
 * 特性对比：
 * - 不提供 onHover/onSelect 回调参数（仅内部处理）
 * - 点击时通过 logger 记录交互事件
 * - 用途：主要为了可视化和调试，而非业务数据处理
 * 
 * 交互流程：
 * 1. 监听 pointermove：
 *    - 检查 boundaryGroup 是否可见
 *    - 计算鼠标坐标
 *    - Raycaster 拾取击中的 Mesh
 *    - 若与上次不同：恢复旧高亮、应用新高亮
 * 2. 监听 click：
 *    - 检查 boundaryGroup 可见性
 *    - 记录交互日志（包括边界名称、类型等）
 *    - 不触发状态管理（仅信息输出）
 * 
 * 日志记录：
 * - 模块："围墙交互"
 * - 消息："点击 {边界名称}"
 * - 数据：{stableId, boundaryType}
 * 
 * 内存管理：
 * - dispose 移除事件监听和清除高亮状态
 * - WeakMap 自动管理缓存生命周期
 */
export function attachBoundaryPicking({ domElement, camera, boundaryGroup }) {
  if (!domElement || !camera || !boundaryGroup) {
    throw new Error("attachBoundaryPicking 需要 domElement、camera 与 boundaryGroup");
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  /**
   * clearHover：清除当前高亮状态
   */
  const clearHover = () => {
    if (!hoveredMesh) return;
    resetHover(hoveredMesh);
    hoveredMesh = null;
  };

  /**
   * handlePointerMove：鼠标移动事件处理
   * 
   * 流程：
   * 1. 检查 boundaryGroup 可见性
   * 2. 计算鼠标坐标
   * 3. Raycaster 拾取击中的 Mesh
   * 4. 与上次悬停建筑对比
   * 5. 若不同：清除旧高亮、应用新高亮
   */
  const handlePointerMove = (event) => {
    if (!boundaryGroup.visible) {
      clearHover();
      return;
    }
    computePointer(event, domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(boundaryGroup.children, true);
    const nextMesh = hits.length ? hits[0].object : null;
    if (nextMesh === hoveredMesh) {
      return;
    }
    clearHover();
    if (nextMesh) {
      hoveredMesh = nextMesh;
      applyHover(nextMesh);
    }
  };

  /**
   * handleClick：鼠标点击事件处理
   * 
   * 流程：
   * 1. 检查 boundaryGroup 可见性和悬停 Mesh 存在
   * 2. 提取 userData（name、stableId、boundaryType）
   * 3. 记录交互日志
   */
  const handleClick = () => {
    if (!boundaryGroup.visible || !hoveredMesh) {
      return;
    }
    const data = hoveredMesh.userData || {};
    const title = data.name ?? data.stableId ?? "未命名围墙";
    // 记录交互事件到日志系统
    logInfo("围墙交互", `点击 ${title}`, {
      stableId: data.stableId,
      boundaryType: data.boundaryType,
    });
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
