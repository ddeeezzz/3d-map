#!/usr/bin/env node
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { resolve, join } = require("path");
const { pathToFileURL } = require("url");
const cleanCoords = require("../app/node_modules/@turf/clean-coords").default;
const rewind = require("../app/node_modules/@turf/rewind").default;
const centroid = require("../app/node_modules/@turf/centroid").default;
const GREENERY_NATURAL = new Set(["wood", "forest", "tree_row", "scrub", "grass", "meadow"]);
const GREENERY_LANDUSE = new Set(["grass"]);

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

function parseNumeric(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const num = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : null;
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

function detectGreeneryType(props) {
  const natural = (props.natural || "").toLowerCase();
  if (natural && GREENERY_NATURAL.has(natural)) {
    return natural;
  }
  const landuse = (props.landuse || "").toLowerCase();
  if (landuse && GREENERY_LANDUSE.has(landuse)) {
    return landuse;
  }
  return null;
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

async function main() {
  const config = await loadModule("../app/src/config/index.js");
  const loggerModule = await loadModule("../app/src/logger/logger.js");
  const { logInfo, logWarn, logError } = loggerModule;

  try {
    logInfo("数据管线", "开始清洗临时数据", { 输入: tmpPath });

    const raw = JSON.parse(readFileSync(tmpPath, "utf8"));
    const summary = {
      total: raw.features.length,
      kept: 0,
      buildings: 0,
      roads: 0,
      lakes: 0,
      rivers: 0,
      boundaries: 0,
      greenery: 0,
      filtered: 0,
      missingElevation: 0,
      categories: {},
      waterTypes: {},
    };

    const cleanedFeatures = [];

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

        cleanedFeatures.push({
          type: "Feature",
          geometry: cleanedGeometry,
          properties: newProps,
        });

        summary.kept++;
        summary.boundaries++;
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
    });
  } catch (error) {
    logError("数据管线", "清洗失败", { 错误: error.message });
    process.exit(1);
  }
}

main();
