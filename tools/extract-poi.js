#!/usr/bin/env node
/**
 * POI 数据提取脚本
 *
 * 职责：
 * 1. 读取 data/tmp.json（osmtogeojson 输出）与清洗后的 campus.geojson
 * 2. 从节点要素中过滤出带 name 的兴趣点
 * 3. 投影为平面坐标、补足高度、关联建筑 parentId
 * 4. 输出 data/pois.geojson（同时同步到 app/src/data/pois.geojson）和统计报告
 */
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { resolve, join } = require("path");
const { pathToFileURL } = require("url");

const projectRoot = resolve(__dirname, "..");
const tmpGeojsonPath = join(projectRoot, "data", "tmp.json");
const campusGeojsonPath = join(projectRoot, "app", "src", "data", "campus.geojson");
const dataOutputPath = join(projectRoot, "data", "pois.geojson");
const appDataOutputPath = join(projectRoot, "app", "src", "data", "pois.geojson");
const reportDir = join(projectRoot, "data", "reports");
const reportPath = join(reportDir, "poi-summary.json");
const LINE_ASSOCIATION_DISTANCE = 5;
const BBOX_PADDING = 1;
const PARENT_PRIORITY = {
  building: 0,
  site: 1,
  water: 2,
  road: 3,
};
let findProjectionOrigin;
let projectCoordinate;

/**
 * 动态加载 ES Module（logger、coordinates、config）
 * @param {string} relativePath 相对于当前文件的路径
 */
async function loadModule(relativePath) {
  const url = pathToFileURL(resolve(__dirname, relativePath)).href;
  const mod = await import(url);
  return mod.default || mod;
}

/** 解析数字字段（支持附带单位的字符串） */
function parseNumeric(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(String(value).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

/** 从配置中解析单层高度，缺省为 3 米 */
function resolveSingleFloorHeight(config) {
  const heights = config?.heights || {};
  const candidateKey =
    Object.keys(heights).find((key) => key.includes("1")) ?? "1层";
  return parseNumeric(heights[candidateKey]) ?? 3;
}

/** 取优先顺序的中文名称 */
function resolveName(props) {
  if (!props) return null;
  return (
    props.name ||
    props["name:zh"] ||
    props["name:zh-cn"] ||
    props["name:en"] ||
    null
  );
}

/** 解析 POI 分类（amenity/shop/tourism/...），无法匹配则 unknown */
function resolvePoiType(props) {
  if (!props) return "unknown";
  const keys = [
    "amenity",
    "shop",
    "tourism",
    "public_transport",
    "leisure",
    "office",
  ];
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "unknown";
}

/** 提取原始标签（去掉元数据字段） */
function pickSourceTags(props) {
  if (!props) return {};
  const metaKeys = new Set([
    "timestamp",
    "version",
    "changeset",
    "user",
    "uid",
    "id",
  ]);
  const tags = {};
  Object.keys(props).forEach((key) => {
    if (!metaKeys.has(key)) {
      tags[key] = props[key];
    }
  });
  return tags;
}

/** 正规化 POI ID，确保无非法字符 */
function buildPoiId(osmId, index) {
  const base = (osmId || `node-${index}`).replace(/[^a-zA-Z0-9/_-]+/g, "-");
  return `poi-${base}`;
}

/** 计算节点高度，优先 height 其次 level，默认 0 */
function resolveElevation(props, singleFloorHeight) {
  if (!props) return 0;
  const direct = parseNumeric(props.height || props.elevation);
  if (direct != null) {
    return direct;
  }
  const level =
    parseNumeric(props.level) ||
    parseNumeric(props.levels) ||
    parseNumeric(props["building:levels"]);
  if (level != null) {
    return level * singleFloorHeight;
  }
  return 0;
}

function computePolygonLabelCoordinate(geometry) {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  for (const polygon of polygons) {
    const ring = polygon?.[0];
    if (!Array.isArray(ring) || ring.length === 0) continue;
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    ring.forEach(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      sumLng += lng;
      sumLat += lat;
      count += 1;
    });
    if (count > 0) {
      return [sumLng / count, sumLat / count];
    }
  }
  return null;
}

function flattenLineCoordinates(geometry) {
  if (geometry.type === "LineString") {
    return geometry.coordinates;
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.flat();
  }
  return [];
}

function computeLineLabelCoordinate(geometry) {
  const points = flattenLineCoordinates(geometry);
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return points[0];
  }
  let totalLength = 0;
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [lng1, lat1] = points[i];
    const [lng2, lat2] = points[i + 1];
    if (
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng2) ||
      !Number.isFinite(lat2)
    ) {
      continue;
    }
    const length = Math.hypot(lng2 - lng1, lat2 - lat1);
    if (length > 0) {
      totalLength += length;
      segments.push({
        length,
        start: points[i],
        end: points[i + 1],
      });
    }
  }
  if (!segments.length) {
    return points[0];
  }
  const target = totalLength / 2;
  let accumulated = 0;
  for (const segment of segments) {
    if (accumulated + segment.length >= target) {
      const ratio = (target - accumulated) / segment.length;
      const lng =
        segment.start[0] + (segment.end[0] - segment.start[0]) * ratio;
      const lat =
        segment.start[1] + (segment.end[1] - segment.start[1]) * ratio;
      return [lng, lat];
    }
    accumulated += segment.length;
  }
  return segments[segments.length - 1].end;
}

