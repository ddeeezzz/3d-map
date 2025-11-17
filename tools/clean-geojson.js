#!/usr/bin/env node
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { resolve, join } = require("path");
const { pathToFileURL } = require("url");
const cleanCoords = require("../app/node_modules/@turf/clean-coords").default;
const rewind = require("../app/node_modules/@turf/rewind").default;
const centroid = require("../app/node_modules/@turf/centroid").default;
const { detectGreeneryType } = require("./greenery-tags");
/**
 * 场地分类优先级列表，确保按照 stadium → track → swimming_pool → parking → construction 的顺序匹配
 * @type {Array<{ tag: "amenity"|"leisure"|"landuse", value: string }>}
 */
const SITE_CATEGORY_PRIORITY = [
  { tag: "leisure", value: "stadium" },
  { tag: "leisure", value: "track" },
  { tag: "leisure", value: "swimming_pool" },
  { tag: "amenity", value: "parking" },
  { tag: "landuse", value: "construction" },
];
/**
 * 场地默认展示名称，缺少 name 标签时使用
 * @type {string}
 */
const SITE_DEFAULT_DISPLAY_NAME = "未命名场地";

const rootDir = resolve(__dirname, "..");
const dataDir = join(rootDir, "data");
const tmpPath = join(dataDir, "tmp.json");
const outputGeojsonPath = join(rootDir, "app", "src", "data", "campus.geojson");
const reportsDir = join(dataDir, "reports");
const reportPath = join(reportsDir, "campus-summary.json");

const buildingCategoryMap = {
  dormitory: "宿舍",
  apartments: "宿舍",
  residential: "宿舍",
  university: "教学楼",
  school: "教学楼",
  teaching: "教学楼",
  laboratory: "教学楼",
  public: "行政楼",
  office: "行政楼",
  government: "行政楼",
  sports_hall: "体育馆",
  stadium: "体育馆",
  yes: "默认",
};

const singleFloorHeightKey = "1层";
const WATER_TYPES = new Set(["lake", "pond", "reservoir", "basin", "pool"]);
const CAMPUS_NAME = "西南交通大学（犀浦校区）";
/** 地球赤道半径（米），用于简化的平面投影 */
const EARTH_RADIUS = 6378137;
/** 角度到弧度的转换系数 */
const DEG_TO_RAD = Math.PI / 180;

/**
 * 解析数值字段，兼容字符串带单位等场景
 * @param {unknown} value 原始输入
 * @returns {number|null} 解析结果
 */
function parseNumeric(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(String(value).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

async function loadModule(relativePath) {
  const url = pathToFileURL(resolve(__dirname, relativePath)).href;
  const mod = await import(url);
  return mod.default || mod;
}

function determineCategory(buildingTag, config) {
  if (!buildingTag) return "默认";
  const normalized = buildingTag.toLowerCase();
  const mapped = buildingCategoryMap[normalized];
  if (mapped && config.colors[mapped]) {
    return mapped;
  }
  if (config.colors[buildingTag]) {
    return buildingTag;
  }
  return "默认";
}

function computeElevation(props, category, heights) {
  const direct = parseNumeric(props.height);
  if (direct != null) return direct;
  const levels = parseNumeric(props["building:levels"]);
  if (levels != null) {
    const perFloor = parseNumeric(heights[singleFloorHeightKey]) || 3;
    return levels * perFloor;
  }
  if (category && heights[category] != null) {
    return heights[category];
  }
  if (heights.默认 != null) {
    return heights.默认;
  }
  return null;
}

function cleanPolygonGeometry(geometry) {
  if (!geometry || !geometry.type) return null;
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    const cleaned = cleanCoords(geometry);
    return rewind(cleaned, { reverse: false });
  }
  return null;
}

function buildStableId(feature, fallbackIndex) {
  if (feature.id) return feature.id;
  const props = feature.properties || {};
  if (props["@id"]) return props["@id"];
  if (props.id) return `${feature.type || "feature"}/${props.id}`;
  return `feature/${fallbackIndex}`;
}

function isWaterFeature(props, geometry) {
  if (!geometry || !geometry.type) return false;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    return false;
  }
  const natural = (props.natural || "").toLowerCase();
  const water = (props.water || "").toLowerCase();
  const landuse = (props.landuse || "").toLowerCase();
  if (natural === "water") return true;
  if (water && WATER_TYPES.has(water)) return true;
  if (landuse === "reservoir") return true;
  return false;
}

