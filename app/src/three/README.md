# three

- `initScene.js`：初始化 Scene / Camera / Renderer / OrbitControls，开发模式挂载 Grid/Axes helper，并提供 `resize/start/stop` 接口以便 React 同步视图。
- `buildBuildings.js`：解析 `campus.geojson` 中 `featureType = "building"` 的要素，按 `properties.elevation` 挤出 Mesh，写入 `userData`（stableId/name/category/elevation）供 UI 使用。
- `buildRoads.js`：读取 `featureType = "road"` 线要素，结合 `config.roadWidths` 或属性宽度估算厚度，生成低矮 Extrude Mesh 并记录道路属性。
- `buildBoundary.js`：处理 `featureType = "campusBoundary"` Polygon/MultiPolygon，`sanitizeRing` 保留 OSM 重复节点，`prepareClosedRing` 提前复制首点到末尾，再按 `config.boundary.width/height` 构建围墙 group。
- `buildWater.js`：将 `featureType = "lake"` Polygon/MultiPolygon 投影并生成 1 m 厚的水面 Mesh，材质半透明并带 emissive，统一加入 `water` group。
- `buildWaterway.js`：解析 `featureType = "river"` LineString/MultiLineString，按统一的 `config.waterway` 宽高/底边挤出河道。
- `interactions/buildingPicking.js`：封装建筑拾取逻辑，监听 `pointermove`/`click`，同步 store 的 hovered/selected 状态。
- `interactions/roadPicking.js`：道路 hover 高亮与点击日志，提供 `clearHover`/`dispose`，方便图层显隐管理。
- `interactions/waterPicking.js`：水系 hover/click 反馈，复用回调输出命中水体信息，不写入 store。
- `interactions/boundaryPicking.js`：围墙拾取模块，hover 时把材质 emissive 设为 `#ffe082` 并缓存原色，click 时调用 `logInfo` 输出中文日志，提供 `clearHover`/`dispose` 供图层隐藏或卸载时清理。
