import { create } from "zustand";

// 最多保留 50 条日志预览，避免调试面板一次渲染过多文本
const MAX_LOG_PREVIEW = 50;
// 数据清洗阶段已经将校园旋转 54°，用弧度保存方便 Three.js 直接相加
const BASE_ROTATION = (54 * Math.PI) / 180;

// Three.js 应用时的基准姿态（旋转/缩放/偏移），调试面板只负责在此基础上叠加增量
export const SCENE_BASE_ALIGNMENT = Object.freeze({
  rotationY: BASE_ROTATION, // 让校园与真实朝向一致
  scale: 1, // 默认单位 1 ≈ 1 米
  offset: Object.freeze({ x: -500, z: -141 }), // 清洗时量测得到的中心偏移
});

// 调试面板的初始值：全零表示“不额外校正”
const getInitialSceneTransform = () => ({
  rotationY: 0,
  scale: 1,
  offset: { x: 0, z: 0 },
});

// 将所有字段初始值集中管理，resetStore 时直接复用
const getInitialData = () => ({
  selectedBuilding: null,
  route: null,
  layerVisibility: {},
  logsPreview: [],
  sceneTransform: getInitialSceneTransform(),
});

// useSceneStore：集中暴露校园导航需要的状态与 setter
export const useSceneStore = create((set, get) => ({
  ...getInitialData(),

  // 由导航面板或地图点击写入选中建筑 ID
  setSelectedBuilding: (id) => set({ selectedBuilding: id }),
  // 由路径规划模块写入当前路线数据
  setRoute: (route) => set({ route }),

  // 切换图层可见性；若不存在则视为 false → true
  toggleLayerVisibility: (layerKey) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerKey]: !state.layerVisibility[layerKey],
      },
    })),

  // 允许直接设置某图层的布尔值，便于 LayerToggle 初始化
  setLayerVisibility: (layerKey, value) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerKey]: value,
      },
    })),

  // 记录最新日志到预览列表，仅保留 50 条
  pushLogPreview: (entry) =>
    set((state) => ({
      logsPreview: [...state.logsPreview, entry].slice(-MAX_LOG_PREVIEW),
    })),

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

  // 仅将增量恢复为零，不影响基准姿态
  resetSceneTransform: () =>
    set({
      sceneTransform: getInitialSceneTransform(),
    }),

  // 全量恢复 store，供测试或调试使用
  resetStore: () => set(getInitialData()),
}));
