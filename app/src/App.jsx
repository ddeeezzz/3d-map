import { useEffect, useRef } from "react";
import "./App.css";
import { initScene } from "./three/initScene";
import { buildBuildings } from "./three/buildBuildings";
import DebugPanel from "./components/DebugPanel";
import { logInfo, logError } from "./logger/logger";
import { useSceneStore, SCENE_BASE_ALIGNMENT } from "./store/useSceneStore";
import { attachBuildingPicking } from "./three/interactions/buildingPicking";

function App() {
  const containerRef = useRef(null);
  const buildingGroupRef = useRef(null);
  const sceneTransform = useSceneStore((state) => state.sceneTransform);

  const applySceneTransform = (transform) => {
    const group = buildingGroupRef.current;
    if (!group) return;
    const rotation = SCENE_BASE_ALIGNMENT.rotationY + transform.rotationY;
    const scale = SCENE_BASE_ALIGNMENT.scale * transform.scale;
    const positionX = SCENE_BASE_ALIGNMENT.offset.x + transform.offset.x;
    const positionZ = SCENE_BASE_ALIGNMENT.offset.z + transform.offset.z;

    group.rotation.y = rotation;
    group.scale.set(scale, scale, scale);
    group.position.x = positionX;
    group.position.z = positionZ;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let sceneContext;
    let detachPicking;
    const handleResize = () => {
      sceneContext?.resize();
    };

    try {
      sceneContext = initScene(container);
      logInfo("三维渲染", "Three.js 场景初始化完成");

      const buildingGroup = buildBuildings(sceneContext.scene);
      buildingGroupRef.current = buildingGroup;
      applySceneTransform(useSceneStore.getState().sceneTransform);

      detachPicking = attachBuildingPicking({
        domElement: sceneContext.renderer.domElement,
        camera: sceneContext.camera,
        buildingGroup,
        onHover: (info) => {
          useSceneStore.getState().setHoveredBuilding(info);
        },
        onSelect: (info) => {
          if (!info) return;
          const { stableId, name } = info;
          if (stableId) {
            useSceneStore.getState().setSelectedBuilding(stableId);
          }
          logInfo("三维交互", `选中 ${name ?? stableId ?? "未知建筑"}`);
        },
      });

      sceneContext.start();
      window.addEventListener("resize", handleResize);
    } catch (error) {
      logError("三维渲染", "Three.js 场景初始化失败", {
        错误: error?.message ?? "未知错误",
      });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      detachPicking?.();
      sceneContext?.stop();
      const canvas = sceneContext?.renderer?.domElement;
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  useEffect(() => {
    applySceneTransform(sceneTransform);
  }, [sceneTransform]);

  return (
    <div className="app-root">
      <div ref={containerRef} className="scene-container" />
      <div className="scene-overlay">
        <h1>西南交通大学犀浦校区</h1>
        <p>场景初始化完成后会自动加载建筑数据。</p>
      </div>
      <DebugPanel />
    </div>
  );
}

export default App;
