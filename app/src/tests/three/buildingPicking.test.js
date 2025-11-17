import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as THREE from "three";
import { attachBuildingPicking } from "../../three/interactions/buildingPicking";

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

describe("attachBuildingPicking", () => {
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

    const buildingGroup = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({ color: 0x3366ff });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    mesh.userData = { stableId: "b-1", name: "测试建筑" };
    buildingGroup.add(mesh);

    return { camera, buildingGroup, mesh };
  };

  it("calls onHover when指向建筑", () => {
    const { camera, buildingGroup } = createScene();
    const onHover = vi.fn();
    const detach = attachBuildingPicking({
      domElement,
      camera,
      buildingGroup,
      onHover,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 })
    );

    expect(onHover).toHaveBeenCalledWith({
      stableId: "b-1",
      name: "测试建筑",
    });
    detach();
  });

  it("triggers onSelect on click after hover", () => {
    const { camera, buildingGroup } = createScene();
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const detach = attachBuildingPicking({
      domElement,
      camera,
      buildingGroup,
      onHover,
      onSelect,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 })
    );
    domElement.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 100 }));

    expect(onHover).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({
      stableId: "b-1",
      name: "测试建筑",
    });
    detach();
  });
});