function determineWaterType(props) {
  if (props.water) return props.water;
  if (props.natural) return props.natural;
  if (props.landuse) return props.landuse;
  return null;
}

function buildWaterSourceTag(props) {
  return {
    natural: props.natural,
    water: props.water,
    landuse: props.landuse,
  };
}

/**
 * 根据 OSM 标签判断场地分类
 * @param {object} props GeoJSON 属性对象
 * @returns {string|null} 命中的场地分类标识
 */
function determineSiteCategory(props) {
  if (!props) return null;
  const normalized = {
    amenity: String(props.amenity || "").toLowerCase(),
    leisure: String(props.leisure || "").toLowerCase(),
    landuse: String(props.landuse || "").toLowerCase(),
  };
  for (const rule of SITE_CATEGORY_PRIORITY) {
    if (normalized[rule.tag] === rule.value) {
      return rule.value;
    }
  }
  return null;
}

/**
 * 解析场地挤出高度，优先读取 config.site.height，其次回退至 config.heights.site 与默认高度
 * @param {object} config 全局配置对象
 * @returns {number|null} 可用于挤出的高度
 */
function resolveSiteElevation(props, siteCategory, config) {
  const siteConfig = config.site || {};
  const categoryHeights = siteConfig.categoryHeights || {};
  const categoryValue = parseNumeric(categoryHeights[siteCategory]);
  if (categoryValue != null) {
    return categoryValue;
  }
  const elevationFromProps = parseNumeric(props && props.elevation);
  if (elevationFromProps != null) {
    return elevationFromProps;
  }
  const siteDefault = parseNumeric(siteConfig.height);
  if (siteDefault != null) {
    return siteDefault;
  }
  const heights = config.heights || {};
  const fallback =
    parseNumeric(heights.site) ||
    parseNumeric(heights["默认"]) ||
    parseNumeric(heights.default);
  return fallback ?? null;
}

function isRiverFeature(props, geometry) {
  if (!geometry || !geometry.type) return false;
  const type = geometry.type;
  if (type !== "LineString" && type !== "MultiLineString") return false;
  return (props.waterway || "").toLowerCase() === "river";
}

function isCampusBoundary(props, geometry) {
  if (!geometry || !geometry.type) return false;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    return false;
  }
  const amenity = (props.amenity || "").toLowerCase();
  const name = props.name || props["name:zh"] || props["name:zh-cn"];
  if (amenity !== "university") return false;
  if (!name) return false;
  return name.trim() === CAMPUS_NAME;
}

/**
 * 判断要素是否为可用的校门节点。
 * @param {Record<string, any>} props 要素属性，需包含 amenity/barrier/highway
 * @param {{ type: string, coordinates: any }} geometry GeoJSON 几何
 * @returns {boolean} 是否满足门的判定
 */
function isGateNode(props, geometry) {
  if (!geometry || geometry.type !== "Point") {
    return false;
  }
  const amenity = (props.amenity || "").toLowerCase();
  const barrier = (props.barrier || "").toLowerCase();
  const highway = (props.highway || "").toLowerCase();
  if (amenity === "gate") return true;
  if (barrier === "gate") return true;
  if (highway === "gate") return true;
  return false;
}

/**
 * 将 OSGeo 的门节点整理为后续挖孔所需的结构。
 * @param {Array} features 原始 GeoJSON Feature 列表
 * @param {object} config 全局配置，需包含 boundary 字段
 * @returns {Array} [{ stableId, coordinate, width, depth, name }]
 */