/** 计算环的包围盒，便于快速排除 */
function computeRingBoundingBox(ring) {
  if (!Array.isArray(ring) || ring.length === 0) {
    return null;
  }
  let minLng = ring[0][0];
  let minLat = ring[0][1];
  let maxLng = ring[0][0];
  let maxLat = ring[0][1];
  ring.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  return { minLng, minLat, maxLng, maxLat };
}

/** 射线法判断点是否在环内 */
function isPointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] <
        ((xj - xi) * (point[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 判断点是否位于校园边界内（考虑孔洞） */
function isPointInsideBoundary(point, polygons) {
  if (!polygons.length) return true;
  return polygons.some((polygon) => {
    if (!Array.isArray(polygon) || !polygon.length) return false;
    const [outer, ...holes] = polygon;
    if (!isPointInRing(point, outer)) {
      return false;
    }
    return !holes.some((hole) => isPointInRing(point, hole));
  });
}

/** 判断点是否位于建筑轮廓内部，返回 { parentType, parentId } */
function normalizeParentType(featureType) {
  if (!featureType) return null;
  switch (featureType) {
    case "building":
      return "building";
    case "site":
      return "site";
    case "lake":
    case "water":
    case "river":
      return "water";
    case "road":
      return "road";
    default:
      return null;
  }
}

function projectPolygon(polygon, origin) {
  return polygon
    .map((ring) =>
      ring
        .map((coord) => projectCoordinate(coord, origin))
        .filter(
          (pt) =>
            Array.isArray(pt) &&
            Number.isFinite(pt[0]) &&
            Number.isFinite(pt[1])
        )
    )
    .filter((ring) => ring.length >= 3);
}

function projectLine(path, origin) {
  return path
    .map((coord) => projectCoordinate(coord, origin))
    .filter(
      (pt) =>
        Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1])
    );
}

function computeProjectedBBox(collections) {
  const bbox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  collections.forEach((item) => {
    item.forEach((point) => {
      const [x, y] = point;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x < bbox.minX) bbox.minX = x;
      if (x > bbox.maxX) bbox.maxX = x;
      if (y < bbox.minY) bbox.minY = y;
      if (y > bbox.maxY) bbox.maxY = y;
    });
  });
  if (
    !Number.isFinite(bbox.minX) ||
    !Number.isFinite(bbox.maxX) ||
    !Number.isFinite(bbox.minY) ||
    !Number.isFinite(bbox.maxY)
  ) {
    return null;
  }
  return bbox;
}

function buildParentCandidates(features, origin) {
  const candidates = [];
  (features || []).forEach((feature) => {
    const normalized = normalizeParentType(feature.properties?.featureType);
    if (!normalized) return;
    const geometry = feature.geometry;
    if (!geometry) return;
    const stableId = feature.properties?.stableId || feature.id;
    if (!stableId) return;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const polygons =
        geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.coordinates;
      const projectedPolygons = polygons
        .map((polygon) => projectPolygon(polygon, origin))
        .filter((rings) => rings.length);
      if (!projectedPolygons.length) {
        return;
      }
      const bbox = computeProjectedBBox(
        projectedPolygons.flatMap((polygon) => polygon)
      );
      candidates.push({
        parentType: normalized,
        stableId,
        geometryType: "polygon",
        polygons: projectedPolygons,
        bbox,
      });
      return;
    }
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const paths =
        geometry.type === "LineString"
          ? [geometry.coordinates]
          : geometry.coordinates;
      const projectedPaths = paths
        .map((path) => projectLine(path, origin))
        .filter((points) => points.length >= 2);
      if (!projectedPaths.length) {
        return;
      }
      const bbox = computeProjectedBBox(projectedPaths);
      candidates.push({
        parentType: normalized,
        stableId,
        geometryType: "line",
        paths: projectedPaths,
        bbox,
      });
    }
  });
  return candidates;
}

function isPointInProjectedRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] <
        ((xj - xi) * (point[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(point, start, end) {
  const segX = end[0] - start[0];
  const segY = end[1] - start[1];
  const segLenSq = segX * segX + segY * segY;
  let t = 0;
  if (segLenSq > 0) {
    t =
      ((point[0] - start[0]) * segX + (point[1] - start[1]) * segY) /
      segLenSq;
  }
  t = Math.max(0, Math.min(1, t));
  const closestPoint = [start[0] + segX * t, start[1] + segY * t];
  const dx = point[0] - closestPoint[0];
  const dy = point[1] - closestPoint[1];
  return Math.hypot(dx, dy);
}

function findParentCandidate(point, candidates) {
  let best = null;
  candidates.forEach((candidate) => {
    if (candidate.bbox) {
      if (
        point[0] < candidate.bbox.minX - BBOX_PADDING ||
        point[0] > candidate.bbox.maxX + BBOX_PADDING ||
        point[1] < candidate.bbox.minY - BBOX_PADDING ||
        point[1] > candidate.bbox.maxY + BBOX_PADDING
      ) {
        return;
      }
    }
    if (candidate.geometryType === "polygon") {
      const inside = candidate.polygons.some((polygon) => {
        if (!polygon.length) return false;
        const [outer, ...holes] = polygon;
        if (!outer || outer.length < 3) return false;
        if (!isPointInProjectedRing(point, outer)) return false;
        return !holes.some((hole) => isPointInProjectedRing(point, hole));
      });
      if (inside) {
        const priority = PARENT_PRIORITY[candidate.parentType] ?? 10;
        if (!best || priority < best.priority) {
          best = {
            parentType: candidate.parentType,
            parentId: candidate.stableId,
            priority,
            distance: 0,
          };
        }
      }
      return;
    }
    if (candidate.geometryType === "line") {
      const minDistance = candidate.paths.reduce((min, path) => {
        for (let i = 0; i < path.length - 1; i += 1) {
          const distance = distancePointToSegment(point, path[i], path[i + 1]);
          if (distance < min) {
            min = distance;
          }
        }
        return min;
      }, Infinity);
      if (minDistance <= LINE_ASSOCIATION_DISTANCE) {
        const priority = PARENT_PRIORITY[candidate.parentType] ?? 10;
        if (
          !best ||
          priority < best.priority ||
          (priority === best.priority && minDistance < best.distance)
        ) {
          best = {
            parentType: candidate.parentType,
            parentId: candidate.stableId,
            priority,
            distance: minDistance,
          };
        }
      }
    }
  });
  if (!best) {
    return null;
  }
  return { parentType: best.parentType, parentId: best.parentId };
}

function appendDerivedLabelPois(features, poiFeatures, summary) {
  let derivedCount = 0;
  (features || []).forEach((feature, index) => {
    const parentType = normalizeParentType(feature.properties?.featureType);
    if (!parentType) return;
    const name = resolveName(feature.properties || {});
    if (!name) return;
    const stableId = feature.properties?.stableId || feature.id;
    if (!stableId) return;
    const geometry = feature.geometry;
    if (!geometry) return;
    let coordinate = null;
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      coordinate = computePolygonLabelCoordinate(geometry);
    } else if (
      geometry.type === "LineString" ||
      geometry.type === "MultiLineString"
    ) {
      coordinate = computeLineLabelCoordinate(geometry);
    } else if (
      geometry.type === "Point" &&
      Array.isArray(geometry.coordinates)
    ) {
      coordinate = geometry.coordinates;
    }
    if (
      !coordinate ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1])
    ) {
      return;
    }
    const derivedFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: coordinate },
      properties: {
        poiId: `poi-derived-${stableId}-${index}`,
        osmId: stableId,
        name,
        poiType: "label",
        elevation: Number(feature.properties?.elevation ?? 0),
        parentType,
        parentId: stableId,
        sourceType: "label",
        labelTargetType: feature.properties?.featureType || parentType,
        modelType: null,
        sourceTags: { sourceFeatureType: feature.properties?.featureType },
      },
    };
    poiFeatures.push(derivedFeature);
    derivedCount += 1;
  });
  summary.derived = derivedCount;
  summary.total += derivedCount;
  summary.attached += derivedCount;
}

