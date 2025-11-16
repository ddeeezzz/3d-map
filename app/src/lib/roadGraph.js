import graphData from "../data/roads-graph.json";
import config from "../config/index.js";

const BASE_NODES = graphData.nodes || [];
const BASE_EDGES = (graphData.edges || []).map((edge, index) => ({
  id: edge.id || `edge-${index}`,
  from: edge.from,
  to: edge.to,
  length: Number(edge.length) || 0,
  roadId: edge.roadId || null,
}));

const BASE_NODE_MAP = new Map(
  BASE_NODES.map((node) => [
    node.id,
    {
      id: node.id,
      worldX: Number(node.worldX) || 0,
      worldZ: Number(node.worldZ) || 0,
    },
  ])
);

const BASE_ADJACENCY = new Map();
BASE_EDGES.forEach((edge) => {
  if (!BASE_NODE_MAP.has(edge.from) || !BASE_NODE_MAP.has(edge.to)) return;
  if (!BASE_ADJACENCY.has(edge.from)) BASE_ADJACENCY.set(edge.from, []);
  BASE_ADJACENCY.get(edge.from).push({
    to: edge.to,
    length: edge.length,
    roadId: edge.roadId,
  });
});

const MAX_SNAP_DISTANCE = Number(config.poiRoute?.maxSnapDistance) || 20;
const EPSILON = 1e-4;

function createContext() {
  const nodeMap = new Map();
  BASE_NODE_MAP.forEach((node, id) => {
    nodeMap.set(id, { ...node });
  });
  const adjacency = new Map();
  BASE_NODE_MAP.forEach((_value, id) => {
    const edges = BASE_ADJACENCY.get(id) || [];
    adjacency.set(
      id,
      edges.map((edge) => ({
        to: edge.to,
        length: edge.length,
        roadId: edge.roadId,
      }))
    );
  });
  return {
    nodeMap,
    adjacency,
    tempCounter: 0,
  };
}

function nearestPointOnSegment(point, a, b) {
  const ax = a.worldX;
  const az = a.worldZ;
  const bx = b.worldX;
  const bz = b.worldZ;
  const px = point.x;
  const pz = point.z;
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz;
  if (abLenSq === 0) {
    return {
      ratio: 0,
      point: { x: ax, z: az },
      distance: Math.hypot(px - ax, pz - az),
    };
  }
  let t = (apx * abx + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + abx * t;
  const closestZ = az + abz * t;
  return {
    ratio: t,
    point: { x: closestX, z: closestZ },
    distance: Math.hypot(px - closestX, pz - closestZ),
  };
}

function findClosestEdge(point) {
  let bestEdge = null;
  let bestRatio = 0;
  let bestPoint = null;
  let bestDistance = Infinity;
  BASE_EDGES.forEach((edge) => {
    const fromNode = BASE_NODE_MAP.get(edge.from);
    const toNode = BASE_NODE_MAP.get(edge.to);
    if (!fromNode || !toNode) return;
    const result = nearestPointOnSegment(point, fromNode, toNode);
    if (result.distance <= MAX_SNAP_DISTANCE && result.distance < bestDistance) {
      bestEdge = edge;
      bestRatio = result.ratio;
      bestPoint = result.point;
      bestDistance = result.distance;
    }
  });
  if (!bestEdge || !bestPoint) {
    return null;
  }
  return {
    edge: bestEdge,
    ratio: bestRatio,
    point: bestPoint,
    distance: bestDistance,
  };
}

function addEdge(adjacency, fromId, toId, length, roadId) {
  if (!adjacency.has(fromId)) {
    adjacency.set(fromId, []);
  }
  adjacency.get(fromId).push({ to: toId, length, roadId });
}

function insertPointAsNode(context, snap, label) {
  if (snap.ratio <= EPSILON) return snap.edge.from;
  if (snap.ratio >= 1 - EPSILON) return snap.edge.to;

  const tempId = `temp-${label}-${context.tempCounter + 1}`;
  context.tempCounter += 1;

  const node = {
    id: tempId,
    worldX: snap.point.x,
    worldZ: snap.point.z,
    isTemp: true,
  };
  context.nodeMap.set(tempId, node);
  context.adjacency.set(tempId, []);

  const totalLength = snap.edge.length;
  const lengthToTemp = totalLength * snap.ratio;
  const lengthFromTemp = totalLength * (1 - snap.ratio);
  addEdge(context.adjacency, snap.edge.from, tempId, lengthToTemp, snap.edge.roadId);
  addEdge(context.adjacency, tempId, snap.edge.to, lengthFromTemp, snap.edge.roadId);
  addEdge(context.adjacency, tempId, snap.edge.from, lengthToTemp, snap.edge.roadId);
  addEdge(context.adjacency, snap.edge.to, tempId, lengthFromTemp, snap.edge.roadId);
  return tempId;
}

function runDijkstra(context, startId, endId) {
  if (startId === endId) {
    return {
      nodePath: [startId],
      edgePath: [],
      totalLength: 0,
    };
  }
  const distances = new Map();
  const previous = new Map();
  const queue = new Set(context.nodeMap.keys());
  queue.forEach((nodeId) => {
    distances.set(nodeId, nodeId === startId ? 0 : Infinity);
  });

  while (queue.size > 0) {
    let currentId = null;
    let bestDistance = Infinity;
    queue.forEach((nodeId) => {
      const dist = distances.get(nodeId) ?? Infinity;
      if (dist < bestDistance) {
        bestDistance = dist;
        currentId = nodeId;
      }
    });
    if (currentId === null) break;
    queue.delete(currentId);
    if (currentId === endId) break;
    const neighbors = context.adjacency.get(currentId) || [];
    neighbors.forEach((edge) => {
      const tentative = (distances.get(currentId) ?? Infinity) + edge.length;
      if (tentative < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, tentative);
        previous.set(edge.to, { from: currentId, edge });
      }
    });
  }

  if (!previous.has(endId)) {
    return null;
  }

  const nodePath = [];
  const edgePath = [];
  let current = endId;
  while (current !== undefined) {
    nodePath.unshift(current);
    const prev = previous.get(current);
    if (!prev) break;
    edgePath.unshift(prev.edge);
    current = prev.from;
  }

  return {
    nodePath,
    edgePath,
    totalLength: distances.get(endId) ?? 0,
  };
}

export function solveRouteBetweenPoints(startPoint, endPoint) {
  const context = createContext();
  const startSnap = findClosestEdge({ x: startPoint.worldX, z: startPoint.worldZ });
  if (!startSnap) {
    throw new Error("POI 未贴合道路：起点");
  }
  const endSnap = findClosestEdge({ x: endPoint.worldX, z: endPoint.worldZ });
  if (!endSnap) {
    throw new Error("POI 未贴合道路：终点");
  }
  const startId = insertPointAsNode(context, startSnap, "start");
  const endId = insertPointAsNode(context, endSnap, "end");
  const path = runDijkstra(context, startId, endId);
  if (!path) {
    throw new Error("未找到可行路线");
  }
  const pointPath = path.nodePath
    .map((nodeId) => context.nodeMap.get(nodeId))
    .filter(Boolean)
    .map((node) => ({
      worldX: node.worldX,
      worldZ: node.worldZ,
    }));
  const roadIds = path.edgePath
    .map((edge) => edge.roadId)
    .filter((roadId) => Boolean(roadId));
  return {
    ...path,
    roadIds,
    pointPath,
  };
}

export function getRoadGraphSummary() {
  return {
    nodes: BASE_NODES.length,
    edges: BASE_EDGES.length,
  };
}
