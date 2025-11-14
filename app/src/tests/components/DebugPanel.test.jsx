import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockState = {
  sceneTransform: { rotationY: 0, scale: 1, offset: { x: 0, z: 0 } },
  environmentSettings: {
    enabled: true,
    skybox: "citrus_orchard_road_puresky_4k.hdr",
    exposure: 1,
    toneMapping: "ACESFilmic",
  },
};

const mockUpdateSceneTransform = vi.fn((partial) => {
  mockState.sceneTransform = {
    rotationY: partial.rotationY ?? mockState.sceneTransform.rotationY,
    scale: partial.scale ?? mockState.sceneTransform.scale,
    offset: {
      x: partial.offset?.x ?? mockState.sceneTransform.offset.x,
      z: partial.offset?.z ?? mockState.sceneTransform.offset.z,
    },
  };
});

const mockResetSceneTransform = vi.fn(() => {
  mockState.sceneTransform = { rotationY: 0, scale: 1, offset: { x: 0, z: 0 } };
});

const mockUpdateEnvironmentSettings = vi.fn((partial) => {
  mockState.environmentSettings = {
    ...mockState.environmentSettings,
    ...partial,
  };
});

vi.mock("../../store/useSceneStore", () => {
  const hook = (selector = (s) => s) =>
    selector({
      sceneTransform: mockState.sceneTransform,
      updateSceneTransform: mockUpdateSceneTransform,
      resetSceneTransform: mockResetSceneTransform,
      environmentSettings: mockState.environmentSettings,
      updateEnvironmentSettings: mockUpdateEnvironmentSettings,
    });
  hook.getState = () => ({
    sceneTransform: mockState.sceneTransform,
    updateSceneTransform: mockUpdateSceneTransform,
    resetSceneTransform: mockResetSceneTransform,
    environmentSettings: mockState.environmentSettings,
    updateEnvironmentSettings: mockUpdateEnvironmentSettings,
  });
  return { useSceneStore: hook };
});

import DebugPanel from "../../components/DebugPanel";

describe("DebugPanel", () => {
  beforeEach(() => {
    mockState.sceneTransform = { rotationY: 0, scale: 1, offset: { x: 0, z: 0 } };
    mockUpdateSceneTransform.mockClear();
    mockResetSceneTransform.mockClear();
    mockState.environmentSettings = {
      enabled: true,
      skybox: "citrus_orchard_road_puresky_4k.hdr",
      exposure: 1,
      toneMapping: "ACESFilmic",
    };
    mockUpdateEnvironmentSettings.mockClear();
  });

  it("updates rotation via slider", () => {
    render(<DebugPanel />);
    const slider = screen.getAllByRole("slider")[0];
    fireEvent.change(slider, { target: { value: "90" } });
    expect(mockUpdateSceneTransform).toHaveBeenCalledWith({
      rotationY: (90 * Math.PI) / 180,
    });
  });

  it("updates scale input", () => {
    render(<DebugPanel />);
    const scaleInput = screen.getAllByLabelText("缩放比例")[0];
    fireEvent.change(scaleInput, { target: { value: "1.5" } });
    expect(mockUpdateSceneTransform).toHaveBeenCalledWith({ scale: 1.5 });
  });

  it("updates exposure slider", () => {
    render(<DebugPanel />);
    const exposureSlider = screen.getAllByLabelText("曝光调节")[0];
    fireEvent.change(exposureSlider, { target: { value: "1.8" } });
    expect(mockUpdateEnvironmentSettings).toHaveBeenCalledWith({ exposure: 1.8 });
  });

  it("toggles environment checkbox", () => {
    render(<DebugPanel />);
    const checkbox = screen.getAllByLabelText("启用环境光")[0];
    fireEvent.click(checkbox);
    expect(mockUpdateEnvironmentSettings).toHaveBeenCalledWith({ enabled: false });
  });
});
