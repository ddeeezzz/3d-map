/**
 * 全局状态管理模块（Zustand）
 * 
 * 职责：
 * 集中管理校园导航场景的全局状态，包括选中对象、路线、图层可见性和场景变换
 * 所有状态变化自动触发 React 组件重新渲染（订阅者更新）
 * 
 * 依赖关系：
 * - App.jsx：监听 sceneTransform、boundaryVisible、waterVisible、roadsVisible 等
 * - DebugPanel.jsx：控制和显示 sceneTransform
 * - 各交互模块：通过 store setter 更新选中和悬停状态
 */

import { create } from "zustand";
// 导入全局配置以便获取环境贴图等默认参数
import config from "../config";

const DEFAULT_POI_VISIBLE =
  (config.layers || []).find((layer) => layer?.key === "pois")?.visible ?? true;

/**
 * MAX_LOG_PREVIEW：日志预览列表的最大长度
 * 单位：条数
 * 用途：在调试面板显示最近的日志，避免内存溢出和渲染过多文本
 * 当超过此数量时，自动移除最旧的日志
 */
const MAX_LOG_PREVIEW = 50;

/**
 * BASE_ROTATION：校园的基准旋转角度
 * 单位：弧度（rad）
 * 数值：54° = 54 * π / 180 ≈ 0.9425 rad
 * 背景：在 OSM 数据清洗阶段，为了方便网页查看校园俯视图，
 *      已经将所有坐标旋转了 54°
 * 用途：在 Three.js 中与调试面板的增量旋转相加，得到最终旋转角度
 * 
 * 说明：
 * - 此值在 App.jsx 的 applySceneTransform 中与 transform.rotationY 相加
 * - 调试面板只负责在此基础上进行微调，而不是从 0 开始设置
 */
const BASE_ROTATION = (54 * Math.PI) / 180;

/**
 * SCENE_BASE_ALIGNMENT：Three.js 应用时的基准姿态（final state）
 * 
 * 结构：{ rotationY, scale, offset: { x, z } }
 * 
 * 字段说明：
 * - rotationY：基准旋转角度（弧度），通常 = BASE_ROTATION
 * - scale：基准缩放因子，1.0 ≈ 1 米/单位
 * - offset：基准平移偏移（米），用于调整校园的位置
 *   - x：东西方向偏移，负值表示向西
 *   - z：南北方向偏移，负值表示向南
 * 
 * 数据来源：
 * - offset 中的 x = -500, z = -141 是在数据清洗时通过量测得到的
 * - 表示将校园中心平移到 Three.js 世界坐标原点附近的所需偏移
 * 
 * 冻结原因：使用 Object.freeze() 防止意外修改，确保不变性
 * 
 * 使用场景：App.jsx 的 applySceneTransform 函数会将此值与调试面板的增量相加
 */
// Three.js 应用时的基准姿态（旋转/缩放/偏移），调试面板只负责在此基础上叠加增量
export const SCENE_BASE_ALIGNMENT = Object.freeze({
  rotationY: BASE_ROTATION, // 54° 旋转，方便网页查看
  scale: 1, // 默认单位 1 ≈ 1 米
  offset: Object.freeze({ x: -500, z: -141 }), // 清洗时量测得到的中心偏移
});

/**
 * getInitialSceneTransform：生成调试面板的初始增量变换
 * 
 * 返回值：{ rotationY: 0, scale: 1, offset: { x: 0, z: 0 } }
 * 
 * 说明：
 * - 所有值为零表示"不额外校正"，应用时会与 SCENE_BASE_ALIGNMENT 叠加
 * - 调试面板以此为起点，用户调整会改变这些增量值
 * - 重置操作（Reset 按钮）会恢复到此初始值
 * 
 * 独立函数的好处：
 * - 避免在多个地方硬编码初始值
 * - getInitialData 中也会使用此函数
 */
// 调试面板的初始值：全零表示"不额外校正"
const getInitialSceneTransform = () => ({
  rotationY: 0,
  scale: 1,
  offset: { x: 0, z: 0 },
});

/**
 * getInitialEnvironmentSettings：生成天空盒/环境贴图的初始配置
 *
 * 返回结构：{ enabled, skybox, exposure, toneMapping }
 *
 * 说明：
 * - 直接拷贝 config.environment，避免组件之间共享引用
 * - 如果配置缺省，使用兜底值（true + 1 + "ACESFilmic"）
 */
const getInitialEnvironmentSettings = () => ({
  enabled: config.environment?.enabled ?? true,
  skybox:
    config.environment?.skybox ?? "citrus_orchard_road_puresky_4k.hdr",
  exposure: config.environment?.exposure ?? 1,
  toneMapping: config.environment?.toneMapping ?? "ACESFilmic",
});

