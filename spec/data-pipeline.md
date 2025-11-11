# 数据流程 Spec

## 目标
- 从 `t2/map.osm` 提取校园建筑、道路、水系等要素，得到可供 Three.js/deck.gl 消费的 GeoJSON 与统计信息。

## 数据源与输出
- 输入：`t2/map.osm`（单一来源）。
- 输出：
  - `t2/app/src/data/campus.geojson`：主数据集，包含建筑及其高度、分类、ID。
  - `t2/data/reports/campus-summary.json`：特征数量、缺失高度统计、转换时间。

## 流程步骤
1. `osmtogeojson` 转换 → 临时 GeoJSON。
2. 清洗脚本（Node/JS）：
   - 修复自交、多重闭合。
   - 解析 `height` / `building:levels` → 计算 `properties.elevation`。
   - 贴合学院/用途分类，生成 `properties.category`。
   - 生成稳定 ID（如 `building_<osm_id>`）。
3. 校验：
   - 对比转换前后特征数量。
   - 输出缺失高度列表，必要时手动补表。

## 配置项
- 默认层高：`config/height.json`，映射楼层数 → 米。
- 分类字典：`config/category.json`。

## TODO
- [ ] 编写 `tools/convert-osm.js`（pnpm script）。
- [ ] 设计数据回归报告格式并写入 CI。
