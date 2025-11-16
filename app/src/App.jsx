/**
 * App 组件：校园导航核心容器
 *
 * 职责：
 * 1. 初始化 Three.js 3D 场景（依赖 initScene）
 * 2. 构建建筑、围墙、水系、河流、道路等几何体
 * 3. 绑定建筑/边界/水体/河流/道路的拾取事件
 * 4. 监听 Zustand store，实时同步图层可见性与场景变换
 * 5. 负责清理事件监听、Three.js 资源与辅助引用
 *
 * 依赖关系：
 * - three/* 模块：几何构建与交互逻辑
 * - store/useSceneStore：全局状态管理（变换、可见性、选中对象等）
 * - logger：日志输出（初始化阶段和交互反馈）
 * - DebugPanel：开发环境的调试面板
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./App.css";
import { initScene } from "./three/initScene";
import { buildBuildings } from "./three/buildBuildings";
import { buildBoundary } from "./three/buildBoundary";
import { buildWater } from "./three/buildWater";
import { buildWaterway } from "./three/buildWaterway";
import { buildGreenery } from "./three/buildGreenery";
import { buildRoads } from "./three/buildRoads";
import { buildSites } from "./three/buildSites";
import { buildPois } from "./three/buildPois";
import { buildRouteOverlay } from "./three/buildRouteOverlay";
import DebugPanel from "./components/DebugPanel";
/**
 * LibraryGuidePanel：左侧图书馆指南面板入口，负责展示图书馆服务信息
 */
import LibraryGuidePanel from "./components/LibraryGuidePanel";
/**
 * GymnasiumGuidePanel：左侧体育馆指南面板入口，承载体育馆使用指引
 */
import GymnasiumGuidePanel from "./components/GymnasiumGuidePanel";
import { logInfo, logError } from "./logger/logger";
import { useSceneStore, SCENE_BASE_ALIGNMENT } from "./store/useSceneStore";
import { solveRouteBetweenPoints } from "./lib/roadGraph";
import { findPoiByName } from "./lib/poiIndex";
import { attachBuildingPicking } from "./three/interactions/buildingPicking";
import { attachWaterPicking } from "./three/interactions/waterPicking";
import { attachRiverPicking } from "./three/interactions/riverPicking";
import { attachRoadPicking } from "./three/interactions/roadPicking";
import { attachBoundaryPicking } from "./three/interactions/boundaryPicking";
import { attachSitePicking } from "./three/interactions/sitePicking";
import config from "./config/index.js";