/**
 * getInitialData：集中定义 store 的所有初始状态
 * 
 * 返回值：包含以下字段的对象
 * - selectedBuilding: null | string/ID，当前选中的建筑
 * - hoveredBuilding: null | { info }，当前悬停的建筑信息
 * - route: null | { ... }，当前规划的路线
 * - layerVisibility: {}，图层可见性字典（key: visible）
 * - logsPreview: []，最近的日志预览列表
 * - sceneTransform: 调试面板的增量变换
 * 
 * 用途：
 * 1. 初始化 store 时使用
 * 2. resetStore() 时恢复到此状态
 * 
 * 好处：避免状态定义散落在 create() 回调中，便于维护和重置
 */
// 将所有字段初始值集中管理，resetStore 时直接复用
const getInitialData = () => ({
  selectedBuilding: null,
  hoveredBuilding: null,
  selectedSite: null,
  hoveredSite: null,
  route: null,
  layerVisibility: {},
  poiLayerVisible: DEFAULT_POI_VISIBLE,
  poiStatistics: {
    total: 0,
    independent: 0,
  },
  logsPreview: [],
  sceneTransform: getInitialSceneTransform(),
  environmentSettings: getInitialEnvironmentSettings(),
  highlightedRoadIds: [],
  highlightedRoutePath: [],
  highlightedRouteMeta: null,
  activeRoute: null,
  roadGraphReady: false,
  highlightedLocationIds: new Set(),
  highlightedModelIds: new Map(),
  guidePanelsVisible: {},
});

/**
 * useSceneStore：Zustand 创建的全局状态管理 hook
 * 
 * 用法：
 * 1. 读取状态：useSceneStore((state) => state.fieldName)
 * 2. 执行操作：useSceneStore.getState().actionName(...)
 * 3. 订阅变化：useSceneStore.subscribe((state) => { ... })
 * 
 * 状态字段及操作方法说明详见下方
 */
