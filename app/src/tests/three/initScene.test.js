import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mockSetSize = vi.fn();
const mockSetPixelRatio = vi.fn();
const mockRender = vi.fn();
const mockUpdateProjectionMatrix = vi.fn();
const mockCameraPositionSet = vi.fn();
const mockControlsUpdate = vi.fn();

vi.mock("three", () => {
  class Scene {
    constructor() {
      this.children = [];
      this.background = null;
    }

    add(obj) {
      this.children.push(obj);
    }
  }

  class PerspectiveCamera {
    constructor() {
      this.position = { set: mockCameraPositionSet };
      this.updateProjectionMatrix = mockUpdateProjectionMatrix;
      this.aspect = 1;
    }
  }

  class WebGLRenderer {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.shadowMap = {};
    }

    setSize = mockSetSize;
    setPixelRatio = mockSetPixelRatio;
    render = mockRender;
  }

  class AmbientLight {}
  class DirectionalLight {
    constructor() {
      this.position = { set: vi.fn() };
    }
  }
  class Color {
    constructor(value) {
      this.value = value;
    }
  }

  class GridHelper {
    constructor() {
      this.material = {};
    }
  }

  class AxesHelper {}

  return {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight,
    Color,
    GridHelper,
    AxesHelper,
    PCFSoftShadowMap: "PCFSoftShadowMap",
  };
});

vi.mock(
  "three/examples/jsm/controls/OrbitControls.js",
  () => ({
    OrbitControls: class {
      constructor() {
        this.enableDamping = false;
        this.dampingFactor = 0;
        this.maxPolarAngle = 0;
        this.minDistance = 0;
        this.maxDistance = 0;
      }

      update = mockControlsUpdate;
    },
  }),
  { virtual: true }
);

import { initScene } from "../../three/initScene";

describe("initScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb) => setTimeout(cb, 0))
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id) => clearTimeout(id)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes renderer and appends canvas", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 800 });
    Object.defineProperty(container, "clientHeight", { value: 600 });

    const ctx = initScene(container);

    expect(container.childElementCount).toBe(1);
    expect(ctx.renderer).toBeDefined();
    expect(mockSetSize).toHaveBeenCalledWith(800, 600);
  });

  it("supports resize/start/stop hooks", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 400 });
    Object.defineProperty(container, "clientHeight", { value: 300 });

    const ctx = initScene(container);
    ctx.resize();
    expect(mockSetSize).toHaveBeenLastCalledWith(400, 300);

    ctx.start();
    expect(global.requestAnimationFrame).toHaveBeenCalled();

    ctx.stop();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("throws when container missing", () => {
    expect(() => initScene(null)).toThrow();
  });
});