async function main() {
  const loggerModule = await loadModule("../app/src/logger/logger.js");
  const { logInfo, logWarn, logError } = loggerModule;
  const coordinatesModule = await loadModule("../app/src/lib/coordinates.js");
  ({ findProjectionOrigin, projectCoordinate } = coordinatesModule);
  const configModule = await loadModule("../app/src/config/index.js");
  const config = configModule.config || configModule;

  try {
    logInfo("POI 提取", "开始生成 POI 数据", { 输入: tmpGeojsonPath });
    const tmpData = JSON.parse(readFileSync(tmpGeojsonPath, "utf8"));
    const campusData = JSON.parse(readFileSync(campusGeojsonPath, "utf8"));

    const boundaryFeature = (campusData.features || []).find(
      (feature) => feature.properties?.featureType === "campusBoundary"
    );
    const boundaryPolygons =
      boundaryFeature?.geometry?.type === "Polygon"
        ? [boundaryFeature.geometry.coordinates]
        : boundaryFeature?.geometry?.type === "MultiPolygon"
        ? boundaryFeature.geometry.coordinates
        : [];
    const projectionOrigin = findProjectionOrigin(campusData.features || []);
    const parentCandidates = buildParentCandidates(
      campusData.features || [],
      projectionOrigin
    );
    const singleFloorHeight = resolveSingleFloorHeight(config);

    const summary = {
      generatedAt: new Date().toISOString(),
      source: tmpGeojsonPath,
      total: 0,
      independent: 0,
      attached: 0,
      derived: 0,
      missingName: 0,
      missingElevation: 0,
    };

    const poiFeatures = [];
    (tmpData.features || []).forEach((feature, index) => {
      if (!feature || feature.geometry?.type !== "Point") {
        return;
      }
      const props = feature.properties || {};
      const name = resolveName(props);
      if (!name) {
        summary.missingName += 1;
        return;
      }
      const coordinate = feature.geometry.coordinates;
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        return;
      }
      if (
        boundaryPolygons.length &&
        !isPointInsideBoundary(coordinate, boundaryPolygons)
      ) {
        return;
      }

      const poiType = resolvePoiType(props);
      const projectedPoint = projectCoordinate(coordinate, projectionOrigin);
      const parentInfo =
        projectedPoint && name
          ? findParentCandidate(projectedPoint, parentCandidates)
          : null;
      const elevation = resolveElevation(props, singleFloorHeight);
      const poiId = buildPoiId(feature.id || props.id, index);

      const poiFeature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: coordinate,
        },
        properties: {
          poiId,
          osmId: feature.id || props.id || poiId,
          name,
          poiType,
          elevation,
          parentType: parentInfo?.parentType ?? null,
          parentId: parentInfo?.parentId ?? null,
          sourceType: "poi",
          labelTargetType: null,
          modelType: null,
          sourceTags: pickSourceTags(props),
        },
      };

      poiFeatures.push(poiFeature);
      summary.total += 1;
      if (poiFeature.properties.parentId) {
        summary.attached += 1;
      } else {
        summary.independent += 1;
      }
      if (poiFeature.properties.elevation === 0) {
        summary.missingElevation += 1;
      }
    });

    appendDerivedLabelPois(
      campusData.features || [],
      poiFeatures,
      summary
    );

    const output = {
      type: "FeatureCollection",
      features: poiFeatures,
    };
    const serialized = JSON.stringify(output, null, 2);

    mkdirSync(join(projectRoot, "data"), { recursive: true });
    mkdirSync(join(projectRoot, "app", "src", "data"), { recursive: true });
    mkdirSync(reportDir, { recursive: true });

    writeFileSync(dataOutputPath, serialized, "utf8");
    writeFileSync(appDataOutputPath, serialized, "utf8");
    writeFileSync(reportPath, JSON.stringify(summary, null, 2), "utf8");

    logInfo("POI 提取", "POI 数据生成完成", {
      输出: appDataOutputPath,
      总数: summary.total,
      独立: summary.independent,
      附属: summary.attached,
    });
  } catch (error) {
    logError("POI 提取", "POI 数据生成失败", {
      错误: error?.message ?? "未知错误",
    });
    process.exit(1);
  }
}

main();
