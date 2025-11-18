// app/src/components/NavigationPanel.jsx

// 引入 React 及相关 Hook，负责构建交互式导航面板
import React, { useRef, useState } from "react";
// 读取导航状态 store，用于管理地点与交通方式
import { useNavigationStore } from "../store/navigationStore";
// 读取场景 store，便于直接触发三维高亮
import { useSceneStore } from "../store/useSceneStore";
// 导入路网求解函数，执行实际的路径规划
import { solveRouteBetweenPoints } from "../lib/roadGraph";
// 读取全局配置，提供路线高亮 Mesh 等参数
import config from "../config/index.js";
// 引入日志工具，记录路线规划与异常
import { logInfo, logError } from "../logger/logger";
// 导入导航面板样式
import "./NavigationPanel.css";
// 引入地点搜索组件
import LocationSearchInput from "./LocationSearchInput";

/**
 * TransportSelector：交通方式选择器（版本4实现）
 * 负责渲染交通方式下拉列表，仅依赖 navigationStore
 */
const TransportSelector = () => {
  const { transportMode, setTransportMode } = useNavigationStore();
  const [isOpen, setIsOpen] = useState(false);
  const options = {
    walk: { label: "步行", icon: "🚶" },
    bike: { label: "自行车", icon: "🚲" },
    ebike: { label: "电动车", icon: "🛵" },
    drive: { label: "驾驶", icon: "🚗" },
  };
  const currentOption = options[transportMode] || options.walk;
  const handleSelect = (mode) => {
    setTransportMode(mode);
    setIsOpen(false);
  };
  return (
    <div className="transport-selector">
      <button className="selector-display" onClick={() => setIsOpen(!isOpen)}>
        <span>
          {currentOption.icon} {currentOption.label}
        </span>
        <span className={`arrow ${isOpen ? "up" : "down"}`}>▼</span>
      </button>
      {isOpen && (
        <ul className="options-list">
          <li onClick={() => handleSelect("walk")}>🚶 步行</li>
          <li className="骑行-group">
            <span className="group-title">骑行</span>
            <ul className="sub-options">
              <li onClick={() => handleSelect("bike")}>🚲 自行车</li>
              <li onClick={() => handleSelect("ebike")}>🛵 电动车</li>
            </ul>
          </li>
          <li onClick={() => handleSelect("drive")}>🚗 驾驶</li>
        </ul>
      )}
    </div>
  );
};

/**
 * NavigationPanel：地点搜索与路线规划面板
 * - 管理起终点选择
 * - 调用路网算法并写入路线元数据
 * - 提供清除路线的入口
 */
const NavigationPanel = () => {
  const {
    isPanelVisible,
    startLocation,
    endLocation,
    setStartLocation,
    setEndLocation,
  } = useNavigationStore();
  const togglePanel = useNavigationStore((state) => state.togglePanel);
  const navButtonRef = useRef(null);

  /**
   * planRoute：执行路线规划并写入高亮/元信息
   */
  const planRoute = () => {
    if (!startLocation || !endLocation) {
      alert("请先选择起点和终点");
      return;
    }
    try {
      const route = solveRouteBetweenPoints(startLocation, endLocation);
      const pointPath = route?.pointPath ?? [];
      if (!Array.isArray(pointPath) || pointPath.length < 2) {
        alert("未找到路径");
        return;
      }
      const totalLength = Number((route.totalLength ?? 0).toFixed(2));
      const store = useSceneStore.getState();
      store.setHighlightedRoads(route.roadIds || []);
      store.setHighlightedRoutePath(pointPath);
      store.setHighlightedRouteMeta(
        config.poiRoute?.highlightMesh
          ? { ...config.poiRoute.highlightMesh }
          : null
      );
      store.setActiveRoute({
        from: startLocation.name,
        to: endLocation.name,
        length: totalLength,
      });
      logInfo('路线规划', '导航面板触发路线规划', {
        from: startLocation.name,
        to: endLocation.name,
        length: totalLength,
        roadCount: route.roadIds?.length ?? 0,
      });
    } catch (error) {
      logError("路线规划", "路线规划失败", {
        from: startLocation?.name,
        to: endLocation?.name,
        错误: error?.message ?? String(error),
      });
      alert("路线规划失败，请检查地点是否可达");
    }
  };

  /**
   * clearRoute：清理路线相关高亮，确保后续弹窗自动隐藏
   */
  const clearRoute = () => {
    if (typeof window !== "undefined" && typeof window.clearRouteHighlight === "function") {
      window.clearRouteHighlight();
      logInfo("路线规划", "已通过导航面板调用全局清除路线");
      return;
    }
    const store = useSceneStore.getState();
    store.setHighlightedRoads([]);
    store.setHighlightedRoutePath([]);
    store.setHighlightedRouteMeta(null);
    store.setActiveRoute(null);
    logInfo("路线规划", "已通过导航面板清除高亮路线");
  };

  return (
    <>
      <div className="navigation-panel-container">
        <button ref={navButtonRef} onClick={() => togglePanel(navButtonRef)}>🧭 校内导航</button>
      </div>
      {isPanelVisible && (
        <div className="navigation-popup">
          <div className="input-wrapper">
            <span className="input-icon">📍</span>
            <LocationSearchInput
              placeholder="请输入起点"
              selectedLocation={startLocation}
              onSelectLocation={(poi) => setStartLocation(poi)}
              onClearLocation={() => setStartLocation(null)}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-icon">🏁</span>
            <LocationSearchInput
              placeholder="请输入终点"
              selectedLocation={endLocation}
              onSelectLocation={(poi) => setEndLocation(poi)}
              onClearLocation={() => setEndLocation(null)}
            />
          </div>
          <TransportSelector />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={planRoute}>🔍 查找路线</button>
            <button onClick={clearRoute}>✖ 清除路线</button>
          </div>
        </div>
      )}
    </>
  );
};

export default NavigationPanel;
