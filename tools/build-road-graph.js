#!/usr/bin/env node
/**
 * 路网图构建脚本（阶段一）
 *
 * - 读取 app/src/data/campus.geojson
 * - 将 featureType = "road" 的折线拆解为节点/边
 * - 输出 data/roads-graph.json 与 app/src/data/roads-graph.json
 * - 生成 data/reports/road-graph.json 记录统计信息
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const campusGeojsonPath = join(projectRoot, "app", "src", "data", "campus.geojson");
const dataOutputPath = join(projectRoot, "data", "roads-graph.json");
const appDataOutputPath = join(projectRoot, "app", "src", "data", "roads-graph.json");
const reportDir = join(projectRoot, "data", "reports");
const reportPath = join(reportDir, "road-graph.json");
const COORD_EPSILON_METERS = 0.1;

async function loadCoordinatesModule() {
  const url = pathToFileURL(join(projectRoot, "app", "src", "lib", "coordinates.js")).href;
  const mod = await import(url);
  return mod;
}

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function roundToEpsilon(value, epsilon) {
  return Math.round(value / epsilon) * epsilon;
}

function buildGraph(features, projectCoordinate, findProjectionOrigin) {
  const origin = findProjectionOrigin(features);
  const roadFeatures = features.filter(
    (feature) => feature.properties?.featureType === "road"
  );
  const nodeKeyMap = new Map();
  const nodeIdMap = new Map();
  const nodes = [];
  const edges = [];
  const adjacencyCount = new Map();
  let edgeSeq = 0;

  function registerEdge(fromId, toId, roadId) {
    if (fromId === toId) return;
    const fromNode = nodeIdMap.get(fromId);
    const toNode = nodeIdMap.get(toId);
    if (!fromNode || !toNode) return;
    const length = Math.hypot(toNode.worldX - fromNode.worldX, toNode.worldZ - fromNode.worldZ);
    if (!(length > 0)) return;
    edgeSeq += 1;
    edges.push({
      id: `edge-${edgeSeq}-f`,
      from: fromNode.id,
      to: toNode.id,
      length,
      roadId,
    });
    edgeSeq += 1;
    edges.push({
      id: `edge-${edgeSeq}-b`,
      from: toNode.id,
      to: fromNode.id,
      length,
      roadId,
    });
    adjacencyCount.set(fromNode.id, (adjacencyCount.get(fromNode.id) || 0) + 1);
    adjacencyCount.set(toNode.id, (adjacencyCount.get(toNode.id) || 0) + 1);
  }

  function getOrCreateNode([lng, lat]) {
    const [projectedX, projectedY] = projectCoordinate([lng, lat], origin);
    const worldX = projectedX;
    const worldZ = -projectedY;
    const key = `${roundToEpsilon(worldX, COORD_EPSILON_METERS)}_${roundToEpsilon(
      worldZ,
      COORD_EPSILON_METERS
    )}`;
    const existing = nodeKeyMap.get(key);
    if (existing) {
      return existing;
    }
    const node = {
      id: `node-${nodes.length + 1}`,
      lng,
      lat,
      worldX,
      worldZ,
    };
    nodeKeyMap.set(key, node);
    nodeIdMap.set(node.id, node);
    nodes.push(node);
    return node;
  }

  function processLine(lineCoords, roadId) {
    if (!Array.isArray(lineCoords) || lineCoords.length < 2) return;
    let prevNode = null;
    lineCoords.forEach((coord) => {
      if (
        !Array.isArray(coord) ||
        coord.length < 2 ||
        !Number.isFinite(coord[0]) ||
        !Number.isFinite(coord[1])
      ) {
        prevNode = null;
        return;
      }
      const node = getOrCreateNode(coord);
      if (prevNode) {
        registerEdge(prevNode.id, node.id, roadId);
      }
      prevNode = node;
    });
  }

  const processedRoadIds = new Set();

  roadFeatures.forEach((feature, featureIndex) => {
    const geometry = feature.geometry;
    if (!geometry) return;
    const props = feature.properties || {};
    const roadId = props.stableId || feature.id || `road-${featureIndex}`;
    processedRoadIds.add(roadId);
    if (geometry.type === "LineString") {
      processLine(geometry.coordinates, roadId);
    } else if (geometry.type === "MultiLineString") {
      geometry.coordinates.forEach((line) => processLine(line, roadId));
    }
  });

  const isolatedNodes = nodes
    .filter((node) => !adjacencyCount.has(node.id))
    .map((node) => node.id);

  return {
    graph: {
      metadata: {
        projectionOrigin: origin,
        generatedAt: new Date().toISOString(),
        roadsProcessed: processedRoadIds.size,
      },
      nodes,
      edges,
    },
    stats: {
      generatedAt: new Date().toISOString(),
      nodes: nodes.length,
      edges: edges.length,
      roadsProcessed: processedRoadIds.size,
      isolatedNodes,
    },
  };
}

async function main() {
  console.log("[INFO][路网构建] 开始生成 roads-graph.json");
  ensureDir(reportDir);
  const campusRaw = readFileSync(campusGeojsonPath, "utf-8");
  const campusData = JSON.parse(campusRaw);
  const features = campusData.features || [];
  const { projectCoordinate, findProjectionOrigin } = await loadCoordinatesModule();
  const { graph, stats } = buildGraph(features, projectCoordinate, findProjectionOrigin);

  ensureDir(dataOutputPath);
  ensureDir(appDataOutputPath);
  writeFileSync(dataOutputPath, JSON.stringify(graph, null, 2));
  writeFileSync(appDataOutputPath, JSON.stringify(graph, null, 2));
  writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(
    `[INFO][路网构建] 图生成完成｜数据：{ nodes: ${stats.nodes}, edges: ${stats.edges}, isolated: ${stats.isolatedNodes.length} }`
  );
}

main().catch((error) => {
  console.error("[ERROR][路网构建] 处理失败", error);
  process.exit(1);
});