function collectGateCandidates(features, config) {
  const boundaryConfig = config.boundary || {};
  const defaultWidth =
    parseNumeric(boundaryConfig.gateWidth) ||
    parseNumeric(boundaryConfig.width) ||
    6;
  const defaultDepth =
    parseNumeric(boundaryConfig.gateDepth) ||
    parseNumeric(boundaryConfig.width) ||
    3;

  const candidates = [];
  features.forEach((feature, index) => {
    const props = feature.properties || {};
    if (!isGateNode(props, feature.geometry)) return;
    const geometry = feature.geometry;
    if (!geometry || !Array.isArray(geometry.coordinates)) return;

    const stableId = buildStableId(feature, index);
    const width =
      parseNumeric(props.width) ??
      parseNumeric(props["gate:width"]) ??
      parseNumeric(props["opening:width"]) ??
      defaultWidth;
    const depth =
      parseNumeric(props.depth) ??
      parseNumeric(props["gate:depth"]) ??
      defaultDepth;
    const name = props.name || props["name:zh"] || props["name:zh-cn"] || null;

    candidates.push({
      stableId,
      coordinate: geometry.coordinates,
      width,
      depth,
      name,
    });
  });

  return candidates;
}

/**
 * 提取围墙的外环列表，忽略内部挖空。
 * @param {{ type: string, coordinates: any }} geometry GeoJSON 多边形
 * @returns {Array<Array<[number, number]>>} 外环坐标合集
 */
function extractBoundaryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return geometry.coordinates && geometry.coordinates[0]
      ? [geometry.coordinates[0]]
      : [];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || [])
      .map((polygon) => polygon && polygon[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 4);
  }
  return [];
}

/**
 * 依据围墙坐标估算用于平面投影的参考纬度。
 * @param {Array<Array<[number, number]>>} rings 围墙外环
 * @returns {number} 参考纬度（弧度）
 */
function computeLatitudeReference(rings) {
  let latSum = 0;
  let count = 0;
  rings.forEach((ring) => {
    ring.forEach((coord) => {
      latSum += coord[1];
      count++;
    });
  });
  const averageLat = count ? latSum / count : 0;
  return averageLat * DEG_TO_RAD;
}

/**
 * 将经纬度转换为简化平面坐标。
 * @param {[number, number]} coord [lng, lat]
 * @param {number} latRefRad 参考纬度（弧度）
 * @returns {[number, number]} 平面坐标（米）
 */
function projectCoordinate(coord, latRefRad) {
  const cosLat = Math.cos(latRefRad || 0);
  const x = coord[0] * DEG_TO_RAD * EARTH_RADIUS * cosLat;
  const y = coord[1] * DEG_TO_RAD * EARTH_RADIUS;
  return [x, y];
}

/**
 * 计算闭合环的带符号面积，正值代表逆时针，负值代表顺时针。
 * @param {Array<[number, number]>} projectedRing 已投影的环
 * @returns {number} 面积值
 */
