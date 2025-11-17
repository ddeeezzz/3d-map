import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as THREE from "three";
import { attachRoadPicking } from "../../three/interactions/roadPicking";

const ensurePointerEvent = () => {
  if (typeof PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(type, props = {}) {
        super(type, props);
        Object.assign(this, props);
      }
    };
  }
};

describe("attachRoadPicking", () => {
  let domElement;

  beforeEach(() => {
    ensurePointerEvent();
    domElement = document.createElement("div");
    domElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    });
    document.body.appendChild(domElement);
  });

  afterEach(() => {
    domElement.remove();
  });

  const createScene = () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const roadsGroup = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({ color: 0xd0d0d0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 4), material);
    mesh.userData = {
      stableId: "road-1",
      name: "测试道路",
      highway: "residential",
    };
    roadsGroup.add(mesh);

    return { camera, roadsGroup, mesh };
  };

  it("高亮 hover 的道路并回调 onHover", () => {
    const { camera, roadsGroup, mesh } = createScene();
    const onHover = vi.fn();
    const { dispose } = attachRoadPicking({
      domElement,
      camera,
      roadsGroup,
      onHover,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 })
    );

    expect(mesh.material.emissiveIntensity).toBeCloseTo(0.4, 2);
    expect(onHover).toHaveBeenCalledWith({
      stableId: "road-1",
      name: "测试道路",
      highway: "residential",
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 0, clientY: 0 })
    );

    expect(mesh.material.emissiveIntensity).toBe(0);
    expect(onHover).toHaveBeenLastCalledWith(null);

    dispose();
  });

  it("click 时触发 onSelect 并返回 userData", () => {
    const { camera, roadsGroup } = createScene();
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const { dispose } = attachRoadPicking({
      domElement,
      camera,
      roadsGroup,
      onHover,
      onSelect,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 })
    );
    domElement.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 100 }));

    expect(onHover).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({
      stableId: "road-1",
      name: "测试道路",
      highway: "residential",
    });

    dispose();
  });
});
