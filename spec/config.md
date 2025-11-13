# 配置规范 Spec

## 目标
- 以统一方式维护颜色、默认高度、图层可见性及线状几何的宽/高等关键参数，避免在多处硬编码。

## 文件
- `src/config/index.js`：集中导出下列字段，供数据清洗与 Three.js 渲染复用：
  - `colors`：建筑/道路/水系/围墙等颜色映射，例如教学楼 `#4A90E2`、围墙 `#f5deb3`。
  - `heights`：默认高度或层高映射，支持 `1层`、分类默认值等。
  - `layers`：LayerToggle 与 Debug 面板使用的图层配置，例如 `{ name: "围墙", key: "boundary", visible: true, order: 12 }`。
  - `roadWidths`：道路宽度估算表（`motorway`~`footway` + `默认`）。
  - `boundary`：围墙厚度/高度配置，例如 `{ width: 1, height: 2 }`。
  - `waterway`：线状水系（如 `river`）挤出宽度与高度，例如 `{ river: { width: 5, height: 1 } }`。
  - `greenery`：线状或面状绿化的额外参数，尤其是 `treeRow: { width, height }` 供围墙式挤出参考。
  - `dataPath`：静态 GeoJSON 相对路径（当前 `/src/data/campus.geojson`）。
- 若新增配置项，需先在本 spec 说明再更新 `index.js`。

## 使用约定
- 数据清洗脚本：高度补全引用 `config.heights`，围墙厚度使用 `config.boundary`，河道/树行宽高分别来自 `config.waterway`、`config.greenery`。
- Three.js / deck.gl 渲染：材质颜色统一从 `config.colors` 获取；LayerToggle 基于 `config.layers` 初始化可见性；道路厚度读取 `config.roadWidths`。
- 线状 tree_row 建模：如需像河道一样挤出，必须读取 `config.greenery.treeRow.width/height`，避免重复配置。

## TODO
- [x] `src/config/index.js` 写入示例结构（已完成）。
- [x] 在 `spec/data-pipeline.md` 记录高度/围墙/河道/绿化配置的引用关系（已完成）。
- [ ] 在 `spec/ui.md` 说明 LayerToggle 与 `config.layers` 的映射逻辑。
