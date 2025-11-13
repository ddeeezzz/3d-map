import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

const boundaryCoordinates = [
  [103.9002, 30.7002],
  [103.9005, 30.7002],
  [103.9005, 30.7005],
  [103.9002, 30.7005],
  [103.9002, 30.7002],
  [103.9002, 30.7002], // duplicate closing node
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
const { projectRingWithDuplicates, prepareClosedRing } = __boundaryInternals;

describe("buildBoundary", () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it("保留重复节点也能生成围墙 Mesh", () => {
    const group = buildBoundary(scene);
    expect(scene.children).toContain(group);
    expect(group.name).toBe("boundary");
    expect(group.children.length).toBeGreaterThan(0);
    const mesh = group.children[0];
    expect(mesh.userData.stableId).toBe("relation/1");
    expect(mesh.geometry).toBeDefined();
  });

  it("scene 缺失时报错", () => {
    expect(() => buildBoundary()).toThrow();
  });
});

describe("__boundaryInternals", () => {
  it("projectRingWithDuplicates 不移除重复坐标", () => {
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

  it("prepareClosedRing 会复制首点到末尾且使用新对象", () => {
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
});
