import { useEffect, useRef } from "react";
import "./App.css";
import { initScene } from "./three/initScene";
import { buildBuildings } from "./three/buildBuildings";
import { buildRoads } from "./three/buildRoads";
import { buildWater } from "./three/buildWater";
import DebugPanel from "./components/DebugPanel";
import { logInfo, logError } from "./logger/logger";
import { useSceneStore, SCENE_BASE_ALIGNMENT } from "./store/useSceneStore";
import { attachBuildingPicking } from "./three/interactions/buildingPicking";
import { attachRoadPicking } from "./three/interactions/roadPicking";
import { attachWaterPicking } from "./three/interactions/waterPicking";

function App() {
  /** DOM/Three.js 引用 —— 便于在副作用中访问。 */
  const containerRef = useRef(null);
  const buildingGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const roadsGroupRef = useRef(null);
  const roadPickingHandleRef = useRef(null);
  const waterPickingHandleRef = useRef(null);
  const hoveredRoadInfoRef = useRef(null);
  const hoveredWaterInfoRef = useRef(null);

  /** Zustand 状态 —— 仅提取当前组件需要的字段。 */
  const sceneTransform = useSceneStore((state) => state.sceneTransform);
  const roadsVisible = useSceneStore(
    (state) => state.layerVisibility?.roads ?? true
  );
  const waterVisible = useSceneStore(
    (state) => state.layerVisibility?.water ?? true
  );

  /**
   * 将调试面板的增量（sceneTransform）叠加到基准姿态，统一应用到 buildings/water/roads。
   */
  const applySceneTransform = (transform) => {
    const rotation = SCENE_BASE_ALIGNMENT.rotationY + transform.rotationY;
    const scale = SCENE_BASE_ALIGNMENT.scale * transform.scale;
    const positionX = SCENE_BASE_ALIGNMENT.offset.x + transform.offset.x;
    const positionZ = SCENE_BASE_ALIGNMENT.offset.z + transform.offset.z;

    [buildingGroupRef.current, waterGroupRef.current, roadsGroupRef.current].forEach(
      (group) => {
        if (!group) return;
        group.rotation.y = rotation;
        group.scale.set(scale, scale, scale);
        group.position.x = positionX;
        group.position.z = positionZ;
      }
    );
  };

  /**
   * 场景初始化 + Three.js 资源释放。
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let sceneContext;
    let detachBuildingPicking;

    const handleResize = () => sceneContext?.resize();

    try {
      sceneContext = initScene(container);
      logInfo("三维渲染", "Three.js 场景初始化完成");

      // 构建三大 group：建筑 → 水系 → 道路。
      const buildingGroup = buildBuildings(sceneContext.scene);
      const waterGroup = buildWater(sceneContext.scene);
      const roadsGroup = buildRoads(sceneContext.scene);
      buildingGroupRef.current = buildingGroup;
      waterGroupRef.current = waterGroup;
      roadsGroupRef.current = roadsGroup;

      // 根据当前 store 的 layerVisibility 决定初始显隐。
      const currentWaterVisible =
        useSceneStore.getState().layerVisibility?.water ?? true;
      if (waterGroup) waterGroup.visible = currentWaterVisible;

      const currentRoadVisible =
        useSceneStore.getState().layerVisibility?.roads ?? true;
      if (roadsGroup) roadsGroup.visible = currentRoadVisible;

      applySceneTransform(useSceneStore.getState().sceneTransform);
      logInfo("三维渲染", "水系几何构建完成");
      logInfo("三维渲染", "道路几何构建完成");

      // 建筑拾取：hover 写入 store，click 记录日志。
      detachBuildingPicking = attachBuildingPicking({
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

      // 水系拾取：仅日志反馈，不写 store。
      const waterPickingHandle = attachWaterPicking({
        domElement: sceneContext.renderer.domElement,
        camera: sceneContext.camera,
        waterGroup,
        onHover: (info) => {
          hoveredWaterInfoRef.current = info;
        },
        onSelect: (info) => {
          if (!info) return;
          const { stableId, name, waterType } = info;
          logInfo(
            "水系交互",
            `选中 ${name ?? stableId ?? "未命名水体"} (${waterType ?? "未知类型"})`
          );
        },
      });
      waterPickingHandleRef.current = waterPickingHandle;

      // 道路拾取：hover 仅缓存引用，click 输出日志。
      const roadPickingHandle = attachRoadPicking({
        domElement: sceneContext.renderer.domElement,
        camera: sceneContext.camera,
        roadsGroup,
        onHover: (info) => {
          hoveredRoadInfoRef.current = info;
        },
        onSelect: (info) => {
          if (!info) return;
          const { stableId, name, highway } = info;
          logInfo(
            "道路交互",
            `选中 ${name ?? stableId ?? "未知道路"} (${highway ?? "未知等级"})`
          );
        },
      });
      roadPickingHandleRef.current = roadPickingHandle;

      sceneContext.start();
      window.addEventListener("resize", handleResize);
    } catch (error) {
      logError("三维渲染", "Three.js 场景初始化失败", {
        错误: error?.message ?? "未知错误",
      });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      roadPickingHandleRef.current?.clearHover?.();
      roadPickingHandleRef.current?.dispose?.();
      roadPickingHandleRef.current = null;
      waterPickingHandleRef.current?.clearHover?.();
      waterPickingHandleRef.current?.dispose?.();
      waterPickingHandleRef.current = null;
      detachBuildingPicking?.();
      sceneContext?.stop();
      const canvas = sceneContext?.renderer?.domElement;
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
      buildingGroupRef.current = null;
      waterGroupRef.current = null;
      roadsGroupRef.current = null;
    };
  }, []);

  /** 场景姿态随调试面板变化而更新。 */
  useEffect(() => {
    applySceneTransform(sceneTransform);
  }, [sceneTransform]);

  /** 道路显隐同步 store。 */
  useEffect(() => {
    if (roadsGroupRef.current) {
      roadsGroupRef.current.visible = roadsVisible;
    }
    if (!roadsVisible) {
      hoveredRoadInfoRef.current = null;
      roadPickingHandleRef.current?.clearHover?.();
    }
  }, [roadsVisible]);

  /** 水系显隐同步 store。 */
  useEffect(() => {
    if (waterGroupRef.current) {
      waterGroupRef.current.visible = waterVisible;
    }
    if (!waterVisible) {
      hoveredWaterInfoRef.current = null;
      waterPickingHandleRef.current?.clearHover?.();
    }
  }, [waterVisible]);

  return (
    <div className="app-root">
      <div ref={containerRef} className="scene-container" />
      <div className="scene-overlay">
        <h1>西南交通大学犀浦校区</h1>
        <p>场景初始化完成后会自动加载建筑、水系与道路数据。</p>
      </div>
      <DebugPanel />
    </div>
  );
}

export default App;
