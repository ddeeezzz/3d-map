// app/src/components/NavigationPanel.jsx

import React, { useRef, useState } from 'react';
import { useNavigationStore } from '../store/navigationStore';
import { useSceneStore } from '../store/useSceneStore';
import { solveRouteBetweenPoints } from '../lib/roadGraph';
import config from '../config/index.js';
import { logInfo, logError } from '../logger/logger';
import './NavigationPanel.css';
import LocationSearchInput from './LocationSearchInput';

const TransportSelector = () => {
  const { transportMode, setTransportMode } = useNavigationStore();
  const [isOpen, setIsOpen] = useState(false);
  const options = {
    walk: { label: '步行', icon: '🚶' },
    bike: { label: '自行车', icon: '🚲' },
    ebike: { label: '电动车', icon: '🛵' },
    drive: { label: '驾驶', icon: '🚗' },
  };
  const handleSelect = (mode) => {
    setTransportMode(mode);
    setIsOpen(false);
  };
  return (
    <div className="transport-selector">
      <button className="selector-display" onClick={() => setIsOpen(!isOpen)}>
        <span>
          {options[transportMode].icon} {options[transportMode].label}
        </span>
        <span className={`arrow ${isOpen ? 'up' : 'down'}`}>▼</span>
      </button>
      {isOpen && (
        <ul className="options-list">
          <li onClick={() => handleSelect('walk')}>🚶 步行</li>
          <li className="骑行-group">
            <span className="group-title">骑行</span>
            <ul className="sub-options">
              <li onClick={() => handleSelect('bike')}>🚲 自行车</li>
              <li onClick={() => handleSelect('ebike')}>🛵 电动车</li>
            </ul>
          </li>
          <li onClick={() => handleSelect('drive')}>🚗 驾驶</li>
        </ul>
      )}
    </div>
  );
};

const NavigationPanel = () => {
  const {
    isPanelVisible,
    panelPosition,
    startLocation,
    endLocation,
    setStartLocation,
    setEndLocation,
  } = useNavigationStore();
  const togglePanel = useNavigationStore((state) => state.togglePanel);
  const navButtonRef = useRef(null);

  const planRoute = () => {
    if (!startLocation || !endLocation) {
      alert('请先选择起点和终点');
      return;
    }
    try {
      const route = solveRouteBetweenPoints(startLocation, endLocation);
      const pointPath = route?.pointPath ?? [];
      if (!Array.isArray(pointPath) || pointPath.length < 2) {
        alert('未找到路径');
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
      logError('路线规划', '路线规划失败', {
        from: startLocation?.name,
        to: endLocation?.name,
        错误: error?.message ?? String(error),
      });
      alert('路线规划失败，请检查地点是否可达');
    }
  };

  const clearRoute = () => {
    if (typeof window !== 'undefined' && typeof window.clearRouteHighlight === 'function') {
      window.clearRouteHighlight();
      logInfo('路线规划', '已通过导航面板调用全局清除路线');
      return;
    }
    const store = useSceneStore.getState();
    store.setHighlightedRoads([]);
    store.setHighlightedRoutePath([]);
    store.setHighlightedRouteMeta(null);
    store.setActiveRoute(null);
    logInfo('路线规划', '已通过导航面板清除高亮路线');
  };

  return (
    <>
      <div className="navigation-panel-container">
        <button ref={navButtonRef} onClick={() => togglePanel(navButtonRef)}>🧭 校内导航</button>
      </div>
      {isPanelVisible && (
        <div
          className="navigation-popup"
          style={{ top: `${panelPosition.top}px`, left: `${panelPosition.left}px` }}
        >
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
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={planRoute}>🔍 查找路线</button>
            <button onClick={clearRoute}>✖ 清除路线</button>
          </div>
        </div>
      )}
    </>
  );
};

export default NavigationPanel;