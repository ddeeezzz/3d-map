/**
 * Three.js 场景初始化模块
 * 
 * 职责：
 * 创建和配置 Three.js 的核心基础设施，包括：
 * - 渲染器（带阴影和抗锯齿）
 * - 相机（透视相机，初始俯视校园）
 * - 灯光（环境光 + 平行光，用于阴影）
 * - 交互控制（OrbitControls，支持缩放、旋转、俯仰限制）
 * - 开发模式辅助（网格和坐标轴）
 * - 渲染循环管理（start/stop/render）
 * 
 * 返回值：sceneContext 对象，包含所有必要的引用和方法
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * isDev：判断是否在开发环境
 * 用于决定是否显示调试网格和坐标轴
 */
const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

/**
 * initScene：初始化 Three.js 场景
 * 
 * 参数：
 * - container: DOM 节点，用于挂载 WebGL canvas
 * 
 * 返回：sceneContext 对象，结构如下：
 * {
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   renderer: THREE.WebGLRenderer,
 *   controls: OrbitControls,
 *   resize: Function - 重新计算相机纵横比和渲染器尺寸
 *   render: Function - 单帧渲染（不启动循环）
 *   start: Function - 启动渲染循环
 *   stop: Function - 停止渲染循环
 * }
 * 
 * 异常：若 container 为空，抛出 Error
 */
export function initScene(container) {
  if (!container) {
    throw new Error("必须提供容器节点以挂载 Three.js 场景");
  }

  /**
   * 场景配置
   * 使用深蓝灰色背景 (#0f172a) 与应用整体主题一致
   */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f172a");

  /**
   * 渲染器配置
   * - antialias: true - 开启抗锯齿，提升边缘平滑度
   * - shadowMap: 开启阴影映射（PCFSoftShadowMap 提供柔和阴影）
   */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  /**
   * 相机配置
   * - 视角：60°（FOV）
   * - 初始位置：俯视整个校园，距离中心约 700 米
   * - 近平面：0.1，远平面：5000
   */
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  camera.position.set(0, 400, 700);

  /**
   * 交互控制（OrbitControls）
   * 职责：支持鼠标交互、缩放、旋转相机
   * 配置参数说明：
   * - enableDamping: true - 阻尼效果，使旋转更平滑
   * - dampingFactor: 0.05 - 阻尼强度
   * - maxPolarAngle: Math.PI / 2.05 - 最大俯视角度（约 87.2°，防止相机翻过顶部）
   * - minDistance: 50 - 最小缩放距离（米）
   * - maxDistance: 2500 - 最大缩放距离（米）
   */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 50;
  controls.maxDistance = 2500;

  /**
   * 灯光配置
   * 使用两盏灯提供逼真的光照和阴影效果
   */

  /**
   * 环境光：提供全局基础光照
   * - 强度 0.4：相对较弱，主要用于填充阴影区域
   * - 防止场景过暗
   */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  /**
   * 平行光：模拟太阳光，用于投射阴影
   * - 强度 0.85：主要光源
   * - 位置 (300, 600, 200)：高度和角度都有设置，模拟上午阳光
   * - castShadow: true - 启用阴影投射，建筑会投射影子到地面
   */
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(300, 600, 200);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  /**
   * 开发模式调试辅助
   * 显示 2000x2000 的网格（60 行 60 列）和 XYZ 坐标轴
   * 便于调试场景坐标系和几何体位置
   */
  if (isDev) {
    const grid = new THREE.GridHelper(2000, 60, "#94a3b8", "#475569");
    grid.material.transparent = true;
    grid.material.opacity = 0.65;
    scene.add(grid);

    const axes = new THREE.AxesHelper(200);
    scene.add(axes);
  }

  /**
   * resize：响应窗口/容器大小变化
   * 职责：更新相机纵横比和渲染器输出尺寸
   * 调用时机：
   * - 初始化时（initScene 末尾调用一次）
   * - 窗口 resize 事件（App.jsx 中注册）
   * 
   * 参数处理：
   * - 优先使用 container 的宽高
   * - 降级到 window 的宽高
   * - 最小 1px（避免除以 0）
   * 
   * 高 DPR 处理：限制最大 2x（平衡清晰度和性能）
   */
  const resize = () => {
    const width = container.clientWidth || window.innerWidth || 1;
    const height = container.clientHeight || window.innerHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  };

  /**
   * render：执行单帧渲染
   * 职责：
   * 1. 更新 OrbitControls（处理阻尼）
   * 2. 使用渲染器将场景渲染到 canvas
   * 
   * 调用时机：在渲染循环内（animationId 回调）
   */
  const render = () => {
    controls.update();
    renderer.render(scene, camera);
  };

  /**
   * animationId：存储当前 requestAnimationFrame 的 ID
   * 用于 stop() 时取消渲染循环
   */
  let animationId = null;

  /**
   * start：启动渲染循环
   * 逻辑：
   * 1. 检查是否已启动（若 animationId 存在则直接返回，避免重复启动）
   * 2. 创建递归渲染函数 loop
   * 3. 调用 loop 启动循环
   * 
   * 副作用：每帧调用 render 更新画面，持续运行直到 stop() 被调用
   */
  const start = () => {
    if (animationId) return;
    const loop = () => {
      render();
      animationId = window.requestAnimationFrame(loop);
    };
    loop();
  };

  /**
   * stop：停止渲染循环
   * 逻辑：
   * 1. 检查是否有运行中的渲染循环（animationId 非空）
   * 2. 取消 requestAnimationFrame
   * 3. 清空 animationId
   * 
   * 副作用：场景不再更新，直到 start() 重新启动
   */
  const stop = () => {
    if (animationId) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  /**
   * 初始化：设置初始渲染器尺寸
   */
  resize();

  /**
   * 返回场景上下文对象
   * App.jsx 通过此对象访问和控制 Three.js 场景
   */
  return {
    scene,
    camera,
    renderer,
    controls,
    resize,
    render,
    start,
    stop,
  };
}
