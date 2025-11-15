# POI 标注 Spec

## 背景与阶段目标
- **范围**：处理 `map.osm` 中带有 `name` 标签且位于犀浦校区范围内的所有节点要素，将其作为校园兴趣点（POI）。
- **阶段一（常显文字）**：完成 POI 数据转换与 Three.js 图层 `buildPois`，在场景初始化时为所有 POI 生成文字精灵，默认常显名称，并受 LayerToggle 控制。
- **阶段二（交互展示）**：复用 `buildPois` 的基础几何，将名称默认隐藏，仅在 hover/click 命中时显示，交互结果写入 store，驱动信息卡或屏幕标签。
- **排除项**：暂不处理 POI 搜索、分类筛选与路线规划，待后续 spec 规划。

## 数据管线
1. **脚本位置**：`tools/extract-poi.js`（可在 `clean-geojson.js` 基础上扩展）。
2. **转换步骤**：
   - 使用 `osmtogeojson` 仅解析节点要素，过滤 `tags.name` 为空的条目。
   - 根据 `tags.amenity`、`tags.shop`、`tags.tourism` 等生成 `properties.poiType`，无匹配写入 `unknown`。
   - 调用 `app/src/lib/coordinates.js` 的投影函数写入 `properties.projected`，结构 `{ x, z }`。
   - 参考建筑高度规则补齐 `properties.elevation`（默认 0，若存在 `tags.level` 则乘以层高配置）。
   - 生成 `properties.poiId`（格式 `poi-${osmId}`），并保留原始 `id` 在 `properties.osmId`。
3. **输出**：写入 `data/pois.geojson`（UTF-8），字段要求：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | GeoJSON FeatureCollection/Feature 标准字段 |
| `geometry` | Point | 原始 WGS84 坐标，便于回归及复用 |
| `properties.name` | string | OSM `tags.name`，渲染时展示 |
| `properties.poiType` | string | amenity/shop/tourism 等归一化结果 |
| `properties.elevation` | number | 单位米，Three.js y 轴位置 |
| `properties.projected` | object | `{ x, z }`，Three.js 平面坐标 |
| `properties.poiId` | string | 前端唯一标识 |
| `properties.sourceTags` | object | 保留原始 `tags`，便于调试 |
4. **回归**：脚本运行后在控制台输出统计（总数、缺失高度数），异常时写入 `logWarn`；必要时在 `data/reports/poi-summary.json` 存储快照。

## 渲染方案
### 阶段一：常显文字
1. **模块**：`app/src/three/buildPois.js`。
2. **流程**：
   - 通过静态导入或 `fetch` 读取 `src/data/pois.geojson`。
   - 遍历 Feature，使用 `THREE.SpriteMaterial + CanvasTexture` 绘制中文名称，字体、背景、描边颜色写入 `src/config/layers.js`。
   - 将 Sprite 位置设置为 `(x, elevation + labelHeight, z)`，并在 `userData` 中保存 `{ poiId, poiType, name }`。
   - 所有 Sprite 加入 `POIGroup`，暴露 `setVisible(bool)` 与 `updateLabelScale(camera)`，便于 `App.jsx` 调整可见性及字号。
3. **场景集成**：`initScene.js` 返回 `POIGroup`；`App.jsx` 在初始化完成后加入场景。`LayerToggle` 新增 `POI` 项，对应 store 的 `layerVisibility.poi`，默认 `true`。

### 阶段二：交互展示
1. **模块**：
   - `app/src/three/interactions/poiPicking.js`：封装 `Raycaster` 命中逻辑并暴露 `handlePointerMove`、`handleClick`。
   - `app/src/components/PoiLabel.jsx`（或扩展 `InfoCard`）：根据 store 状态渲染 hover/click 名称。
2. **行为**：
   - 默认 Sprite 材质名称透明，仅保留小型底点；命中后切换为清晰文字或触发屏幕空间标签。
   - Hover：写入 `hoveredPoiId`，Three.js 层高亮对应 Sprite，React 层在鼠标位置显示名称。
   - Click：写入 `selectedPoiId` 与对应数据，驱动 `InfoCard` 展示更详细内容。
3. **性能**：`poiPicking` 维护 `prevHoverId` 避免重复派发，指针事件节流到 `requestAnimationFrame`，并允许通过配置限定最大射线距离。

## 状态与 UI 对接
- `useSceneStore` 新增：
  - `poiLayerVisible: boolean`，默认 `true`。
  - `hoveredPoiId`、`selectedPoiId`（`string | null`），提供 `setHoveredPoi`、`setSelectedPoi` action。
  - `poiDetailsMap: Record<string, PoiFeature>`，阶段二用于缓存与检索。
- `LayerToggle`：读取 `config.layers` 中的 `poi` 条目，调用 `toggleLayer('poi')`，并通过 `logInfo` 记录开关操作。
- `DebugPanel`：新增 POI 数量展示，便于快速检查数据是否加载完整。
- `InfoCard/PoiLabel`：订阅 store，在阶段二控制 hover/click 展示逻辑。

## 日志与测试
- **日志**：
  - POI 数据加载成功/失败分别输出 `logInfo`/`logError`，内容含数量与文件路径。
  - Hover 触发写入 `logDebug('POI Hover', { poiId, name })`，点击确认写入 `logInfo('POI Selected', ...)`。
- **测试**：
  - `src/tests/three/buildPois.test.js`：使用 mock GeoJSON 断言 Sprite 数量、`userData`、字号缩放逻辑。
  - `src/tests/three/poiPicking.test.js`：模拟 `Raycaster` 返回值，验证 hover/click 状态更新与去抖策略。
  - `src/tests/store/useSceneStore.test.js`：覆盖 `poiLayerVisible`、hover/selected actions 以及 LayerToggle 通路。
- **验收**：阶段一需提供所有 POI 名称常显的截图；阶段二需录制 hover 显示、click 打开信息卡的动图或视频附件。
