// app/src/store/navigationStore.js
import { create } from "zustand";
import { useSceneStore } from "./useSceneStore";

export const useNavigationStore = create((set, get) => ({
  // --- STATE ---
  isPanelVisible: false, // 控制导航面板是否显示
  panelPosition: { top: 0, left: 0 }, // 存储面板的 CSS 位置
  startLocation: null, // 起点 POI 信息 { poiId, name, worldX, worldZ, parentId, parentType }
  endLocation: null, // 终点 POI 信息
  transportMode: "walk", // 'walk', 'bike', 'ebike', 'car'
  routePath: null, // 路线坐标数组 [ [x,y,z], [x,y,z], ... ]
  routeSummary: null, // 路线信息 { fromPoi, toPoi, distance }

  // --- ACTIONS ---
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

  setStartLocation: (location) => {
    set({ startLocation: location });
    get().updateHighlights();
  },

  setEndLocation: (location) => {
    set({ endLocation: location });
    get().updateHighlights();
  },

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

  setTransportMode: (mode) => {
    set({ transportMode: mode });
  },
}));