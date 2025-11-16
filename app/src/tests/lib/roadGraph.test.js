import { describe, it, expect } from "vitest";
import graphData from "../../data/roads-graph.json";
import { solveRouteBetweenPoints } from "../../lib/roadGraph";

const firstEdge = graphData.edges.find(
  (edge) => edge && edge.from && edge.to
);
const fromNode =
  graphData.nodes.find((node) => node.id === firstEdge?.from) || {};
const toNode =
  graphData.nodes.find((node) => node.id === firstEdge?.to) || {};

describe("roadGraph solver", () => {
  it("finds route between two nodes on the same edge", () => {
    const route = solveRouteBetweenPoints(
      { worldX: Number(fromNode.worldX), worldZ: Number(fromNode.worldZ) },
      { worldX: Number(toNode.worldX), worldZ: Number(toNode.worldZ) }
    );
    expect(route).toBeTruthy();
    expect(route.edgePath.length).toBeGreaterThan(0);
    expect(route.roadIds.length).toBeGreaterThan(0);
  });

  it("returns zero-length when start equals end", () => {
    const route = solveRouteBetweenPoints(
      { worldX: Number(fromNode.worldX), worldZ: Number(fromNode.worldZ) },
      { worldX: Number(fromNode.worldX), worldZ: Number(fromNode.worldZ) }
    );
    expect(route.totalLength).toBe(0);
    expect(route.edgePath.length).toBe(0);
  });
});
