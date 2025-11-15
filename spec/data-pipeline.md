# 数据流程 Spec

## 目标
- 从 `t2/map.osm` 提取校园建筑、道路、水系（面状湖泊 + 线状河流）、围墙与场地等要素，生成 Three.js / deck.gl 可直接消费的 GeoJSON 与统计报告。

## 数据源与输出
- **输入**：`t2/map.osm`（唯一数据源）。
- **输出**：
  - `t2/app/src/data/campus.geojson`：清洗后的 FeatureCollection，包含 `featureType`、稳定 ID、补全属性等。
  - `t2/data/reports/campus-summary.json`：记录建筑/道路/湖泊/河流/围墙/场地数量、缺失高度及耗时摘要。

## 流程
### 1. 临时 GeoJSON
- 使用 `osmtogeojson` 将 `map.osm` 转换为 `data/tmp.json`，仅用于分析与后续清洗脚本输入。

### 2. 正式清洗（`tools/clean-geojson.js`）
1. **要素筛选**
   - 建筑：`building` 存在且不为 `no`，保留 Polygon/MultiPolygon，写入 `featureType = "building"`。
   - 道路：`highway` 存在，保留 LineString/MultiLineString，写入 `featureType = "road"`。
   - 面状水系：`natural = water`、`water` 属于 `lake/pond/reservoir` 或 `landuse = reservoir`，保留 Polygon/MultiPolygon，写入 `featureType = "lake"`。
   - 线状水系：`waterway = river` 的 LineString/MultiLineString，写入 `featureType = "river"`。
   - 围墙：`amenity = university` 且 `name = "西南交通大学（犀浦校区）"` 的 Polygon/MultiPolygon，写入 `featureType = "campusBoundary"`。
   - 场地：`amenity = parking`、`leisure = stadium/track/swimming_pool` 或 `landuse = construction`，仅保留 Polygon/MultiPolygon，写入 `featureType = "site"`。
   - 绿化：`natural` 属于 `wood/tree_row/scrub/grass/meadow`（不再使用 `natural = forest`），或 `landuse = grass/forest`；保留 Polygon、MultiPolygon、LineString（tree_row 可继续按线状输出），统一写入 `featureType = "greenery"`。
**校园范围与环校道路**
- 脚本启动即定位 `featureType = "campusBoundary"` 的围墙，缺失时调用 `logError("数据管线", "缺少校园围墙")` 直接终止，确保数据裁剪与渲染共享同一基准。
- 建筑/场地/绿化/水体 Polygon 或 MultiPolygon 均需使用 `@turf/booleanPointInPolygon`（必要时 `booleanIntersects`）验证位于围墙内部，通过的写入 `properties.region = "xipu-campus"`，未通过的记入 `summary.rangeFilter.filteredOut`。
- 道路数据按位置拆分：中心点位于围墙内的标记为 `roadScope = "campus"`；其余候选基于 `@turf/buffer(config.boundary.roadBufferMeters ?? 250)` 计算缓冲区并判断是否与 LineString/MultiLineString 相交，命中的写 `roadScope = "perimeter"` 并通过 `@turf/nearestPointOnLine` 计算 `properties.distanceToCampus`（米），超出缓冲范围的直接丢弃。
- 绿化、河流、湖泊若仅与围墙边界相交，同样需要 `booleanIntersects` 判断，并在 `summary.rangeFilter.kept` 中同步记录过滤结果，方便统计裁剪前后差异。
2. **高度补全（建筑）**
   - 优先使用 `height` 数值；否则使用 `building:levels × config.heights["1层"]`；若仍缺失则查 `config.heights[category]`，最后回退 `config.heights.默认`；结果写入 `properties.elevation` 并统计缺失次数。
3. **场地属性补全**
   - 根据命中标签写入 `properties.siteCategory`，优先级：`stadium > track > swimming_pool > parking > construction`。
   - `properties.displayName = properties.name ?? "未命名场地"`，并保留原始 `name` 于 `sourceTag`。
   - 若 `sports` 同时存在，写入 `properties.sportsType = properties.sports`。
   - 场地高度统一写入 `config.site.height`（若缺失则回退 `config.heights.site ?? config.heights.默认`），用于矮柱挤出；渲染阶段如需分类高度，可通过 `config.site.categoryHeights` 覆盖；`sourceTag` 需记录 `{ amenity, leisure, landuse, sports }`。
4. **分类映射（建筑）**
   - 根据 `building` 标签映射到 `config.colors` 中已存在的分类（教学楼、宿舍等），写入 `properties.category`，无法匹配时记为“默认”。