function App() {
  /**
   * containerRef：Three.js 渲染容器 DOM 节点引用
   * 用途：作为场景初始化时的挂载目标
  */
  const containerRef = useRef(null);
  // 缓存 initScene 返回的上下文，便于响应环境参数变化
  const sceneContextRef = useRef(null);

  /**
   * 各类几何体 Group 引用，便于后续可见性切换和变换应用
   * - buildingGroupRef：所有建筑物的 Three.js Group
   * - boundaryGroupRef：校园围墙的 Group
   * - waterGroupRef：水体（湖泊等）的 Group
   * - waterwayGroupRef：河流等线性水系的 Group
   * - roadsGroupRef：道路网络的 Group
   */
  const buildingGroupRef = useRef(null);
  const boundaryGroupRef = useRef(null);
  const waterGroupRef = useRef(null);
  const waterwayGroupRef = useRef(null);
  const greeneryGroupRef = useRef(null);
  const roadsGroupRef = useRef(null);
  const sitesGroupRef = useRef(null);
  const poisGroupRef = useRef(null);
  const poiScaleListenerRef = useRef(null);
  const routeOverlayRef = useRef(null);
  const routeDebugGroupRef = useRef(null);

  /**
   * 交互拾取事件处理器的清理函数或实例引用
   * 用途：在组件卸载时释放事件监听器和 GPU 资源
   * - boundaryPickingHandleRef：边界拾取的句柄（支持 clearHover/dispose）
   * - roadPickingHandleRef：道路拾取句柄
   * - waterPickingHandleRef：水体拾取句柄
   * - riverPickingHandleRef：河流拾取句柄
   */
  const boundaryPickingHandleRef = useRef(null);
  const roadPickingHandleRef = useRef(null);
  const waterPickingHandleRef = useRef(null);
  const riverPickingHandleRef = useRef(null);
  // site 图层拾取句柄，负责 hover/click 清理
  const sitePickingHandleRef = useRef(null);

  /**
   * Hover 状态临时存储（用于交互反馈）
   * 这些引用不触发 state 更新，仅用于存储当前 Hover 对象的信息以供查询
   */
  const hoveredRoadInfoRef = useRef(null);
  const hoveredWaterInfoRef = useRef(null);
  const hoveredRiverInfoRef = useRef(null);

  /**
   * disposeThreeObject：递归释放 Three.js 几何体与材质，避免调试折线或光带残留
   * 参数：object - 需要释放的 Object3D
   * 返回：无
   */
  const disposeThreeObject = (object) => {
    if (!object) {
      return;
    }
    if (object.geometry?.dispose) {
      object.geometry.dispose();
    }
    if (Array.isArray(object.material)) {
      object.material.forEach((mat) => mat?.dispose?.());
    } else if (object.material?.dispose) {
      object.material.dispose();
    }
    if (Array.isArray(object.children) && object.children.length > 0) {
      object.children.forEach((child) => disposeThreeObject(child));
    }
  };

  /**
   * removeRouteDebug：清除路线调试折线 Group
   * 场景同步：从所属父节点移除并释放全部子级资源
   */
  const removeRouteDebug = () => {
    if (!routeDebugGroupRef.current) {
      return;
    }
    routeDebugGroupRef.current.children.forEach((child) =>
      disposeThreeObject(child)
    );
    routeDebugGroupRef.current.clear?.();
    routeDebugGroupRef.current.parent?.remove(routeDebugGroupRef.current);
    routeDebugGroupRef.current = null;
  };

  /**
   * drawRouteDebug：根据 pointPath 构建调试折线
   * 参数：pointPath - 包含 worldX/worldZ 的数组，用于验证路线对齐
   */
  const drawRouteDebug = (pointPath = []) => {
    removeRouteDebug();
    if (!Array.isArray(pointPath) || pointPath.length < 2) {
      return;
    }
    const host = roadsGroupRef.current || sceneContextRef.current?.scene;
    if (!host) {
      return;
    }
    const debugGroup = new THREE.Group();
    debugGroup.name = "routeDebug";
    for (let i = 0; i < pointPath.length - 1; i += 1) {
      const current = pointPath[i];
      const next = pointPath[i + 1];
      if (
        !Number.isFinite(current?.worldX) ||
        !Number.isFinite(current?.worldZ) ||
        !Number.isFinite(next?.worldX) ||
        !Number.isFinite(next?.worldZ)
      ) {
        continue;
      }
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(current.worldX, 0.2, current.worldZ),
        new THREE.Vector3(next.worldX, 0.2, next.worldZ),
      ]);
      const material = new THREE.LineBasicMaterial({ color: 0xfe624c });
      const line = new THREE.Line(geometry, material);
      debugGroup.add(line);
    }
    if (debugGroup.children.length === 0) {
      disposeThreeObject(debugGroup);
      return;
    }
    host.add(debugGroup);
    routeDebugGroupRef.current = debugGroup;
  };

  /**
   * 从 Zustand store 读取全局状态
   * - sceneTransform：调试面板调整的场景变换增量（旋转/缩放/偏移）
   * - boundaryVisible/waterVisible/roadsVisible：图层可见性状态，默认 true
   * 
   * 注意：这些状态变化会触发对应 useEffect 重新执行
   */
  const sceneTransform = useSceneStore((state) => state.sceneTransform);
  const boundaryVisible = useSceneStore(
    (state) => state.layerVisibility?.boundary ?? true
  );