// useSceneStore：集中暴露校园导航需要的状态与 setter
export const useSceneStore = create((set) => ({
  ...getInitialData(),

  /**
   * setSelectedBuilding：更新选中的建筑 ID
   * 参数：id - 建筑的唯一标识符（字符串）
   * 触发者：用户点击建筑或导航面板中的建筑列表项
   * 副作用：React 组件订阅此状态会重新渲染，可能更新信息卡片
   * 
   * 例：setSelectedBuilding("BLDG_001")
   */
  // 由导航面板或地图点击写入选中建筑 ID
  setSelectedBuilding: (id) => set({ selectedBuilding: id }),

  /**
   * setHoveredBuilding：更新悬停的建筑信息
   * 参数：info - 建筑信息对象或 null（移开时）
   * 触发者：鼠标进入/离开建筑时由 buildingPicking.js 调用
   * 副作用：可能显示/隐藏 Tooltip，改变建筑高亮
   * 
   * 例：setHoveredBuilding({ stableId: "BLDG_001", name: "教学楼 A" })
   */
  // Hover 建筑 ID（用于 tooltip/高亮）
  setHoveredBuilding: (info) => set({ hoveredBuilding: info }),

  /**
   * setSelectedSite���������õ�ǰѡ�еĳ��� ID
   * ������id - �ȶ� stableId ���� null����ʾ��ѡ
   * �����ߣ�site ʰȡ���Ӻ͵�ͼ������к���Ҫ��
   * �����ã�ʹ UI/ͼ��ģ���Ե�λ��Ӧ�ĳ���
   *
   * ����setSelectedSite("SITE_TRACK_01")
   */
  setSelectedSite: (id) => set({ selectedSite: id }),

  /**
   * setHoveredSite��������ͣ�ĳ�����Ϣ
   * ������info - ��ҵ������� null �����ƿ�
   * �����ߣ�site ʰȡ pointermove �¼�
   * �����ã�Ϊ Tooltip �� InfoCard �ṩ��ǰ������Ϣ
   *
   * ����setHoveredSite({ stableId: "SITE-01", displayName: "��������" })
   */
  setHoveredSite: (info) => set({ hoveredSite: info }),

  /**
   * setRoute：设置当前规划的路线
   * 参数：route - 路线数据对象（含起点、终点、路径等）或 null
   * 触发者：路径规划模块（未来实现）
   * 副作用：地图上显示路线，可能高亮相关道路或建筑
   * 
   * 数据结构示例：
   * {
   *   from: { buildingId: "BLDG_001", name: "教学楼 A" },
   *   to: { buildingId: "BLDG_002", name: "图书馆" },
   *   distance: 1234.5,  // 米
   *   waypoints: [[x1, y1], [x2, y2], ...],  // 路径点序列
   * }
   */
  // 由路径规划模块写入当前路线数据
  setRoute: (route) => set({ route }),

  /**
   * setHighlightedRoads：更新当前高亮的道路 ID 列表
   * 参数：roadIds - string[]，需要高亮的道路 stableId 集合
   */
  setHighlightedRoads: (roadIds) => set({ highlightedRoadIds: roadIds || [] }),

  /**
   * setHighlightedLocations：记录当前需要高亮的 POI 集合
   * 参数：poiIds - string[]，地点 ID；modelRefs - Map/Object/Array，可选的实体映射
   */
  setHighlightedLocations: (poiIds = [], modelRefs = null) =>
    set(() => {
      const locationSet = new Set(Array.isArray(poiIds) ? poiIds : []);
      const modelMap = new Map();
      if (modelRefs instanceof Map) {
        modelRefs.forEach((value, key) => {
          if (key) {
            modelMap.set(key, value);
          }
        });
      } else if (Array.isArray(modelRefs)) {
        modelRefs.forEach((entry) => {
          if (entry?.poiId) {
            modelMap.set(entry.poiId, {
              type: entry.type,
              id: entry.id,
            });
          }
        });
      } else if (modelRefs && typeof modelRefs === "object") {
        Object.entries(modelRefs).forEach(([key, value]) => {
          if (key) {
            modelMap.set(key, value);
          }
        });
      }
      return {
        highlightedLocationIds: locationSet,
        highlightedModelIds: modelMap,
      };
    }),

  /**
   * clearHighlightedLocations：清空地点和模型高亮状态
   */
  clearHighlightedLocations: () =>
    set(() => ({
      highlightedLocationIds: new Set(),
      highlightedModelIds: new Map(),
    })),

  /**
   * setGuidePanelVisible：控制指南面板开关（如图书馆/体育馆）
   * 参数：key - 面板标识；visible - 布尔值
   */
  setGuidePanelVisible: (key, visible) =>
    set((state) => ({
      guidePanelsVisible: {
        ...state.guidePanelsVisible,
        [key]: Boolean(visible),
      },
    })),

  /**
   * setHighlightedRoutePath：记录当前路线节点序列
   * 参数：path - pointPath 数组
   */
  setHighlightedRoutePath: (path) =>
    set({
      highlightedRoutePath: Array.isArray(path) ? path : [],
    }),

  /**
   * setHighlightedRouteMeta：记录当前光带渲染参数
   */
  setHighlightedRouteMeta: (meta) =>
    set({
      highlightedRouteMeta: meta || null,
    }),

  /**
   * setActiveRoute：记录当前路线信息（{ from, to, length }）
   */
  setActiveRoute: (routeInfo) => set({ activeRoute: routeInfo || null }),

  /**
   * markRoadGraphReady：标记路网数据已加载
   */
  markRoadGraphReady: () => set({ roadGraphReady: true }),

  /**
   * toggleLayerVisibility：切换指定图层的可见性
   * 参数：layerKey - 图层标识符（如 "buildings", "boundary", "water", "roads"）
   * 逻辑：若当前为 false，改为 true；反之亦然
   *      若该键不存在，视为 false → true（显示）
   * 触发者：UI 图层面板中的切换按钮
   * 
   * 例：toggleLayerVisibility("boundary")
   *    原 layerVisibility.boundary = true → 改为 false（隐藏边界）
   * 
   * 副作用：App.jsx 中的 useEffect 会监听此变化，同步 Three.js Group 的 visible 属性
   */
  // 切换图层可见性；若不存在则视为 false → true
  toggleLayerVisibility: (layerKey) =>
    set((state) => {
      const currentValue = Object.prototype.hasOwnProperty.call(
        state.layerVisibility,
        layerKey
      )
        ? state.layerVisibility[layerKey]
        : false;
      const nextValue = !currentValue;
      const layerVisibility = {
        ...state.layerVisibility,
        [layerKey]: nextValue,
      };
      return {
        layerVisibility,
        ...(layerKey === "pois" ? { poiLayerVisible: nextValue } : null),
      };
    }),

  /**
   * setLayerVisibility：直接设置某图层的布尔值
   * 参数：layerKey - 图层标识符；value - 目标可见性（true/false）
   * 用途：与 toggleLayerVisibility 相比，此函数允许指定具体的状态值
   *      用于初始化或外部状态同步
   * 
   * 例：setLayerVisibility("boundary", false)  // 强制隐藏边界
   */
  // 允许直接设置某图层的布尔值，便于 LayerToggle 初始化
  setLayerVisibility: (layerKey, value) =>
    set((state) => {
      const boolValue = Boolean(value);
      const layerVisibility = {
        ...state.layerVisibility,
        [layerKey]: boolValue,
      };
      return {
        layerVisibility,
        ...(layerKey === "pois" ? { poiLayerVisible: boolValue } : null),
      };
    }),

  /**
   * setPoiLayerVisible：专门控制 POI 图层显隐（同时同步 layerVisibility）
   */
  setPoiLayerVisible: (visible) =>
    set((state) => ({
      poiLayerVisible: Boolean(visible),
      layerVisibility: {
        ...state.layerVisibility,
        pois: Boolean(visible),
      },
    })),

  /**
   * updatePoiStatistics：更新 POI 数量统计，供 DebugPanel 展示
   */
  updatePoiStatistics: (stats = {}) =>
    set({
      poiStatistics: {
        total: Math.max(0, stats.total ?? 0),
        independent: Math.max(0, stats.independent ?? 0),
      },
    }),

  /**
   * pushLogPreview：添加一条日志到预览列表
   * 参数：entry - 日志项对象（通常含 timestamp、level、module、message 等）
   * 逻辑：
   * 1. 将 entry 追加到 logsPreview 末尾
   * 2. 仅保留最新的 MAX_LOG_PREVIEW 条（移除最旧的）
   * 触发者：logger 输出拦截（未来可实现）或手动调用
   * 
   * 例：
   * pushLogPreview({
   *   timestamp: "14:30:45",
   *   level: "INFO",
   *   module: "三维渲染",
   *   message: "场景初始化完成"
   * })
   */
  // 记录最新日志到预览列表，仅保留 50 条
  pushLogPreview: (entry) =>
    set((state) => ({
      logsPreview: [...state.logsPreview, entry].slice(-MAX_LOG_PREVIEW),
    })),

  /**
   * updateSceneTransform：部分更新场景变换（增量）
   * 参数：partial - 部分变换对象，格式 { rotationY?, scale?, offset? }
   * 逻辑：
   * 1. 对每个字段：若 partial 中存在则使用新值，否则保持旧值
   * 2. 对于嵌套对象 offset，也应用同样的逻辑：未提供的轴（x/z）保持旧值
   * 触发者：DebugPanel.jsx 中的 handle*Change 函数
   * 
   * 例1：updateSceneTransform({ rotationY: Math.PI / 4 })
   *     仅更改旋转，scale 和 offset 保持不变
   * 
   * 例2：updateSceneTransform({ offset: { x: 100 } })
   *     仅更改 offset.x，offset.z 保持旧值，其他字段保持旧值
   * 
   * 副作用：
   * - App.jsx 的 useEffect 监听 sceneTransform 变化
   * - 调用 applySceneTransform，同步更新 Three.js 场景中所有 Group 的变换
   */
  // 调试面板增量更新旋转/缩放/偏移，未提供的字段保持旧值
  updateSceneTransform: (partial) =>
    set((state) => ({
      sceneTransform: {
        rotationY:
          partial.rotationY ?? state.sceneTransform.rotationY,
        scale: partial.scale ?? state.sceneTransform.scale,
        offset: {
          x: partial.offset?.x ?? state.sceneTransform.offset.x,
          z: partial.offset?.z ?? state.sceneTransform.offset.z,
        },
      },
    })),

  /**
   * resetSceneTransform：重置场景变换到初始状态（所有增量为零）
   * 逻辑：仅恢复增量部分为 0，不影响 SCENE_BASE_ALIGNMENT 中的基准值
   * 触发者：DebugPanel 中的 Reset 按钮
   * 
   * 效果：
   * - rotationY: 0（恢复到基准 54°）
   * - scale: 1（恢复到 1:1 映射）
   * - offset: { x: 0, z: 0 }（恢复到基准偏移）
   * 
   * 副作用：App.jsx 的 useEffect 触发，场景恢复原始状态
   */
  // 仅将增量恢复为零，不影响基准姿态
  resetSceneTransform: () =>
    set({
      sceneTransform: getInitialSceneTransform(),
    }),

  /**
   * updateEnvironmentSettings：更新天空盒/环境配置
   * 参数：partial - 需要覆盖的字段（enabled/skybox/exposure/toneMapping）
   * 调用方：DebugPanel 天空盒表单、未来的配置同步逻辑
   * 仅覆盖传入字段，其他保持当前值
   */
  updateEnvironmentSettings: (partial) =>
    set((state) => ({
      environmentSettings: {
        ...state.environmentSettings,
        ...partial,
      },
    })),

  /**
   * resetEnvironmentSettings：恢复天空盒配置到默认值
   * 说明：常用于“恢复默认”或全局 Reset
   */
  resetEnvironmentSettings: () =>
    set({
      environmentSettings: getInitialEnvironmentSettings(),
    }),

  /**
   * resetStore：将整个 store 恢复到初始状态
   * 用途：
   * - 关闭应用时清理
   * - 测试中的 setup/teardown
   * - 调试时的"重新开始"按钮
   * 
   * 副作用：所有订阅该状态的 React 组件都会重新渲染
   */
  // 全量恢复 store，供测试或调试使用
  resetStore: () => set(getInitialData()),
}));
