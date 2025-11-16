import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

const boundaryCoordinates = [
  [103.9002, 30.7002],
  [103.9005, 30.7002],
  [103.9005, 30.7005],
  [103.9002, 30.7005],
  [103.9002, 30.7002],
  [103.9002, 30.7002],
];

const mockData = JSON.stringify({
  features: [
    {
      properties: { featureType: "building" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [103.9, 30.7],
            [103.9001, 30.7],
            [103.9001, 30.7001],
            [103.9, 30.7001],
            [103.9, 30.7],
          ],
        ],
      },
    },
    {
      properties: {
        featureType: "campusBoundary",
        stableId: "relation/1",
        name: "校园围墙",
        boundaryGates: [
          {
            stableId: "gate/1",
            center: [103.90035, 30.70035],
            width: 4,
            depth: 5,
            tangent: [0, 1],
          },
        ],
      },
      geometry: {
        type: "Polygon",
        coordinates: [boundaryCoordinates],
      },
    },
  ],
});

vi.mock("../../data/campus.geojson?raw", () => ({
  default: mockData,
}));

const boundaryModule = await import("../../three/buildBoundary");
const { buildBoundary, __boundaryInternals } = boundaryModule;
const {
  projectRingWithDuplicates,
  prepareClosedRing,
  computeSignedArea,
  offsetRing,
  buildClosedWallShape,
} = __boundaryInternals;

describe("buildBoundary", () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it("生成包含 gateIds 的闭合围墙 Mesh", () => {
    const group = buildBoundary(scene);
    expect(scene.children).toContain(group);
    /** wallMesh：筛选具有 wallMode 标记的 Mesh，用于验证围墙几何 */
    const wallMesh = group.children.find(
      (child) => child.userData && child.userData.wallMode === "closedSubtractive",
    );
    expect(wallMesh).toBeDefined();
    expect(wallMesh.userData.stableId).toBe("relation/1");
    expect(wallMesh.userData.wallMode).toBe("closedSubtractive");
    expect(wallMesh.userData.gateIds).toContain("gate/1");
    expect(wallMesh.geometry).toBeDefined();
  });

  it("scene 缺失时报错", () => {
    expect(() => buildBoundary()).toThrow();
  });
});

describe("__boundaryInternals", () => {
  it("projectRingWithDuplicates 保留重复节点", () => {
    const ring = [
      [103.9, 30.7],
      [103.9, 30.7],
      [103.9001, 30.7],
      "invalid",
    ];
    const projected = projectRingWithDuplicates(ring, { lng: 103.9, lat: 30.7 });
    expect(projected.length).toBe(3);
    expect(projected[0].equals(projected[1])).toBe(true);
  });

  it("prepareClosedRing 会复制首点到末尾", () => {
    const input = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(1, 1),
      new THREE.Vector2(0, 0),
    ];
    const closed = prepareClosedRing(input);
    expect(closed.length).toBe(input.length);
    expect(closed[closed.length - 1].equals(closed[0])).toBe(true);
    expect(closed[closed.length - 1]).not.toBe(closed[0]);
  });

  it("offsetRing 向外拓展后面积增大", () => {
    const ring = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(10, 0),
      new THREE.Vector2(10, 10),
      new THREE.Vector2(0, 10),
    ];
    const baseArea = Math.abs(computeSignedArea(ring));
    const outward = offsetRing(ring, 2, true);
    const outwardArea = Math.abs(computeSignedArea(outward));
    expect(outwardArea).toBeGreaterThan(baseArea);
  });

  it("buildClosedWallShape 使用 innerRing 作为 hole 并记录门洞", () => {
    const innerRing = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(10, 0),
      new THREE.Vector2(10, 10),
      new THREE.Vector2(0, 10),
    ];
    const result = buildClosedWallShape({
      innerRing,
      wallThickness: 2,
      gates: [
        {
          stableId: "gate/unit",
          center: [0.00005, 0.00005],
          width: 4,
          depth: 3,
          tangent: [1, 0],
        },
      ],
      origin: { lng: 0, lat: 0 },
      gateWidth: 4,
      gateDepth: 3,
    });

    expect(result).not.toBeNull();
    expect(result.shape.holes.length).toBeGreaterThanOrEqual(2);
    expect(result.appliedGateIds).toContain("gate/unit");
  });
});