function computeRingOrientation(projectedRing) {
  let area = 0;
  for (let i = 0; i < projectedRing.length - 1; i++) {
    const [x1, y1] = projectedRing[i];
    const [x2, y2] = projectedRing[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/**
 * 计算点到线段的最近距离及投影坐标。
 * @param {[number, number]} point 平面坐标点
 * @param {[number, number]} start 线段起点
 * @param {[number, number]} end 线段终点
 * @returns {{ distance: number, closestPoint: [number, number], t: number }}
 */
function projectPointToSegment(point, start, end) {
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
  const distX = point[0] - closestPoint[0];
  const distY = point[1] - closestPoint[1];
  return {
    distance: Math.hypot(distX, distY),
    closestPoint,
    t,
  };
}

/**
 * 在全部围墙环中找到距离校门最近的线段。
 * @param {Array<{ projected: Array<[number, number]>, orientation: number }>} projectedRings 投影后的环
 * @param {[number, number]} coordinate 原始经纬度
 * @param {number} latRefRad 参考纬度（弧度）
 * @returns {object|null} 最近线段信息
 */
function findNearestGateProjection(projectedRings, coordinate, latRefRad) {
  if (!projectedRings.length) return null;
  const gatePoint = projectCoordinate(coordinate, latRefRad);
  let best = null;

  projectedRings.forEach((ring, ringIndex) => {
    const { projected } = ring;
    for (let i = 0; i < projected.length - 1; i++) {
      const start = projected[i];
      const end = projected[i + 1];
      const projection = projectPointToSegment(gatePoint, start, end);
      if (!best || projection.distance < best.distance) {
        best = {
          distance: projection.distance,
          ringIndex,
          segmentIndex: i,
          segmentVector: [end[0] - start[0], end[1] - start[1]],
        };
      }
    }
  });

  if (!best) return null;
  return {
    ...best,
    ring: projectedRings[best.ringIndex],
  };
}

/**
 * 根据线段方向与环朝向构建顺时针的单位切向量。
 * @param {[number, number]} segmentVector 线段向量
 * @param {number} orientation 带符号面积，负值表示顺时针
 * @returns {[number, number]} 顺时针单位切向量
 */
function buildClockwiseTangent(segmentVector, orientation) {
  let [dx, dy] = segmentVector;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;
  if (orientation > 0) {
    dx *= -1;
    dy *= -1;
  }
  return [Number(dx.toFixed(6)), Number(dy.toFixed(6))];
}

/**
 * 将门节点匹配到围墙线段，并返回成功匹配的门洞数组。
 * @param {{ type: string, coordinates: any }} geometry 围墙几何
 * @param {Array} gateCandidates 待匹配的门节点
 * @param {object} boundaryConfig 围墙配置
 * @param {(scope: string, message: string, detail?: object) => void} logWarn 日志方法
 * @returns {{ matches: Array, remaining: Array }} 匹配结果
 */
function attachGatesToBoundary(
  geometry,
  gateCandidates,
  boundaryConfig,
  logWarn,
) {
  if (!gateCandidates.length) {
    return { matches: [], remaining: gateCandidates };
  }

  const rings = extractBoundaryRings(geometry);
  if (!rings.length) {
    return { matches: [], remaining: gateCandidates };
  }

  const latRefRad = computeLatitudeReference(rings);
  const projectedRings = rings.map((ring) => {
    const projected = ring.map((coord) => projectCoordinate(coord, latRefRad));
    return {
      original: ring,
      projected,
      orientation: computeRingOrientation(projected),
    };
  });

  const snapDistance =
    Number(boundaryConfig.gateSnapDistance) ||
    Math.max(boundaryConfig.width || 1, boundaryConfig.gateDepth || 3) * 17;
  const matches = [];
  const remaining = [];

  gateCandidates.forEach((gate) => {
    const projection = findNearestGateProjection(
      projectedRings,
      gate.coordinate,
      latRefRad,
    );

    if (!projection) {
      remaining.push(gate);
      return;
    }

    if (projection.distance > snapDistance) {
      logWarn("数据管线", "校门距离围墙过远，未写入 boundaryGates", {
        gateId: gate.stableId,
        距离米: Number(projection.distance.toFixed(2)),
        阈值米: Number(snapDistance.toFixed(2)),
      });
      remaining.push(gate);
      return;
    }

    matches.push({
      stableId: gate.stableId,
      center: gate.coordinate,
      width: gate.width,
      depth: gate.depth,
      tangent: buildClockwiseTangent(
        projection.segmentVector,
        projection.ring.orientation,
      ),
    });
  });

  return { matches, remaining };
}

async function main() {
  const config = await loadModule("../app/src/config/index.js");
  const loggerModule = await loadModule("../app/src/logger/logger.js");
  const { logInfo, logWarn, logError } = loggerModule;
  try {
    logInfo("数据管线", "开始清洗临时数据", { 输入: tmpPath });

    const raw = JSON.parse(readFileSync(tmpPath, "utf8"));
    let gateCandidates = collectGateCandidates(raw.features, config);
    if (gateCandidates.length) {
      logInfo("数据管线", "已收集校门节点", { 数量: gateCandidates.length });
    }
    const summary = {
      total: raw.features.length,
      kept: 0,
      buildings: 0,
      roads: 0,
      lakes: 0,
      rivers: 0,
      boundaries: 0,
      greenery: 0,
      sites: {
        total: 0,
        byCategory: {},
      },
      filtered: 0,
      missingElevation: 0,
      categories: {},
      waterTypes: {},
    };

    const cleanedFeatures = [];
    /** 记录缺少 name 的场地 stableId 列表，便于日志输出 */
    const siteMissingName = [];
    /** 记录缺少 sports 标签的场地 stableId 列表，主要关注 stadium/track/swimming_pool */
    const siteMissingSports = [];

    raw.features.forEach((feature, index) => {
      const props = feature.properties || {};
      const geometry = feature.geometry;

      if (!geometry || !geometry.type) {
        summary.filtered++;
        logWarn("数据管线", "要素缺少几何，已忽略", { featureId: feature.id || index });
        return;
      }

      const buildingTag = props.building;
      const highwayTag = props.highway;
      const waterFeature = isWaterFeature(props, geometry);
      const riverFeature = isRiverFeature(props, geometry);
      const boundaryFeature = isCampusBoundary(props, geometry);
      const siteCategory = determineSiteCategory(props);

      if (buildingTag && buildingTag !== "no") {
        const cleanedGeometry = cleanPolygonGeometry(geometry);
        if (!cleanedGeometry) {
          summary.filtered++;
          logWarn("数据管线", "建筑几何不支持，已忽略", { featureId: feature.id || index });
          return;
        }

        const category = determineCategory(buildingTag, config);
        const elevation = computeElevation(props, category, config.heights);
        if (elevation == null) summary.missingElevation++;

        const stableId = buildStableId(feature, index);

        let centroidPoint = null;
        try {
          centroidPoint = centroid(cleanedGeometry).geometry.coordinates;
        } catch (_e) {
          centroidPoint = null;
        }

        const newProps = {
          ...props,
          stableId,
          featureType: "building",
          category,
          elevation,
          sourceTag: buildingTag,
        };
        if (centroidPoint) {
          newProps.centroid = centroidPoint;
        }

        cleanedFeatures.push({
          type: "Feature",
          geometry: cleanedGeometry,
          properties: newProps,
        });

        summary.kept++;
        summary.buildings++;
        summary.categories[category] = (summary.categories[category] || 0) + 1;
        return;
      }

      if (highwayTag) {
        const stableId = buildStableId(feature, index);
        cleanedFeatures.push({
          type: "Feature",
          geometry,
          properties: {
            ...props,
            stableId,
            featureType: "road",
            roadType: highwayTag,
          },
        });
        summary.kept++;
        summary.roads++;
        return;
      }

      if (waterFeature) {
        const cleanedGeometry = cleanPolygonGeometry(geometry);
        if (!cleanedGeometry) {
          summary.filtered++;
          logWarn("数据管线", "水系几何不支持，已忽略", { featureId: feature.id || index });
          return;
        }

        const stableId = buildStableId(feature, index);
        const waterType = determineWaterType(props) || "未知";
        const newProps = {
          ...props,
          stableId,
          featureType: "lake",
          waterType,
          sourceTag: buildWaterSourceTag(props),
        };

        cleanedFeatures.push({
          type: "Feature",
          geometry: cleanedGeometry,
          properties: newProps,
        });

        summary.kept++;
        summary.lakes++;
        summary.waterTypes[waterType] = (summary.waterTypes[waterType] || 0) + 1;
        return;
      }

      if (riverFeature) {
        const stableId = buildStableId(feature, index);
        cleanedFeatures.push({
          type: "Feature",
          geometry,
          properties: {
            ...props,
            stableId,
            featureType: "river",
            waterType: "river",
            sourceTag: { waterway: props.waterway },
          },
        });
        summary.kept++;
        summary.rivers++;
        return;
      }

      if (boundaryFeature) {
        const cleanedGeometry = cleanPolygonGeometry(geometry);
        if (!cleanedGeometry) {
          summary.filtered++;
          logWarn("数据管线", "围墙几何不支持，已忽略", { featureId: feature.id || index });
          return;
        }

        const stableId = buildStableId(feature, index);
        const newProps = {
          ...props,
          stableId,
          featureType: "campusBoundary",
          boundaryType: "campus",
          sourceTag: {
            amenity: props.amenity,
            name: props.name,
            id: feature.id || props["@id"],
          },
        };

        const attachResult = attachGatesToBoundary(
          cleanedGeometry,
          gateCandidates,
          config.boundary || {},
          logWarn,
        );
        gateCandidates = attachResult.remaining;
        if (attachResult.matches.length) {
          newProps.boundaryGates = attachResult.matches;
        }

        cleanedFeatures.push({
          type: "Feature",
          geometry: cleanedGeometry,
          properties: newProps,
        });

        summary.kept++;
        summary.boundaries++;
        return;
      }

      if (siteCategory) {
        const cleanedGeometry = cleanPolygonGeometry(geometry);
        if (!cleanedGeometry) {
          summary.filtered++;
          logWarn("数据管线", "场地几何不支持，已忽略", { featureId: feature.id || index });
          return;
        }

        const stableId = buildStableId(feature, index);
        const trimmedName = typeof props.name === "string" ? props.name.trim() : "";
        const hasName = Boolean(trimmedName);
        const displayName = hasName ? trimmedName : SITE_DEFAULT_DISPLAY_NAME;
        const elevation = resolveSiteElevation(props, siteCategory, config);

        const newProps = {
          ...props,
          stableId,
          featureType: "site",
          siteCategory,
          displayName,
          elevation,
          sourceTag: {
            name: props.name,
            amenity: props.amenity,
            leisure: props.leisure,
            landuse: props.landuse,
            sports: props.sports,
          },
        };

        if (props.sports) {
          newProps.sportsType = props.sports;
        }

        if (elevation == null) {
          summary.missingElevation++;
          logWarn("数据管线", "场地高度缺失，请检查配置", {
            stableId,
            siteCategory,
          });
        }

        if (!hasName) {
          siteMissingName.push(stableId);
        }

        const sportsRequired =
          siteCategory === "stadium" ||
          siteCategory === "track" ||
          siteCategory === "swimming_pool";
        if (sportsRequired && !props.sports) {
          siteMissingSports.push(stableId);
        }

        cleanedFeatures.push({
          type: "Feature",
          geometry: cleanedGeometry,
          properties: newProps,
        });

        summary.kept++;
        summary.sites.total++;
        summary.sites.byCategory[siteCategory] =
          (summary.sites.byCategory[siteCategory] || 0) + 1;
        return;
      }

      const greeneryType = detectGreeneryType(props);
      if (greeneryType) {
        let finalGeometry = geometry;
        if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
          finalGeometry = cleanPolygonGeometry(geometry);
          if (!finalGeometry) {
            summary.filtered++;
            logWarn("数据管线", "绿化面几何不支持，已忽略", { featureId: feature.id || index });
            return;
          }
        } else if (geometry.type !== "LineString" && geometry.type !== "MultiLineString") {
          summary.filtered++;
          logWarn("数据管线", "绿化几何不支持，已忽略", {
            featureId: feature.id || index,
            geometry: geometry.type,
          });
          return;
        }

        const stableId = buildStableId(feature, index);
        const newProps = {
          ...props,
          stableId,
          featureType: "greenery",
          greenType: greeneryType,
          sourceTag: {
            natural: props.natural,
            landuse: props.landuse,
          },
        };

        cleanedFeatures.push({
          type: "Feature",
          geometry: finalGeometry,
          properties: newProps,
        });

        summary.kept++;
        summary.greenery++;
        return;
      }

      summary.filtered++;
    });

    if (summary.sites.total) {
      logInfo("数据管线", "场地分类统计", {
        场地总数: summary.sites.total,
        分类统计: summary.sites.byCategory,
      });
      if (siteMissingName.length) {
        logWarn("数据管线", "场地缺少名称条目", { stableIds: siteMissingName });
      }
      if (siteMissingSports.length) {
        logWarn("数据管线", "体育场地缺少 sports 标签", { stableIds: siteMissingSports });
      }
    }

    if (gateCandidates.length) {
      logWarn("数据管线", "仍有校门未匹配围墙", { 数量: gateCandidates.length });
    }

    const output = { type: "FeatureCollection", features: cleanedFeatures };
    mkdirSync(join(rootDir, "app", "src", "data"), { recursive: true });
    writeFileSync(outputGeojsonPath, JSON.stringify(output, null, 2), "utf8");

    mkdirSync(reportsDir, { recursive: true });
    const report = {
      generatedAt: new Date().toISOString(),
      source: tmpPath,
      ...summary,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    logInfo("数据管线", "清洗完成", {
      输出: outputGeojsonPath,
      报告: reportPath,
      建筑数量: summary.buildings,
      道路数量: summary.roads,
      湖泊数量: summary.lakes,
      河流数量: summary.rivers,
      围墙数量: summary.boundaries,
      绿化数量: summary.greenery,
      场地数量: summary.sites.total,
    });
  } catch (error) {
    logError("数据管线", "清洗失败", { 错误: error.message });
    process.exit(1);
  }
}

main();
