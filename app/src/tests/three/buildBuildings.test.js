import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

const mockData = JSON.stringify({
  features: [
    {
      properties: {
        featureType: "building",
        category: "教学楼",
        elevation: 20,
        stableId: "way/1",
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
  ],
});

vi.mock("../../data/campus.geojson?raw", () => ({ default: mockData }));

const { buildBuildings } = await import("../../three/buildBuildings");

describe("buildBuildings", () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it("adds buildings group to scene", () => {
    const group = buildBuildings(scene);
    expect(scene.children).toContain(group);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it("throws if scene missing", () => {
    expect(() => buildBuildings(null)).toThrow();
  });
});
