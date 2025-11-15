import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as THREE from "three";
import { attachSitePicking } from "../../three/interactions/sitePicking";

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

describe("attachSitePicking", () => {
  let domElement;
  let camera;
  let sitesGroup;

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

    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    sitesGroup = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({
      color: 0x22ccaa,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), material);
    mesh.userData = {
      stableId: "site-001",
      displayName: "测试场地",
      siteCategory: "track",
      sportsType: null,
    };
    sitesGroup.add(mesh);
  });

  afterEach(() => {
    domElement.remove();
  });

  it("触发 hover 回调", () => {
    const onHover = vi.fn();
    const handle = attachSitePicking({
      domElement,
      camera,
      sitesGroup,
      onHover,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 }),
    );

    expect(onHover).toHaveBeenCalledWith({
      stableId: "site-001",
      displayName: "测试场地",
      siteCategory: "track",
      sportsType: null,
    });
    handle.dispose();
  });

  it("click 调用 onSelect", () => {
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const handle = attachSitePicking({
      domElement,
      camera,
      sitesGroup,
      onHover,
      onSelect,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 }),
    );
    domElement.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 100 }));

    expect(onHover).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith({
      stableId: "site-001",
      displayName: "测试场地",
      siteCategory: "track",
      sportsType: null,
    });
    handle.dispose();
  });

  it("clearHover 恢复 hover 状态", () => {
    const onHover = vi.fn();
    const handle = attachSitePicking({
      domElement,
      camera,
      sitesGroup,
      onHover,
    });

    domElement.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 100 }),
    );
    onHover.mockClear();
    handle.clearHover();

    expect(onHover).toHaveBeenCalledWith(null);
    handle.dispose();
  });
});
