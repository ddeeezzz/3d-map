# 数据流程 Spec

## 目标
- 从 `t2/map.osm` 提取校园建筑、道路、水系等要素，生成可供 Three.js / deck.gl 使用的 GeoJSON 数据及统计信息。

## 数据源与输出
- 输入：`t2/map.osm`（单一来源）
- 输出：
  - `t2/app/src/data/campus.geojson`：清洗后的主数据集，包含建筑高度、分类、稳定 ID。
  - `t2/data/reports/campus-summary.json`：特征数量、缺失高度统计、转换耗时等摘要。

## 流程步骤
**第一阶段：生成临时 GeoJSON**
1. 使用 `osmtogeojson` 将 `t2/map.osm` 转成临时 GeoJSON，写入 `t2/data/tmp.json`，仅用于分析与规划。

**第二阶段：正式清洗与输出**
2. 清洗脚本（Node/JS）：
   - **要素筛选**：
     - 建筑：`properties.building` 存在且不为 `no`，保留 Polygon/MultiPolygon，写入 `featureType = "building"`。
     - 道路：`properties.highway` 存在，保留 LineString，写入 `featureType = "road"`。
     - 水系：`properties.natural = "water"` 或 `properties.water` 包含 `lake/pond`，以及 `landuse = "reservoir"` 等情况，统一写入 `featureType = "lake"`，仅保留 Polygon/MultiPolygon 用于三维水面。
   - **高度补全**：
     - 若 `height` 可解析为数字则直接使用。
     - 否则使用 `building:levels × config.heights["1层"]`。
     - 再次缺失时根据分类查 `config.heights[category]`，仍无则 `config.heights.默认`。
     - 结果写入 `properties.elevation`，并统计缺失数量。
   - **分类映射**：
     - 按映射表将 `building` 值映射到中文分类（示例：`dormitory`→“宿舍”、`university`→“教学楼”），映射表与 `config.colors` 对齐。
     - 写入 `properties.category`，匹配失败则标记为“默认”。
   - **ID 与元数据**：
     - 生成 `properties.stableId = \`\${feature.type}/\${feature.id}\``，用于前端/报告追踪。
     - 可附加 `properties.sourceTag` 记录原始 `building` 或 `highway` 值。
   - **几何处理**：
     - 对 Polygon/MultiPolygon 去除重复点、确保顺时针方向（例如使用 `@turf/clean-coords`、`@turf/rewind`）。
     - 为建筑可选计算 `properties.centroid`、`properties.area`（基于 turf），供 UI 使用。
   - **水系补充字段**
     - 若存在 `name`、`water`、`waterway` 等属性，写入 `properties.name`、`properties.waterType`，便于渲染与 tooltip。
     - 可在 `properties.sourceTag` 中记录 `{ natural, water, landuse }` 等原始标签，并在报告中统计水体数量与面积。
   - **日志**：
     - 处理流程关键节点需要 `logger.logInfo`（加载开始、要素统计、写入完成）。
     - 异常或缺失情况使用 `logWarn` / `logError`。
3. 输出：
   - 将清洗结果写入 `t2/app/src/data/campus.geojson`。
   - 在 `t2/data/reports/campus-summary.json` 中记录摘要（特征数量、分类统计、缺失高度等）。
4. 校验：
   - 对比转换前后的特征数量。
   - 输出缺失高度列表或日志，必要时补表。

**第三阶段（置后实现）：范围裁剪**
- 待前端地图可正常渲染后，再引入边界裁剪步骤：
  - 获取校区边界（如 `way/207566638` 或自定义多边形），使用 `@turf/boolean-within`/`boolean-intersects` 剪除校园外建筑/道路。
  - 可设外层缓冲以保留环校主干道，剔除范围记录到报告中。

## 配置引用
- 默认高度：使用 `src/config/index.js` 中的 `config.heights`，顺序为：
  1. 若 OSM 节点自带 `height`（数字），优先采用；
  2. 其次用 `building:levels × config.heights["1层"]`；
  3. 仍缺失时，根据建筑类型匹配 `config.heights[分类]`，没有匹配则用 `config.heights.默认`。
- 分类字典：临时通过 `config.colors` 的键来匹配建筑类别（教学楼、宿舍等）。若未来需要独立字典，再补充 spec。
- 输出路径：清洗后的 GeoJSON 固定在 `t2/app/src/data/campus.geojson`；其他报告放在 `t2/data/reports/`，避免混入前端源码。

## TODO
- [x] 第一阶段：编写 `tools/convert-osm.js`（pnpm script），仅将 `t2/map.osm` 转成 `t2/data/tmp.json`。
- [x] 第二阶段：在 `tmp.json` 基础上实现清洗脚本，输出 `campus.geojson` 与报表。
- [ ] 第三阶段（地图渲染稳定后）：补充边界裁剪逻辑与剔除统计。
