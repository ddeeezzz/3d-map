// 引入 zustand 的工厂方法，用于创建导航相关的状态切片
import { create } from "zustand";
// 引入场景 store，便于在导航状态变化时同步高亮模型
import { useSceneStore } from "./useSceneStore";

// 定义交通方式的合法取值，需与 RouteInfoPopup 等组件共享同一枚举
const TRANSPORT_MODE_KEYS = ["walk", "bike", "ebike", "drive", "car"];

/**
 * useNavigationStore：管理导航面板的展示、地点选择及交通方式
 * @returns {object} state/actions 集合
 */
export const useNavigationStore = create((set, get) => ({
  // --- STATE ---
  isPanelVisible: false, // 控制导航面板是否显示
  panelPosition: { top: 0, left: 0 }, // 存储面板的 CSS 位置
  startLocation: null, // 起点 POI 信息 { poiId, name, worldX, worldZ, parentId, parentType }
  endLocation: null, // 终点 POI 信息
  transportMode: "walk", // 交通方式（取值与 TRANSPORT_MODE_KEYS 保持一致）
  routePath: null, // 路线坐标数组 [ [x,y,z], [x,y,z], ... ]
  routeSummary: null, // 路线信息 { fromPoi, toPoi, distance }

  // --- ACTIONS ---
  /**
   * togglePanel：根据触发按钮的位置开关导航面板
   * @param {React.RefObject<HTMLElement>} buttonRef - 导航按钮引用，用于计算弹窗位置
   */
  togglePanel: (buttonRef) => {
    const { isPanelVisible } = get();

    if (isPanelVisible) {
      set({ isPanelVisible: false });
    } else if (buttonRef?.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      set({
        isPanelVisible: true,
        panelPosition: {
          top: rect.bottom + 8,
          left: rect.left,
        },
      });
    }
  },

  /**
   * setStartLocation：设置起点 POI 并刷新场景高亮
   * @param {object|null} location - 包含 poiId/name 坐标等字段的地点对象
   */
  setStartLocation: (location) => {
    set({ startLocation: location });
    get().updateHighlights();
  },

  /**
   * setEndLocation：设置终点 POI 并刷新场景高亮
   * @param {object|null} location - 终点地点对象
   */
  setEndLocation: (location) => {
    set({ endLocation: location });
    get().updateHighlights();
  },

  /**
   * updateHighlights：根据起终点同步 useSceneStore 的模型/POI 高亮
   */
  updateHighlights: () => {
    const { startLocation, endLocation } = get();
    const idsToHighlight = [];
    const modelRefs = [];

    const collect = (location) => {
      if (!location?.poiId) return;
      idsToHighlight.push(location.poiId);
      if (location.parentId && location.parentType) {
        modelRefs.push({
          poiId: location.poiId,
          type: location.parentType,
          id: location.parentId,
        });
      }
    };

    collect(startLocation);
    collect(endLocation);

    const sceneStore = useSceneStore.getState();
    if (typeof sceneStore.setHighlightedLocations === "function") {
      sceneStore.setHighlightedLocations(idsToHighlight, modelRefs);
    } else if (typeof sceneStore.setHighlightedBuildingIds === "function") {
      sceneStore.setHighlightedBuildingIds(idsToHighlight);
    }
  },

  /**
   * setTransportMode：写入交通方式，非法值回退到 'walk'
   * @param {string} mode - 待设置的交通方式
   */
  setTransportMode: (mode) => {
    const normalizedMode = TRANSPORT_MODE_KEYS.includes(mode)
      ? mode
      : "walk";
    set({ transportMode: normalizedMode });
  },
}));