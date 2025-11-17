/**
 * DebugPanel 组件：开发调试面板
 * 
 * 职责：
 * 仅在开发环境（import.meta.env.DEV）中显示，提供实时调整场景变换参数的界面
 * - 旋转角度（-180° ~ 180°）：调整校园的绕 Y 轴旋转
 * - 缩放比例（0.2 ~ 5）：调整整体缩放因子
 * - 偏移 X、Z（-500 ~ 500 米）：平移校园在地面的位置
 * 
 * 状态管理：通过 Zustand store 与 App.jsx 通信，每次更改都会实时同步到 Three.js 场景
 */

import { useMemo } from "react";
// 读取配置以提供 HDR 选项
import config from "../config";
import { useSceneStore } from "../store/useSceneStore";

/**
 * isDev：判断是否运行在开发环境
 * 值：import.meta.env?.DEV !== false（Vite 注入的开发环境标志）
 */
const isDev = typeof import.meta !== "undefined" ? import.meta.env?.DEV !== false : true;

/**
 * clamp：限制数值在指定范围内的工具函数
 * 参数：value - 待限制的值；min - 下界；max - 上界
 * 返回：Math.min(Math.max(value, min), max) - 被限制在 [min, max] 范围内的值
 * 用途：确保输入的范围控制参数不超出预设限制
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function DebugPanel() {
  /**
   * 从 Zustand store 读取场景变换状态和操作方法
   * - sceneTransform：当前增量变换（rotationY、scale、offset）
   * - updateSceneTransform：部分更新场景变换
   * - resetSceneTransform：重置为初始值（所有增量为 0）
   */
  const sceneTransform = useSceneStore((state) => state.sceneTransform);
  const updateSceneTransform = useSceneStore(
    (state) => state.updateSceneTransform
  );
  const resetSceneTransform = useSceneStore(
    (state) => state.resetSceneTransform
  );
  const environmentSettings = useSceneStore(
    (state) => state.environmentSettings
  );
  const updateEnvironmentSettings = useSceneStore(
    (state) => state.updateEnvironmentSettings
  );
  /**
   * poiStatistics：POI 数量统计安全副本，调试或测试阶段若 store 尚未注入数据则回退为 0，避免空引用
   */
  const poiStatistics =
    useSceneStore((state) => state.poiStatistics) ?? { total: 0, independent: 0 };

  /**
   * rotationDeg：将弧度旋转转换为角度以显示
   * 使用 useMemo 缓存结果，避免不必要的重算
   * 依赖于 sceneTransform.rotationY：当其改变时重新计算
   */
  const rotationDeg = useMemo(
    () => Math.round((sceneTransform.rotationY * 180) / Math.PI),
    [sceneTransform.rotationY]
  );
  const skyboxOptions = useMemo(() => {
    if (Array.isArray(config.environment?.skyboxes) && config.environment.skyboxes.length > 0) {
      return config.environment.skyboxes;
    }
    if (!environmentSettings.skybox) {
      return [];
    }
    return [
      {
        label: environmentSettings.skybox,
        value: environmentSettings.skybox,
      },
    ];
  }, [environmentSettings.skybox]);

  /**
   * 在非开发环境中隐藏调试面板
   */
  if (!isDev) {
    return null;
  }

  /**
   * handleRotationChange：旋转角度 range 输入的改变处理
   * 逻辑：
   * 1. 从事件对象读取角度值（-180 ~ 180）
   * 2. 转换为弧度：deg * π / 180
   * 3. 调用 updateSceneTransform 同步到 store，触发 App.jsx 重新渲染
   */
  const handleRotationChange = (event) => {
    const deg = Number(event.target.value);
    updateSceneTransform({ rotationY: (deg * Math.PI) / 180 });
  };

  /**
   * handleScaleChange：缩放比例 number 输入的改变处理
   * 逻辑：
   * 1. 从事件对象读取缩放值
   * 2. 使用 clamp 限制在 [0.2, 5] 范围内
   * 3. 调用 updateSceneTransform 同步到 store
   */
  const handleScaleChange = (event) => {
    const value = clamp(Number(event.target.value), 0.2, 5);
    updateSceneTransform({ scale: value });
  };

  /**
   * handleOffsetChange：偏移 X/Z 坐标 number 输入的改变处理
   * 参数：axis - 轴名称 "x" 或 "z"
   * 返回：事件处理函数
   * 逻辑：
   * 1. 接收 axis 参数，返回一个闭包函数以处理具体事件
   * 2. 从事件读取偏移值
   * 3. 使用 clamp 限制在 [-500, 500] 范围内
   * 4. 保留另一轴的旧值，仅更新指定轴
   * 5. 调用 updateSceneTransform 同步到 store
   */
  const handleOffsetChange = (axis) => (event) => {
    const value = clamp(Number(event.target.value), -500, 500);
    updateSceneTransform({
      offset: {
        ...sceneTransform.offset,
        [axis]: value,
      },
    });
  };

  /**
   * handleSkyboxChange：切换 HDR 贴图文件
   */
  const handleSkyboxChange = (event) => {
    updateEnvironmentSettings({ skybox: event.target.value });
  };

  /**
   * handleExposureChange：调整曝光值
   */
  const handleExposureChange = (event) => {
    const value = clamp(Number(event.target.value), 0.1, 2.5);
    updateEnvironmentSettings({ exposure: value });
  };

  /**
   * handleEnvironmentToggle：开关天空盒
   */
  const handleEnvironmentToggle = (event) => {
    updateEnvironmentSettings({ enabled: event.target.checked });
  };

  return (
    <div className="debug-panel">
      {/* 面板头部：标题和重置按钮 */}
      <div className="debug-panel__header">
        <span>Debug Panel</span>
        {/* Reset 按钮：调用 resetSceneTransform 恢复所有增量为零 */}
        <button type="button" onClick={resetSceneTransform}>
          Reset
        </button>
      </div>

      {/* 旋转角度控制：range 滑块 (-180 ~ 180°) + 数值显示 */}
      <label className="debug-panel__row">
        <span>旋转角度 (°)</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={rotationDeg}
          onChange={handleRotationChange}
        />
        <span className="debug-panel__value">{rotationDeg}</span>
      </label>

      {/* 缩放比例控制：number 输入框 (0.2 ~ 5) */}
      <label className="debug-panel__row">
        <span>缩放比例</span>
        <input
          type="number"
          min={0.2}
          max={5}
          step={0.1}
          value={sceneTransform.scale}
          onChange={handleScaleChange}
        />
      </label>

      {/* X 轴偏移控制：number 输入框 (-500 ~ 500 米) */}
      <label className="debug-panel__row">
        <span>偏移 X (m)</span>
        <input
          type="number"
          min={-500}
          max={500}
          value={sceneTransform.offset.x}
          onChange={handleOffsetChange("x")}
        />
      </label>

      {/* Z 轴偏移控制：number 输入框 (-500 ~ 500 米) */}
      <label className="debug-panel__row">
        <span>偏移 Z (m)</span>
        <input
          type="number"
          min={-500}
          max={500}
      value={sceneTransform.offset.z}
      onChange={handleOffsetChange("z")}
    />
  </label>

      <details className="debug-panel__section" open>
        <summary>天空盒</summary>
        <div className="debug-panel__section-content">
          <label className="debug-panel__row">
            <span>HDR 贴图</span>
            <select
              aria-label="HDR 贴图选项"
              value={environmentSettings.skybox}
              onChange={handleSkyboxChange}
              disabled={skyboxOptions.length === 0}
            >
              {skyboxOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="debug-panel__row">
            <span>曝光</span>
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={environmentSettings.exposure}
              onChange={handleExposureChange}
              aria-label="曝光调节"
            />
            <span className="debug-panel__value">
              {environmentSettings.exposure.toFixed(2)}
            </span>
          </label>

          <label className="debug-panel__checkbox-row">
            <input
              type="checkbox"
              checked={environmentSettings.enabled}
              onChange={handleEnvironmentToggle}
              aria-label="启用环境光"
            />
            <span>启用环境光</span>
          </label>
        </div>
      </details>

      <details className="debug-panel__section">
        <summary>POI 数据</summary>
        <div className="debug-panel__section-content">
          <div className="debug-panel__row">
            <span>POI 总数</span>
            <span className="debug-panel__value">
              {poiStatistics.total ?? 0}
            </span>
          </div>
          <div className="debug-panel__row">
            <span>独立 POI</span>
            <span className="debug-panel__value">
              {poiStatistics.independent ?? 0}
            </span>
          </div>
          <div className="debug-panel__row">
            <span>附属 POI</span>
            <span className="debug-panel__value">
              {(poiStatistics.total ?? 0) -
                (poiStatistics.independent ?? 0)}
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}

export default DebugPanel;
