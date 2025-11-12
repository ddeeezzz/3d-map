import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { COORDINATE_SYSTEM } from "@deck.gl/core";

vi.mock("@deck.gl/react", () => {
  const deckPropsRef = { current: null };
  const DeckGL = (props) => {
    deckPropsRef.current = props;
    return <div data-testid="deck-gl" />;
  };
  DeckGL.__deckPropsRef = () => deckPropsRef;
  return { default: DeckGL };
});

vi.mock("@deck.gl/layers", () => ({
  GeoJsonLayer: function GeoJsonLayer(props) {
    return props;
  },
}));

vi.mock("../../lib/coordinates.js", () => {
  const mockProjectedCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          stableId: "building-1",
          name: "第一食堂",
          category: "教学楼",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
      },
    ],
  };

  return {
    findProjectionOrigin: vi.fn(() => ({ lng: 0, lat: 0 })),
    projectFeatureCollection: vi.fn(() => mockProjectedCollection),
  };
});

const mockState = {
  layerVisibility: { buildingsOutline: true },
  setSelectedBuilding: vi.fn(),
  sceneTransform: { rotationY: 0, scale: 1, offset: { x: 0, z: 0 } },
};

vi.mock("../../store/useSceneStore", () => {
  const hook = (selector = (state) => state) => selector(mockState);
  hook.getState = () => mockState;
  return {
    useSceneStore: hook,
    SCENE_BASE_ALIGNMENT: {
      rotationY: 0,
      scale: 1,
      offset: { x: 0, z: 0 },
    },
  };
});

vi.mock("../../logger/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

import DeckOverlay from "../../views/DeckOverlay";
import DeckGLMock from "@deck.gl/react";
import { logInfo } from "../../logger/logger";

describe("DeckOverlay", () => {
  beforeEach(() => {
    mockState.layerVisibility.buildingsOutline = true;
    mockState.setSelectedBuilding.mockClear();
    mockState.sceneTransform = {
      rotationY: 0,
      scale: 1,
      offset: { x: 0, z: 0 },
    };
    logInfo.mockClear();
    const ref = DeckGLMock.__deckPropsRef();
    if (ref) {
      ref.current = null;
    }
  });

  it("renders GeoJsonLayer with Cartesian coordinate system", () => {
    render(<DeckOverlay />);
    const deckProps = DeckGLMock.__deckPropsRef().current;
    expect(deckProps.layers).toHaveLength(1);
    const layerProps = deckProps.layers[0];
    expect(layerProps.coordinateSystem).toBe(COORDINATE_SYSTEM.CARTESIAN);
    const tooltip = deckProps.getTooltip({
      object: { properties: { name: "第一教学楼", category: "教学楼" } },
    });
    expect(tooltip.text).toBe("第一教学楼｜教学楼");
  });

  it("handles click to update selected building", () => {
    render(<DeckOverlay />);
    const layerProps = DeckGLMock.__deckPropsRef().current.layers[0];
    layerProps.onClick({
      object: { properties: { stableId: "building-1", name: "第一食堂" } },
    });
    expect(mockState.setSelectedBuilding).toHaveBeenCalledWith("building-1");
    expect(logInfo).toHaveBeenCalledWith(
      "地图交互",
      "选中 第一食堂"
    );
  });

  it("skips layer when轮廓关闭", () => {
    mockState.layerVisibility.buildingsOutline = false;
    render(<DeckOverlay />);
    expect(DeckGLMock.__deckPropsRef().current.layers).toHaveLength(0);
  });
});
