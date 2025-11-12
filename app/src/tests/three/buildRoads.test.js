import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

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
        featureType: "road",
        width: 6,
        stableId: "road-1",
        name: "道路一",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [103.9, 30.7],
          [103.9002, 30.7],
        ],
      },
    },
    {
      properties: {
        featureType: "road",
        width: 6,
        stableId: "road-2",
        name: "道路二",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [103.9, 30.7002],
          [103.9002, 30.7002],
        ],
      },
    },
  ],
});

vi.mock("../../data/campus.geojson?raw", () => ({
  default: mockData,
}));

const { buildRoads } = await import("../../three/buildRoads");

describe("buildRoads", () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it("为不同道路 Mesh 提供独立材质", () => {
    const group = buildRoads(scene);
    const meshes = group.children.filter((child) => child.isMesh);
    expect(meshes.length).toBe(2);
    expect(meshes[0].material).not.toBe(meshes[1].material);
  });

  it("scene 缺失时抛出错误", () => {
    expect(() => buildRoads(null)).toThrow();
  });
});
