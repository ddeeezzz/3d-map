import { describe, it, expect, beforeEach } from "vitest";
import { useSceneStore } from "../../store/useSceneStore";

const resetStore = () => {
  useSceneStore.getState().resetStore();
};

describe("useSceneStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("updates selectedBuilding", () => {
    useSceneStore.getState().setSelectedBuilding("way/1");
    expect(useSceneStore.getState().selectedBuilding).toBe("way/1");
  });

  it("updates hoveredBuilding info", () => {
    const hoverInfo = { stableId: "hover-1", name: "测试楼" };
    useSceneStore.getState().setHoveredBuilding(hoverInfo);
    expect(useSceneStore.getState().hoveredBuilding).toEqual(hoverInfo);
    useSceneStore.getState().setHoveredBuilding(null);
    expect(useSceneStore.getState().hoveredBuilding).toBeNull();
  });

  it("toggles layer visibility", () => {
    const key = "roads";
    useSceneStore.getState().toggleLayerVisibility(key);
    expect(useSceneStore.getState().layerVisibility[key]).toBe(true);
    useSceneStore.getState().toggleLayerVisibility(key);
    expect(useSceneStore.getState().layerVisibility[key]).toBe(false);
  });

  it("pushes log preview with max length", () => {
    const push = useSceneStore.getState().pushLogPreview;
    for (let i = 0; i < 60; i += 1) {
      push({
        time: "12:00:00",
        level: "INFO",
        module: "测试",
        message: `日志${i}`,
      });
    }
    expect(useSceneStore.getState().logsPreview.length).toBe(50);
  });

  it("updates scene transform partially", () => {
    useSceneStore.getState().updateSceneTransform({
      rotationY: 1,
      offset: { x: 10 },
    });
    const transform = useSceneStore.getState().sceneTransform;
    expect(transform.rotationY).toBe(1);
    expect(transform.offset.x).toBe(10);
    expect(transform.offset.z).toBe(0);
  });

  it("updates environment settings", () => {
    useSceneStore
      .getState()
      .updateEnvironmentSettings({ exposure: 1.7, enabled: false });
    const env = useSceneStore.getState().environmentSettings;
    expect(env.exposure).toBe(1.7);
    expect(env.enabled).toBe(false);
  });

  it("resets environment settings to defaults", () => {
    useSceneStore
      .getState()
      .updateEnvironmentSettings({ skybox: "custom.hdr", enabled: false });
    useSceneStore.getState().resetEnvironmentSettings();
    const env = useSceneStore.getState().environmentSettings;
    expect(env.enabled).toBe(true);
    expect(env.skybox).toBe("citrus_orchard_road_puresky_4k.hdr");
  });
});
