# 配置策略 Spec

## 目标
- 以最小结构集中管理颜色、默认高度、图层开关等关键参数，避免分散在多个文件。

## 文件
- `src/config/index.js`：唯一入口，导出下列字段：
  - `colors`：建筑/道路/水系/围墙等颜色映射（示例：教学楼 `#4A90E2`、围墙 `#f5deb3`）。
  - `heights`：默认高度/层高映射，供数据清洗和建模挤出使用。
  - `layers`：LayerToggle/Debug 面板可见性配置；新增围墙图层 `{ name: "围墙", key: "boundary", visible: true, order: 12 }`。
  - `roadWidths`：道路宽度估算表（`motorway`~`footway`）以及 `默认` 退化值。
  - `boundary`：围墙厚度/高度配置（目前 `width = 1`、`height = 2`），供 `buildBoundary` 复用。
  - `waterway`：线状水系（如 `waterway = river`）的宽度/厚度配置，例如 `waterway: { river: { width: 5, height: 1 } }`，供后续渲染模块引用。
  - `dataPath`：GeoJSON 数据静态导入路径，保持 `/src/data/campus.geojson`。
- 若后续需要主题或更多配置，再在此文件内扩展字段（不拆分额外 JSON）。
- `config.json`：仍保留空缺；未在 spec 声明前禁止创建。

## 使用约定
- 数据管线高度补全引用 `config.heights`；围墙渲染需要 `config.boundary` 提供厚度/高度。
- Three.js / deck.gl 材质颜色统一从 `config.colors` 读取。
- LayerToggle 根据 `config.layers` 自动生成选项及默认可见性。
- 道路宽度估算在 `buildRoads` 与后续测试中引用 `config.roadWidths`；线状水系厚度/高度在 `buildWaterway` 等模块引用 `config.waterway`。
- 任何模块新增配置字段前，须先在本 spec 说明后再改 `index.js`。

## TODO
- [x] 在 `src/config/index.js` 写入示例结构（已创建 `config` 对象，包含颜色映射、默认高度、图层配置）。
- [x] 在 `spec/data-pipeline.md` 补充高度/围墙配置引用说明。
- [ ] 在 `spec/ui.md` 记录 LayerToggle 与 `config.layers` 的映射逻辑。
