import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockState = {
  sceneTransform: { rotationY: 0, scale: 1, offset: { x: 0, z: 0 } },
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

vi.mock("../../store/useSceneStore", () => {
  const hook = (selector = (s) => s) =>
    selector({
      sceneTransform: mockState.sceneTransform,
      updateSceneTransform: mockUpdateSceneTransform,
      resetSceneTransform: mockResetSceneTransform,
    });
  hook.getState = () => ({
    sceneTransform: mockState.sceneTransform,
    updateSceneTransform: mockUpdateSceneTransform,
    resetSceneTransform: mockResetSceneTransform,
  });
  return { useSceneStore: hook };
});

import DebugPanel from "../../components/DebugPanel";

describe("DebugPanel", () => {
  beforeEach(() => {
    mockState.sceneTransform = { rotationY: 0, scale: 1, offset: { x: 0, z: 0 } };
    mockUpdateSceneTransform.mockClear();
    mockResetSceneTransform.mockClear();
  });

  it("updates rotation via slider", () => {
    render(<DebugPanel />);
    const slider = screen.getByRole("slider");
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
});
