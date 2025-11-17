# 配置规范 Spec

## 目标
- 以统一方式维护颜色、默认高度、图层可见性及线状几何的宽/高等关键参数，避免在多处硬编码。

## 文件
- `src/config/index.js`：集中导出下列字段，供数据清洗与 Three.js 渲染复用：
  - `colors`：建筑/道路/水系/围墙等颜色映射，例如教学楼 `#4A90E2`、围墙 `#f5deb3`。
  - `heights`：默认高度或层高映射，支持 `1层`、分类默认值等。
  - `layers`：LayerToggle 与 Debug 面板使用的图层配置，例如 `{ name: "围墙", key: "boundary", visible: true, order: 12 }`。
- `roadWidths`：道路宽度估算表（`motorway`~`footway` + `默认`）。
- `road`：道路挤出体积的底边与高度，例如 `{ baseY: -2.15, height: 2 }`，通过统一的 2m 体积高度保持顶面高度不变（`baseY + height = -0.15m`）。
- `boundary`：围墙厚度/高度/底边及挖孔参数，例如 `{ width: 1, height: 2, baseY: 18.08, holeInset: 0.35, gateWidth: 6, gateDepth: 3 }`。其中 `height = 2` 统一体积厚度，`baseY` 仅用于维持原有顶面高度；`width + holeInset` 决定向校园外扩展的主墙厚度，不会侵入内侧。
- `waterway`：水系统一参数，包含线状 `width/height/baseY` 与面状 `surfaceDepth/surfaceBaseY`，示例 `{ width: 5, height: 0.2, baseY: -0.4, surfaceDepth: 1, surfaceBaseY: 0 }`。
- `greenery`：绿化统一参数，线状使用 `width/height/baseY`，面状使用 `surfaceDepth/surfaceBaseY`，示例 `{ width: 3, height: 2, baseY: -2.35, surfaceDepth: 2, surfaceBaseY: -2.35 }`，同样遵循“体积高度 2m、顶面保持原位”的约束。
- `site`：场地矮柱参数，包含 `height/baseY` 以及可选 `categoryHeights`（如 `{ track: 3 }`）用于覆盖特定 `siteCategory` 的高度需求，Three.js 渲染阶段会优先读取该分类高度。
- `highlight`：交互高亮配置，目前包含 `navigation`（模型/POI 标签颜色），供导航面板和地点高亮使用。
- `dataPath`：静态 GeoJSON 相对路径（当前 `/src/data/campus.geojson`）。
- `poiRoute`：POI 路线相关配置，包含：
  - `maxSnapDistance`：POI 吸附道路的最大距离（米），默认 20。
  - `highlightMesh = { width, height, yOffset, color, opacity }`：路线光带默认参数，渲染层需从该配置读取宽度/厚度/抬升高度与颜色/透明度，可通过 UI 或 DebugPanel 调整后写回 store。
- 若新增配置项，需先在本 spec 说明再更新 `index.js`。

## 使用约定
- 数据清洗脚本：高度补全引用 `config.heights`，围墙厚度使用 `config.boundary`，河道/绿化参数分别来自 `config.waterway`、`config.greenery`。
- Three.js / deck.gl 渲染：材质颜色统一从 `config.colors` 获取；LayerToggle 基于 `config.layers` 初始化可见性；道路厚度读取 `config.roadWidths`；道路/围墙/河道/绿化的体积高度与底边统一从对应配置读取；场地挤出高度优先读取 `config.site.categoryHeights[siteCategory]`，若未配置再读 `properties.elevation` 或 `config.site.height`。
- 线状绿化建模：所有 `greenType` 共用 `config.greenery.width/height/baseY`；面状绿化挤出厚度与偏移统一取 `surfaceDepth/surfaceBaseY`，如需特例必须先扩展配置规范。

## TODO
- [x] `src/config/index.js` 写入示例结构（已完成）。
- [x] 在 `spec/data-pipeline.md` 记录高度/围墙/河道/绿化配置的引用关系（已完成）。
- [ ] 在 `spec/ui.md` 说明 LayerToggle 与 `config.layers` 的映射逻辑。
