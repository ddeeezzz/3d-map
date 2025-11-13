import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

const mockData = JSON.stringify({
  features: [
    {
      properties: {
        featureType: "building",
        elevation: 18,
      },
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
        featureType: "lake",
        stableId: "lake-1",
        name: "测试湖泊",
        waterType: "lake",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [103.90005, 30.70005],
            [103.90015, 30.70005],
            [103.90015, 30.70015],
            [103.90005, 30.70015],
            [103.90005, 30.70005],
          ],
        ],
      },
    },
  ],
});

vi.mock("../../data/campus.geojson?raw", () => ({ default: mockData }));

const { buildWater } = await import("../../three/buildWater");

describe("buildWater", () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it("将水系 group 加入场景并生成 Mesh", () => {
    const group = buildWater(scene);
    expect(group.name).toBe("water");
    expect(scene.children).toContain(group);
    expect(group.children.length).toBeGreaterThan(0);
    const mesh = group.children[0];
    expect(mesh.userData.stableId).toBe("lake-1");
    expect(mesh.material.transparent).toBe(true);
  });

  it("缺少 scene 时抛出异常", () => {
    expect(() => buildWater(null)).toThrow();
  });
});
