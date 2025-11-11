# 数据流程 Spec

## 目标
- 从 `t2/map.osm` 提取校园建筑、道路、水系等要素，得到可供 Three.js/deck.gl 消费的 GeoJSON 与统计信息。

## 数据源与输出
- 输入：`t2/map.osm`（单一来源）。
- 输出：
  - `t2/app/src/data/campus.geojson`：主数据集，包含建筑及其高度、分类、ID。
  - `t2/data/reports/campus-summary.json`：特征数量、缺失高度统计、转换时间。

## 流程步骤
1. 使用 `osmtogeojson` 将 `t2/map.osm` 转成临时 GeoJSON（可写入 `t2/data/tmp.json`）。
2. 运行清洗脚本（Node/JS）：
   - 修复自交、多重闭合。
   - 解析 `height` / `building:levels`，按“配置引用”章节的顺序计算 `properties.elevation`。
   - 根据建筑用途贴合分类，写入 `properties.category`（默认对齐 `config.colors` 的键）。
   - 生成稳定 ID（如 `building_<osm_id>`）。
3. 输出：
   - 将结果写入 `t2/app/src/data/campus.geojson`，供前端直接加载。
   - 在 `t2/data/reports/campus-summary.json` 中写入摘要（特征数量、缺失高度统计、运行时间）。
4. 校验：
   - 对比转换前后的特征数量。
   - 输出缺失高度列表或日志，必要时补表。

## 配置引用
- 默认高度：直接引用 `src/config/index.js` 中的 `config.heights`，按以下顺序补全：
  1. 若 OSM 带有 `height` 字段且为数字，优先使用；
  2. 其次读取 `building:levels` × 单层高度（可从 `config.heights["1层"]` 获取单层参考值）；
  3. 若仍缺失，则按建筑类型在 `config.heights` 中查找（如 `config.heights["教学楼"]`），找不到则使用 `config.heights.默认`。
- 分类字典：暂使用 `config.colors` 的键作为分类来源（教学楼、宿舍等），后续如需独立字典再在 spec 中补充。
- 输出路径：规范化为 `t2/app/src/data/campus.geojson`，方便前端直接 `import`；如需保留其他副本，可在 `t2/data/` 生成报告。

## TODO
- [ ] 编写 `tools/convert-osm.js`（pnpm script），第一阶段仅负责生成 `t2/data/tmp.json` 以供清洗脚本调试。
- [ ] 基于 `tmp.json` 梳理清洗方案，确定拓扑修复、分类映射、日志输出等细节后，再实装正式清洗逻辑。
- [ ] 设计数据回归报告格式并写入 CI。
