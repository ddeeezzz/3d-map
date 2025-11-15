/**
 * POI 图层构建模块
 *
 * 职责：
 * - 读取 data/pois.geojson，生成 Three.js Sprite 作为文字精灵
 * - 控制 Sprite 可见性、缩放、用户数据，便于后续交互模块使用
 * - 向外暴露 setVisible / updateLabelScale / getPoiById 供 App.jsx 管理
 */

import * as THREE from "three";
import config from "../config/index.js";
import {
  findProjectionOrigin,
  projectCoordinate,
} from "../lib/coordinates.js";
import rawPoiGeojson from "../data/pois.geojson?raw";
import rawCampusGeojson from "../data/campus.geojson?raw";

const poiData = JSON.parse(rawPoiGeojson);
const campusData = JSON.parse(rawCampusGeojson);
const POI_GROUP_NAME = "pois";

/** 默认样式参数，防止配置缺失 */
const defaultPoiStyle = {
  labelFont: "24px 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
  labelColor: "#ffffff",
  labelBackground: "rgba(15, 23, 42, 0.85)",
  labelBorderColor: "rgba(56, 189, 248, 0.9)",
  labelBorderWidth: 2,
  labelPadding: { x: 14, y: 8 },
  labelHeight: 6,
  spriteScale: 0.06,
  scaleReferenceDistance: 400,
  minScale: 0.5,
  maxScale: 2,
};

/** 将配置与默认值合并 */
function resolvePoiStyle() {
  const style = config.poi || {};
  return {
    ...defaultPoiStyle,
    ...style,
    labelPadding: {
      x: style.labelPadding?.x ?? defaultPoiStyle.labelPadding.x,
      y: style.labelPadding?.y ?? defaultPoiStyle.labelPadding.y,
    },
  };
}

/**
 * 绘制圆角矩形，供 Canvas 作为背景
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 创建 Sprite 材质及对应像素尺寸
 * @returns {{ material: THREE.SpriteMaterial, width: number, height: number } | null}
 */
function createLabelMaterial(text, style) {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const font = style.labelFont || defaultPoiStyle.labelFont;
  context.font = font;
  const metrics = context.measureText(text);
  const fontSize =
    parseInt(font.replace(/[^0-9]/g, ""), 10) || defaultPoiStyle.labelHeight * 10;
  const paddingX = style.labelPadding?.x ?? defaultPoiStyle.labelPadding.x;
  const paddingY = style.labelPadding?.y ?? defaultPoiStyle.labelPadding.y;
  const borderWidth = style.labelBorderWidth ?? defaultPoiStyle.labelBorderWidth;
  const backgroundWidth = metrics.width + paddingX * 2 + borderWidth * 2;
  const backgroundHeight = fontSize + paddingY * 2 + borderWidth * 2;
  canvas.width = Math.ceil(backgroundWidth);
  canvas.height = Math.ceil(backgroundHeight);
  context.font = font;
  context.textBaseline = "middle";
  context.textAlign = "center";

  const hasBorder = borderWidth > 0;
  if (style.labelBackground) {
    context.fillStyle = style.labelBackground;
    if (hasBorder) {
      drawRoundedRect(
        context,
        borderWidth,
        borderWidth,
        canvas.width - borderWidth * 2,
        canvas.height - borderWidth * 2,
        12
      );
      context.fill();
    } else {
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  if (hasBorder && style.labelBorderColor) {
    context.lineWidth = borderWidth;
    context.strokeStyle = style.labelBorderColor;
    drawRoundedRect(
      context,
      borderWidth / 2,
      borderWidth / 2,
      canvas.width - borderWidth,
      canvas.height - borderWidth,
      12
    );
    context.stroke();
  }

  context.fillStyle = style.labelColor || defaultPoiStyle.labelColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return {
    material: new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * 基于 GeoJSON Feature 创建 Sprite
 */
function createPoiSprite(feature, style, origin) {
  const properties = feature.properties || {};
  const name = properties.name?.trim();
  if (!name) {
    return null;
  }
  const coordinate = feature.geometry?.coordinates;
  if (
    !Array.isArray(coordinate) ||
    coordinate.length < 2 ||
    !Number.isFinite(coordinate[0]) ||
    !Number.isFinite(coordinate[1])
  ) {
    return null;
  }
  const [projectedX, projectedY] = projectCoordinate(coordinate, origin);
  if (!Number.isFinite(projectedX) || !Number.isFinite(projectedY)) {
    return null;
  }
  const worldX = projectedX;
  const worldZ = -projectedY;

  const materialInfo = createLabelMaterial(name, style);
  if (!materialInfo) {
    return null;
  }

  const sprite = new THREE.Sprite(materialInfo.material);
  const spriteScale = style.spriteScale ?? defaultPoiStyle.spriteScale;
  const baseWidth = materialInfo.width * spriteScale;
  const baseHeight = materialInfo.height * spriteScale;
  sprite.scale.set(baseWidth, baseHeight, 1);
  sprite.position.set(
    worldX,
    Number(properties.elevation ?? 0) + (style.labelHeight ?? defaultPoiStyle.labelHeight),
    worldZ
  );
  sprite.renderOrder = 5;
  sprite.userData = {
    poiId: properties.poiId,
    parentId: properties.parentId,
    parentType: properties.parentType,
    poiType: properties.poiType,
    name,
    labelSize: { width: baseWidth, height: baseHeight },
  };
  return sprite;
}

/**
 * 构建 POI Group，并返回操作句柄
 */
export function buildPois(scene) {
  if (!scene) {
    throw new Error("scene is required");
  }

  const style = resolvePoiStyle();
  const group = new THREE.Group();
  group.name = POI_GROUP_NAME;
  const poiMap = new Map();
  const spriteList = [];
  let independentCount = 0;
  const projectionOrigin = findProjectionOrigin(campusData.features || []);

  (poiData.features || []).forEach((feature) => {
    const sprite = createPoiSprite(feature, style, projectionOrigin);
    if (!sprite) return;
    spriteList.push(sprite);
    group.add(sprite);
    const properties = feature.properties || {};
    if (!properties.parentId) {
      independentCount += 1;
    }
    poiMap.set(properties.poiId, {
      ...properties,
      sprite,
    });
  });

  scene.add(group);

  const referenceDistance = style.scaleReferenceDistance ?? defaultPoiStyle.scaleReferenceDistance;
  const minScale = style.minScale ?? defaultPoiStyle.minScale;
  const maxScale = style.maxScale ?? defaultPoiStyle.maxScale;

  const updateLabelScale = (camera) => {
    if (!camera || referenceDistance <= 0) return;
    spriteList.forEach((sprite) => {
      const baseSize = sprite.userData?.labelSize;
      if (!baseSize) return;
      const worldPosition = new THREE.Vector3();
      sprite.getWorldPosition(worldPosition);
      const distance = camera.position.distanceTo(worldPosition);
      let ratio = distance / referenceDistance;
      ratio = Math.min(maxScale, Math.max(minScale, ratio));
      sprite.scale.set(baseSize.width * ratio, baseSize.height * ratio, 1);
    });
  };

  return {
    group,
    setVisible: (visible) => {
      group.visible = Boolean(visible);
    },
    updateLabelScale,
    getPoiById: (poiId) => poiMap.get(poiId) || null,
    stats: {
      total: poiMap.size,
      independent: independentCount,
    },
  };
}