5. **ID 与元数据**
   - 生成 `properties.stableId`（优先使用 OSM 自带 ID），便于前端与日志追踪。
   - `properties.sourceTag` 记录原始标签（`building`、`highway`、`natural`、`waterway`、`amenity` 等）。
6. **几何处理**
   - Polygon/MultiPolygon 使用 `@turf/clean-coords` 去重、`@turf/rewind` 统一方向；可选计算 `properties.centroid` 供 UI 使用。
7. **附加字段**
   - 线状绿化：若 `natural = tree_row`，后续建模沿用河道 offset，但统一读取 `config.greenery.width/height/baseY` 作为条带参数，无需再区分子类型。
   - 面状绿化：Polygon/MultiPolygon 直接写入 `featureType = "greenery"`，渲染时读取 `config.greenery.surfaceDepth/surfaceBaseY` 控制挤出厚度与底边高度。
   - 面状水系：补齐 `properties.name`、`properties.waterType`，并在 `sourceTag` 中保留 `{ natural, water, landuse }`。
   - 线状水系：保留 `properties.name`，写入 `properties.waterType = "river"`，并在 `sourceTag` 中记录 `{ waterway }`。
   - 围墙：写入 `properties.boundaryType = "campus"`，并保留 `{ amenity, name, id }`。同时收集 `amenity=gate` 或 `barrier=gate` 节点，匹配到最近的围墙边，写入 `properties.boundaryGates = [{ stableId, center: [lng, lat], width, depth, tangent }]`，其中 width/depth 单位为米（默认参考 `config.boundary.gateWidth`/`gateDepth`），`tangent` 为顺时针切线方向，供渲染阶段生成门洞。
   - 道路：写入 `properties.roadScope`（`campus` 或 `perimeter`），并在环校道路上附加 `properties.distanceToCampus`（米）与 `properties.region = "xipu-campus"`，便于 UI 在 InfoCard/调试面板展示距离信息。
   - 绿化：保留 `properties.name`（若存在），写入 `properties.greenType = natural ?? landuse`（`forest` 仅会来源于 `landuse`），并在 `sourceTag` 中记录 `{ natural, landuse }`。
   - 场地：面状要素维持清洗后的坐标，不额外偏移；统计 `summary.sites.total` 与 `summary.sites.byCategory`，并在日志中输出命中数量与缺失 name/sports 的条目。
8. **日志**
   - 关键节点使用 `logInfo`（加载、分类统计、写入完成），异常或缺失使用 `logWarn` / `logError`。
9. **输出**
   - 清洗结果写入 `app/src/data/campus.geojson`，统一使用 `JSON.stringify(result, null, 2)`（或等价缩进）输出，保证多行可读性。
   - 统计信息写入 `data/reports/campus-summary.json`，同样采用 2 空格缩进，便于 diff 与人工审核。
   - `summary.rangeFilter` 记录建筑/道路/绿化/水系的保留与剔除数量，`summary.perimeterRoads` 记录环校道路长度/数量/缓冲参数，方便回溯过滤策略。

### 3. 后续阶段
- 如需扩大环校缓冲距离或引入更多外部街区，需先在本 spec 登记参数，再更新 `config.boundary.roadBufferMeters` 与 `summary.perimeterRoads` 的统计口径。
- 若将来需要加载更多数据源（如 `osmium` 增量更新），需补充转换脚本及回归指标，确保 `campus.geojson` 仍可直接被 Three.js 与 deck.gl 消费。

## 配置引用
- `config.heights`：提供高度补全的层高与分类默认值。
- `config.colors`：提供建筑/水系/围墙颜色映射。
- `config.boundary`：提供围墙厚度与挤出高度。
- `config.waterway`：提供线状水系（width/height/baseY）与面状水体（surfaceDepth/surfaceBaseY）的统一配置，示例：`{ width: 5, height: 0.2, baseY: -0.4, surfaceDepth: 1, surfaceBaseY: 0 }`。
- `config.site`：提供场地矮柱的 `height/baseY` 以及配套 `config.heights.site`、`config.colors.site` 映射，确保 Three.js 场地与建筑层级一致。
- `config.dataPath`：清洗结果写入路径（当前 `/src/data/campus.geojson`）。

## TODO
- [x] `tools/convert-osm.js` 生成 `data/tmp.json`。
- [x] `tools/clean-geojson.js` 输出 `campus.geojson` 与报告。
- [ ] 实现围墙/边界裁剪并在报告中记录（待前端渲染稳定后）。

