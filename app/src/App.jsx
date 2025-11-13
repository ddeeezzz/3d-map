import { useEffect, useRef } from "react";
import "./App.css";
import { initScene } from "./three/initScene";
import { buildBuildings } from "./three/buildBuildings";
import { buildBoundary } from "./three/buildBoundary";
import { buildWater } from "./three/buildWater";
import { buildWaterway } from "./three/buildWaterway";
import { buildRoads } from "./three/buildRoads";
import DebugPanel from "./components/DebugPanel";
import { logInfo, logError } from "./logger/logger";
import { useSceneStore, SCENE_BASE_ALIGNMENT } from "./store/useSceneStore";
import { attachBuildingPicking } from "./three/interactions/buildingPicking";
import { attachWaterPicking } from "./three/interactions/waterPicking";
import { attachRiverPicking } from "./three/interactions/riverPicking";
import { attachRoadPicking } from "./three/interactions/roadPicking";
import { attachBoundaryPicking } from "./three/interactions/boundaryPicking";

function App() {
  const containerRef = useRef(null);
  const buildingGroupRef = useRef(null);
  const boundaryGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const waterwayGroupRef = useRef(null);
  const roadsGroupRef = useRef(null);

  const boundaryPickingHandleRef = useRef(null);
  const roadPickingHandleRef = useRef(null);
  const waterPickingHandleRef = useRef(null);
  const riverPickingHandleRef = useRef(null);

  const hoveredRoadInfoRef = useRef(null);
  const hoveredWaterInfoRef = useRef(null);
  const hoveredRiverInfoRef = useRef(null);

  const sceneTransform = useSceneStore((state) => state.sceneTransform);
  const boundaryVisible = useSceneStore(
    (state) => state.layerVisibility?.boundary ?? true
  );
  const waterVisible = useSceneStore(
    (state) => state.layerVisibility?.water ?? true
  );
  const roadsVisible = useSceneStore(
    (state) => state.layerVisibility?.roads ?? true
  );

  const applySceneTransform = (transform) => {
    const rotation = SCENE_BASE_ALIGNMENT.rotationY + transform.rotationY;
    const scale = SCENE_BASE_ALIGNMENT.scale * transform.scale;
    const positionX = SCENE_BASE_ALIGNMENT.offset.x + transform.offset.x;
    const positionZ = SCENE_BASE_ALIGNMENT.offset.z + transform.offset.z;

    [
      buildingGroupRef.current,
      boundaryGroupRef.current,
      waterGroupRef.current,
      waterwayGroupRef.current,
      roadsGroupRef.current,
    ].forEach((group) => {
      if (!group) return;
      group.rotation.y = rotation;
      group.scale.set(scale, scale, scale);
      group.position.x = positionX;
      group.position.z = positionZ;
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let sceneContext;
    let detachBuildingPicking;

    const handleResize = () => sceneContext?.resize();

    try {
      sceneContext = initScene(container);
      logInfo("三维渲染", "Three.js 场景初始化完成");

      const buildingGroup = buildBuildings(sceneContext.scene);
      const boundaryGroup = buildBoundary(sceneContext.scene);
      const waterGroup = buildWater(sceneContext.scene);
      const waterwayGroup = buildWaterway(sceneContext.scene);
      const roadsGroup = buildRoads(sceneContext.scene);

      buildingGroupRef.current = buildingGroup;
      boundaryGroupRef.current = boundaryGroup;
      waterGroupRef.current = waterGroup;
      waterwayGroupRef.current = waterwayGroup;
      roadsGroupRef.current = roadsGroup;

      const visibility = useSceneStore.getState().layerVisibility;
      const boundaryState = visibility?.boundary ?? true;
      const waterState = visibility?.water ?? true;
      const roadState = visibility?.roads ?? true;
      if (boundaryGroup) boundaryGroup.visible = boundaryState;
      if (waterGroup) waterGroup.visible = waterState;
      if (waterwayGroup) waterwayGroup.visible = waterState;
      if (roadsGroup) roadsGroup.visible = roadState;

      applySceneTransform(useSceneStore.getState().sceneTransform);
      logInfo("三维渲染", "围墙几何构建完成");
      logInfo("三维渲染", "水系几何构建完成");
      logInfo("三维渲染", "道路几何构建完成");

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

      const boundaryPickingHandle = boundaryGroup
        ? attachBoundaryPicking({
            domElement: sceneContext.renderer.domElement,
            camera: sceneContext.camera,
            boundaryGroup,
          })
        : null;
      boundaryPickingHandleRef.current = boundaryPickingHandle;

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

      const riverPickingHandle = attachRiverPicking({
        domElement: sceneContext.renderer.domElement,
        camera: sceneContext.camera,
        riverGroup: waterwayGroup,
        onHover: (info) => {
          hoveredRiverInfoRef.current = info;
        },
        onSelect: (info) => {
          if (!info) return;
          const { stableId, name } = info;
          logInfo("河流交互", `选中 ${name ?? stableId ?? "未知河流"}`);
        },
      });
      riverPickingHandleRef.current = riverPickingHandle;

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
      boundaryPickingHandleRef.current?.clearHover?.();
      boundaryPickingHandleRef.current?.dispose?.();
      boundaryPickingHandleRef.current = null;
      roadPickingHandleRef.current?.clearHover?.();
      roadPickingHandleRef.current?.dispose?.();
      roadPickingHandleRef.current = null;
      waterPickingHandleRef.current?.clearHover?.();
      waterPickingHandleRef.current?.dispose?.();
      waterPickingHandleRef.current = null;
      riverPickingHandleRef.current?.clearHover?.();
      riverPickingHandleRef.current?.dispose?.();
      riverPickingHandleRef.current = null;
      detachBuildingPicking?.();
      sceneContext?.stop();
      const canvas = sceneContext.renderer?.domElement;
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
      buildingGroupRef.current = null;
      boundaryGroupRef.current = null;
      waterGroupRef.current = null;
      waterwayGroupRef.current = null;
      roadsGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    applySceneTransform(sceneTransform);
  }, [sceneTransform]);

  useEffect(() => {
    if (boundaryGroupRef.current) {
      boundaryGroupRef.current.visible = boundaryVisible;
    }
    if (!boundaryVisible) {
      boundaryPickingHandleRef.current?.clearHover?.();
    }
  }, [boundaryVisible]);

  useEffect(() => {
    if (waterGroupRef.current) {
      waterGroupRef.current.visible = waterVisible;
    }
    if (waterwayGroupRef.current) {
      waterwayGroupRef.current.visible = waterVisible;
    }
    if (!waterVisible) {
      hoveredWaterInfoRef.current = null;
      hoveredRiverInfoRef.current = null;
      waterPickingHandleRef.current?.clearHover?.();
      riverPickingHandleRef.current?.clearHover?.();
    }
  }, [waterVisible]);

  useEffect(() => {
    if (roadsGroupRef.current) {
      roadsGroupRef.current.visible = roadsVisible;
    }
    if (!roadsVisible) {
      hoveredRoadInfoRef.current = null;
      roadPickingHandleRef.current?.clearHover?.();
    }
  }, [roadsVisible]);

  return (
    <div className="app-root">
      <div ref={containerRef} className="scene-container" />
      <div className="scene-overlay">
        <h1>西南交通大学犀浦校区</h1>
        <p>场景初始化完成后会自动加载建筑、围墙、水系与道路数据。</p>
      </div>
      <DebugPanel />
    </div>
  );
}

export default App;
