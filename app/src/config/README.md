# config

集中维护渲染、交互、数据加载所需的常量配置。所有模块必须通过 `import config from "../config/index.js"` 读取，禁止在业务文件中硬编码颜色、高度、路径等。

## `index.js` 导出内容

- `colors`：建筑/道路/围墙/水系/场地等颜色映射。
- `heights`：层数 → 高度映射及默认值。
- `layers`：LayerToggle 列表，含 `key/name/order/visible`。
- `roadWidths`、`road`：道路宽度估算与挤出高度/底边。
- `boundary`、`waterway`、`greenery`、`site`：围墙、水系、绿化、场地的拉伸参数。
- `buildingOverrides`：按名称覆盖高度/材质。
- `guidePanels`、`highlight`、`poiRoute` 等交互配置。
- `dataPath`：静态 GeoJSON 相对路径。

若需新增字段，必须：
1. 先在 `spec/config.md` 说明用途与格式；
2. 更新 `index.js` 并添加中文注释；
3. 在关联模块（Three.js、UI、store）中引用；
4. 补充对应测试或文档。

## 使用准则

- React/Three.js/deck.gl/数据脚本应仅依赖本文件，确保参数来源一致。
- 所有配置项以纯对象导出，避免在 `index.js` 中执行逻辑。
- 变更颜色或高度前需确认与数据清洗、渲染结果兼容，并在 PR 中附上说明/截图。
- `config.layers` 与 `store.layerVisibility`、`spec/ui.md` 的列表顺序必须一致。

## 测试与回归

- `src/tests/three/*.test.js`、`src/tests/lib/*.test.js` 会使用配置值验证几何尺寸；修改配置后需跑 `pnpm run test`。
- 数据清洗脚本引用配置时，应在 `t2/data/reports/` 中记录 diff，防止参数漂移。
