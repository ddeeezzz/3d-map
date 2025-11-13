import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { attachBoundaryPicking } from "../../three/interactions/boundaryPicking";

vi.mock("../../logger/logger", () => ({
  logInfo: vi.fn(),
}));

const { logInfo } = await import("../../logger/logger");

describe("boundaryPicking", () => {
let intersections;
let setFromCameraSpy;
let intersectSpy;

beforeEach(() => {
  intersections = [];
  setFromCameraSpy = vi
    .spyOn(THREE.Raycaster.prototype, "setFromCamera")
    .mockImplementation(() => {});
  intersectSpy = vi
    .spyOn(THREE.Raycaster.prototype, "intersectObjects")
    .mockImplementation(() => intersections);
});

afterEach(() => {
  setFromCameraSpy.mockRestore();
  intersectSpy.mockRestore();
  vi.restoreAllMocks();
});

  const createDomElement = () => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  });

  const findHandler = (domElement, eventName) =>
    domElement.addEventListener.mock.calls.find(([evt]) => evt === eventName)?.[1];

  it("hover 会高亮并记录原 emissive", () => {
    const domElement = createDomElement();
    const camera = new THREE.PerspectiveCamera();
    const material = new THREE.MeshPhongMaterial();
    material.emissive.set("#000000");
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const boundaryGroup = new THREE.Group();
    boundaryGroup.add(mesh);
    boundaryGroup.visible = true;

    intersections = [{ object: mesh }];
    const handle = attachBoundaryPicking({ domElement, camera, boundaryGroup });
    const moveHandler = findHandler(domElement, "pointermove");
    expect(moveHandler).toBeDefined();

    moveHandler({ clientX: 50, clientY: 50 });

    expect(mesh.material.emissive.equals(new THREE.Color("#ffe082"))).toBe(true);
    handle.clearHover();
    expect(mesh.material.emissive.equals(new THREE.Color("#000000"))).toBe(true);
  });

  it("click 会输出日志", () => {
    const domElement = createDomElement();
    const camera = new THREE.PerspectiveCamera();
    const material = new THREE.MeshPhongMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.userData = { stableId: "relation/1", name: "校园围墙", boundaryType: "campus" };
    const boundaryGroup = new THREE.Group();
    boundaryGroup.add(mesh);
    boundaryGroup.visible = true;

    intersections = [{ object: mesh }];
    attachBoundaryPicking({ domElement, camera, boundaryGroup });
    const moveHandler = findHandler(domElement, "pointermove");
    const clickHandler = findHandler(domElement, "click");

    moveHandler({ clientX: 30, clientY: 30 });
    clickHandler();

    expect(logInfo).toHaveBeenCalledWith("围墙交互", "点击 校园围墙", {
      stableId: "relation/1",
      boundaryType: "campus",
    });
  });
});
