import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as THREE from "three";
import { attachWaterPicking } from "../../three/interactions/waterPicking";

const ensurePointerEvent = () => {
  if (typeof PointerEvent === "undefined") {
    global.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(type, props = {}) {
        super(type, props);
        Object.assign(this, props);
      }
    };
  }
};

describe("attachWaterPicking", () => {
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

    const waterGroup = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({ color: 0x4fc3f7 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    mesh.userData = {
      stableId: "lake-1",
      name: "测试水体",
      waterType: "lake",
    };
    waterGroup.add(mesh);

    return { camera, waterGroup, mesh };
  };

  it("hover 时高亮并触发 onHover", () => {
    const { camera, waterGroup, mesh } = createScene();
    const onHover = vi.fn();
    const { dispose } = attachWaterPicking({
      domElement,
      camera,
      waterGroup,
      onHover,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 })
    );

    expect(onHover).toHaveBeenCalledWith({
      stableId: "lake-1",
      name: "测试水体",
      waterType: "lake",
    });
    expect(mesh.material.emissiveIntensity).toBeCloseTo(0.5, 1);

    dispose();
  });

  it("click 时返回当前 hover 的水体信息", () => {
    const { camera, waterGroup } = createScene();
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const { dispose } = attachWaterPicking({
      domElement,
      camera,
      waterGroup,
      onHover,
      onSelect,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 })
    );
    domElement.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 100 }));

    expect(onHover).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({
      stableId: "lake-1",
      name: "测试水体",
      waterType: "lake",
    });

    dispose();
  });
});