const waterVisible = useSceneStore(
  (state) => state.layerVisibility?.water ?? true
);
const greeneryVisible = useSceneStore(
  (state) => state.layerVisibility?.greenery ?? true
);
const roadsVisible = useSceneStore(
  (state) => state.layerVisibility?.roads ?? true
);
const sitesVisible = useSceneStore(
  (state) => state.layerVisibility?.sites ?? true
);
const poisVisible = useSceneStore(
  (state) => state.poiLayerVisible ?? state.layerVisibility?.pois ?? true
);
const highlightedRoutePath = useSceneStore(
  (state) => state.highlightedRoutePath
);
const highlightedRouteMeta = useSceneStore(
  (state) => state.highlightedRouteMeta
);
  const environmentSettings = useSceneStore(
    (state) => state.environmentSettings
  );
  useEffect(() => {
    useSceneStore.getState().markRoadGraphReady?.();
  }, []);


  /**
   * applySceneTransform：应用场景变换到所有几何体 Group
   * 
   * 参数：transform - { rotationY, scale, offset: { x, z } } 格式的增量变换
   * 
   * 逻辑：
   * 1. 将调试面板的增量变换与基准姿态叠加（SCENE_BASE_ALIGNMENT）
   * 2. 同步应用到所有 Group：绕 Y 轴旋转、按 XYZ 缩放、沿 X/Z 平移
   * 3. 确保所有几何体保持一致的空间关系
   * 
   * 副作用：修改各 Group 引用的 rotation、scale、position 属性
   */
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
      greeneryGroupRef.current,
      roadsGroupRef.current,
      sitesGroupRef.current,
      poisGroupRef.current,
    ].forEach((group) => {
      if (!group) return;
      group.rotation.y = rotation;
      group.scale.set(scale, scale, scale);
      group.position.x = positionX;
      group.position.z = positionZ;
    });
  };

  /**
   * 主初始化 Effect：创建场景、构建几何体并绑定交互
   * 
   * 执行时机：组件挂载时（依赖数组为空）
   * 
   * 流程：
   * 1. 创建 Three.js 场景、相机、渲染器（initScene）
   * 2. 构建建筑、围墙、水体、河流、道路、绿化等几何体
   * 3. 应用初始可见性状态（从 store 读取）
   * 4. 应用初始变换（基准姿态）
   * 5. 绑定五种拾取交互（建筑、边界、水体、河流、道路）
   * 6. 启动渲染循环（sceneContext.start()）
   * 7. 监听窗口 resize 事件
   * 
   * 错误处理：catch 块捕获初始化异常并记录日志
   * 
   * 清理：返回清理函数，移除事件监听、释放拾取句柄、停止渲染、清理 DOM
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let sceneContext;
    let detachBuildingPicking;
    let disposed = false;

    // 窗口 resize 时重新计算相机和渲染器尺寸
    const handleResize = () => sceneContext?.resize();

    const setupScene = async () => {
      try {
        const initialEnvironment =
          useSceneStore.getState().environmentSettings;
        sceneContext = initScene(container, {
          environment: initialEnvironment,
        });
        sceneContextRef.current = sceneContext;
        if (typeof window !== "undefined") {
          window.sceneContext = sceneContext;
          window.THREE = THREE;
        }

        await sceneContext.environmentReady;
        if (disposed) {
          sceneContext.disposeEnvironment?.();
          return;
        }

        // 创建 Three.js 场景基础设施：渲染器、相机、光源等
        logInfo("三维渲染", "Three.js 场景初始化完成");

        // 构建各类几何体并获得对应的 Group 引用
        const buildingGroup = buildBuildings(sceneContext.scene);
        const boundaryGroup = buildBoundary(sceneContext.scene);
        const waterGroup = buildWater(sceneContext.scene);
        const waterwayGroup = buildWaterway(sceneContext.scene);
        const greeneryGroup = buildGreenery(sceneContext.scene);
        const roadsGroup = buildRoads(sceneContext.scene);
        const routeOverlay = buildRouteOverlay(roadsGroup);
        const sitesGroup = buildSites(sceneContext.scene);
        const poiLayer = buildPois(sceneContext.scene);
        const poiGroup = poiLayer?.group ?? poiLayer;

        buildingGroupRef.current = buildingGroup;
        boundaryGroupRef.current = boundaryGroup;
        waterGroupRef.current = waterGroup;
        waterwayGroupRef.current = waterwayGroup;
        greeneryGroupRef.current = greeneryGroup;
        roadsGroupRef.current = roadsGroup;
        routeOverlayRef.current = routeOverlay;
        sitesGroupRef.current = sitesGroup;
        poisGroupRef.current = poiGroup;

        // 初始化各图层可见性：从 store 读取状态，默认全部 true
        const visibility = useSceneStore.getState().layerVisibility;
        const boundaryState = visibility?.boundary ?? true;
        const waterState = visibility?.water ?? true;
        const greeneryState = visibility?.greenery ?? true;
        const roadState = visibility?.roads ?? true;
        const siteState = visibility?.sites ?? true;
        const poiState =
          visibility?.pois ??
          useSceneStore.getState().poiLayerVisible ??
          true;
        if (boundaryGroup) boundaryGroup.visible = boundaryState;
        if (waterGroup) waterGroup.visible = waterState;
        if (waterwayGroup) waterwayGroup.visible = waterState;
        if (greeneryGroup) greeneryGroup.visible = greeneryState;
        if (roadsGroup) roadsGroup.visible = roadState;
        if (sitesGroup) sitesGroup.visible = siteState;
        if (poiGroup) poiGroup.visible = poiState;

        // 应用基准姿态和任何初始增量变换（通常为零）
        applySceneTransform(useSceneStore.getState().sceneTransform);
        logInfo("三维渲染", "围墙几何构建完成");
        logInfo("三维渲染", "水系几何构建完成");
        logInfo("三维渲染", "绿化几何构建完成");
        logInfo("三维渲染", "道路几何构建完成");
        logInfo("三维渲染", "场地几何构建完成");
        logInfo("三维渲染", "POI 图层构建完成", {
          总数: poiLayer?.stats?.total ?? poiGroup?.children?.length ?? 0,
          独立: poiLayer?.stats?.independent ?? 0,
        });

        if (poiLayer?.updateLabelScale && sceneContext.controls) {
          const handleControlChange = () =>
            poiLayer.updateLabelScale(sceneContext.camera);
          poiScaleListenerRef.current = handleControlChange;
          sceneContext.controls.addEventListener(
            "change",
            handleControlChange
          );
          handleControlChange();
        }

        if (typeof useSceneStore.getState().updatePoiStatistics === "function") {
          useSceneStore
            .getState()
            .updatePoiStatistics(
              poiLayer?.stats ?? {
                total: poiGroup?.children?.length ?? 0,
                independent: poiLayer?.stats?.independent ?? 0,
              }
            );
        }

        /**
         * 绑定建筑拾取交互：支持 Hover（高亮）与 Click（选中）
         * onHover：更新 store 中的悬停建筑信息
         * onSelect：更新 store 中的选中建筑 ID，并记录日志
         */
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
            logInfo("建筑交互", `选中 ${name ?? stableId ?? "未知建筑"}`);
          },
        });

        /**
         * 绑定边界（围墙）拾取交互
         * 主要用于显示边界信息，支持 Hover 效果
         */
        const boundaryPickingHandle = boundaryGroup
          ? attachBoundaryPicking({
              domElement: sceneContext.renderer.domElement,
              camera: sceneContext.camera,
              boundaryGroup,
            })
          : null;
        boundaryPickingHandleRef.current = boundaryPickingHandle;

        /**
         * 绑定水体拾取交互：支持 Hover 与 Click
         * onHover：存储到 hoveredWaterInfoRef 以备查询
         * onSelect：记录选中的水体信息
         */
        // const waterPickingHandle = attachWaterPicking({
        //   domElement: sceneContext.renderer.domElement,
        //   camera: sceneContext.camera,
        //   waterGroup,
        //   onHover: (info) => {
        //     hoveredWaterInfoRef.current = info;
        //   },
        //   onSelect: (info) => {
        //     if (!info) return;
        //     const { stableId, name, waterType } = info;
        //     logInfo(
        //       "水系交互",
        //       选中  ()
        //     );
        //   },
        // });
        // waterPickingHandleRef.current = waterPickingHandle;

        /**
         * 绑定河流拾取交互：针对 waterway 线性要素
         * 逻辑同水体，但专门处理河流数据
         */
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

        /**
         * 绑定道路拾取交互：支持 Hover 与 Click
         * onHover：存储到 hoveredRoadInfoRef 以备查询
         * onSelect：记录选中的道路信息及其等级
         */
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

        const sitePickingHandle = sitesGroup
          ? attachSitePicking({
              domElement: sceneContext.renderer.domElement,
              camera: sceneContext.camera,
              sitesGroup,
              onHover: (info) => {
                useSceneStore.getState().setHoveredSite(info);
              },
              onSelect: (info) => {
                if (!info) return;
                const { stableId, displayName, siteCategory } = info;
                if (stableId) {
                  useSceneStore.getState().setSelectedSite(stableId);
                }
                logInfo(
                  "场地交互",
                  选中  ()
                );
              },
            })
          : null;
        sitePickingHandleRef.current = sitePickingHandle;

        // 启动主渲染循环
        sceneContext.start();
        // 监听窗口大小改变事件
        window.addEventListener("resize", handleResize);
      } catch (error) {
        // 初始化失败时记录错误信息
        logError("三维渲染", "Three.js 场景初始化失败", {
          错误: error?.message ?? "未知错误",
        });
      }
    };

    setupScene();

    /**
     * 清理函数：在组件卸载或重新初始化时执行
     * 职责：释放所有事件监听、拾取句柄与渲染资源
     */
    return () => {
      disposed = true;
      // 移除窗口 resize 监听
      window.removeEventListener("resize", handleResize);
      
      // 逐个清理各拾取交互句柄：清除 Hover 状态并释放 GPU 资源
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
      
      sitePickingHandleRef.current?.clearHover?.();
      sitePickingHandleRef.current?.dispose?.();
      sitePickingHandleRef.current = null;

      if (poiScaleListenerRef.current && sceneContext?.controls) {
        sceneContext.controls.removeEventListener(
          "change",
          poiScaleListenerRef.current
        );
      }
      poiScaleListenerRef.current = null;

      // 清理建筑拾取交互
      detachBuildingPicking?.();
      
      // 停止渲染循环并释放天空盒资源
      sceneContext?.disposeEnvironment?.();
      sceneContext?.stop();
      
      // 从 DOM 中移除 canvas 元素
      const canvas = sceneContext.renderer?.domElement;
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
      
      sceneContextRef.current = null;

      // 清空所有 Group 引用
      buildingGroupRef.current = null;
      boundaryGroupRef.current = null;
      waterGroupRef.current = null;
      waterwayGroupRef.current = null;
      greeneryGroupRef.current = null;
      roadsGroupRef.current = null;
      routeOverlayRef.current?.clearRouteOverlay?.();
      routeOverlayRef.current = null;
      removeRouteDebug();
      sitesGroupRef.current = null;
      poisGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const highlightRoute = (fromName, toName) => {
      const trimmedFrom = (fromName ?? "").trim();
      const trimmedTo = (toName ?? "").trim();
      if (!trimmedFrom || !trimmedTo) {
        console.warn("[路线规划] 请输入完整的起点与终点 POI 名称");
        return;
      }
      const poiA = findPoiByName(trimmedFrom);
      if (!poiA) {
        logError("路线规划", "未找到 POI：" + trimmedFrom);
        return;
      }
      const poiB = findPoiByName(trimmedTo);
      if (!poiB) {
        logError("路线规划", "未找到 POI：" + trimmedTo);
        return;
      }
      try {
        const path = solveRouteBetweenPoints(poiA, poiB);
        const length = Number((path.totalLength ?? 0).toFixed(2));
        const routeMeta = config.poiRoute?.highlightMesh
          ? { ...config.poiRoute.highlightMesh }
          : null;
        useSceneStore.getState().setHighlightedRoads(path.roadIds);
        useSceneStore.getState().setHighlightedRouteMeta(routeMeta);
        useSceneStore.getState().setHighlightedRoutePath(path.pointPath || []);
        useSceneStore.getState().setActiveRoute({
          from: trimmedFrom,
          to: trimmedTo,
          length,
        });
        drawRouteDebug(path.pointPath || []);
        logInfo("路线规划", "路径渲染完成", {
          from: trimmedFrom,
          to: trimmedTo,
          length,
          roadIds: path.roadIds,
          nodes: path.pointPath?.length ?? 0,
        });
        console.info("[路线规划]", {
          from: trimmedFrom,
          to: trimmedTo,
          length,
          roadIds: path.roadIds,
          nodePath: path.nodePath,
          pointPath: path.pointPath,
        });
        return path;
      } catch (error) {
        logError("路线规划", String(error?.message ?? error), {
          from: trimmedFrom,
          to: trimmedTo,
        });
        throw error;
      }
    };
    const clearRoute = () => {
      useSceneStore.getState().setHighlightedRoads([]);
      useSceneStore.getState().setHighlightedRoutePath([]);
      useSceneStore.getState().setHighlightedRouteMeta(null);
      useSceneStore.getState().setActiveRoute(null);
      routeOverlayRef.current?.clearRouteOverlay();
      removeRouteDebug();
      logInfo("路线规划", "已清除路径高亮");
    };
    window.highlightRouteByPoiNames = highlightRoute;
    window.clearRouteHighlight = clearRoute;
    return () => {
      delete window.highlightRouteByPoiNames;
      delete window.clearRouteHighlight;
    };
  }, []);

  useEffect(() => {
    if (!routeOverlayRef.current) {
      return;
    }
    if (!Array.isArray(highlightedRoutePath) || highlightedRoutePath.length < 2) {
      routeOverlayRef.current.clearRouteOverlay();
      return;
    }
    const baseOptions = config.poiRoute?.highlightMesh;
    const renderOptions =
      highlightedRouteMeta && Object.keys(highlightedRouteMeta).length > 0
        ? highlightedRouteMeta
        : baseOptions;
    routeOverlayRef.current.renderRouteOverlay(
      highlightedRoutePath,
      renderOptions
    );
  }, [highlightedRoutePath, highlightedRouteMeta]);



  /**
   * 监听调试面板的场景变换变化
   * 依赖 sceneTransform，每次其内容改变时重新应用变换到所有 Group
   */
  useEffect(() => {
    applySceneTransform(sceneTransform);
  }, [sceneTransform]);

  /**
   * 监听天空盒参数变化：实时更新 Three.js 场景背景与环境贴图
   */
  useEffect(() => {
    if (!sceneContextRef.current?.applyEnvironmentSettings) {
      return;
    }
    sceneContextRef.current.applyEnvironmentSettings(environmentSettings);
  }, [environmentSettings]);

  /**
   * 监听边界可见性变化
   * 当 boundaryVisible 改变时，同步 Group 的 visible 属性
   * 若隐藏，则清除 Hover 状态以避免遮挡提示出现
   */
  useEffect(() => {
    if (boundaryGroupRef.current) {
      boundaryGroupRef.current.visible = boundaryVisible;
    }
    if (!boundaryVisible) {
      boundaryPickingHandleRef.current?.clearHover?.();
    }
  }, [boundaryVisible]);

  /**
   * 监听水系可见性变化（包含水体和河流）
   * 当 waterVisible 改变时，同时控制 waterGroup 与 waterwayGroup 的可见性
   * 若隐藏，清除所有水系相关的 Hover 状态
   */
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

  /**
   * 监听绿化图层可见性
   */
  useEffect(() => {
    if (greeneryGroupRef.current) {
      greeneryGroupRef.current.visible = greeneryVisible;
    }
  }, [greeneryVisible]);

  /**
   * 监听道路可见性变化
   * 当 roadsVisible 改变时，同步 Group 的 visible 属性
   * 若隐藏，清除 Hover 状态
   */
  useEffect(() => {
    if (roadsGroupRef.current) {
      roadsGroupRef.current.visible = roadsVisible;
    }
    if (!roadsVisible) {
      hoveredRoadInfoRef.current = null;
      roadPickingHandleRef.current?.clearHover?.();
    }
  }, [roadsVisible]);

  /**
   * 监听场地图层可见性
   */
  useEffect(() => {
    if (sitesGroupRef.current) {
      sitesGroupRef.current.visible = sitesVisible;
    }
    if (!sitesVisible) {
      sitePickingHandleRef.current?.clearHover?.();
      useSceneStore.getState().setHoveredSite(null);
    }
  }, [sitesVisible]);

  /**
   * 监听 POI 图层可见性变化
   */
  useEffect(() => {
    if (poisGroupRef.current) {
      poisGroupRef.current.visible = poisVisible;
    }
  }, [poisVisible]);

  return (
    <div className="app-root">
      {/* Three.js 渲染容器，canvas 将挂载到此处 */}
      <div ref={containerRef} className="scene-container" />
      
      {/* 固定位置的场景标题和说明文字 */}
      <div className="scene-overlay">
        <h1>西南交通大学犀浦校区</h1>
        <p>场景初始化完成后会自动加载建筑、围墙、水系与道路数据</p>
      </div>
      
      {/* 图书馆使用指南面板 */}
      <LibraryGuidePanel />

      {/* 体育馆使用指南面板 */}
      <GymnasiumGuidePanel />

      {/* 调试面板：在开发环境中允许手动调整场景变换参数 */}
      <DebugPanel />
    </div>
  );
}

export default App;




