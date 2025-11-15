# POI 标注 Spec

## 背景与阶段目标
- **范围限定**：仅处理 `t2/map.osm` 中位于犀浦校区、且带 `name` 标签的节点要素，统一视为校园兴趣点（POI）。禁止引入外部数据或跨校区信息。
- **阶段一（常显文字 + 独立 Sprite）**：完成 `tools/extract-poi.js`、`data/pois.geojson` 与 Three.js 图层 `buildPois`。所有 POI 以文字精灵形式常显，独立 POI 使用 `Sprite` 作为过渡模型，LayerToggle 可整体开关。
  - **允许修改范围**：`tools/extract-poi.js`、`data/pois.geojson`、`app/src/three/buildPois.js`、`app/src/config/layers.js` 中的 `poi` 配置、`useSceneStore.js` 的 `poiLayerVisible` 及 action、`LayerToggle`/`DebugPanel` 的最小改动、`App.jsx`/`initScene.js` 中的挂载逻辑与配套测试，禁止改动既有建筑/道路等图层实现。
  - **完成方法**：
    1. **先调整清洗脚本**：复用当前 `data/tmp.json`，更新 `tools/extract-poi.js` 重新生成 `data/pois.geojson` 与 `poi-summary.json`，此阶段仅输出经纬度与属性，不写入固定平面坐标，为运行时统一投影留出空间。
    2. 在 `app/src/config/layers.js` 新增 `poi` 配置（字体、颜色、默认可见性），同步扩展 `useSceneStore.js` 及 `LayerToggle` 以保存/切换 `poiLayerVisible`。
    3. **再修改 Three.js 投影流程**：新建 `app/src/three/buildPois.js`，读取新的 `src/data/pois.geojson`，使用与道路/水系相同的 `findProjectionOrigin` + `projectCoordinate` 在运行时计算平面坐标，并将二维结果映射为 Three.js 坐标（`x = projectedX`、`z = -projectedY`），以保持与其他图层一致，之后构建 `POIGroup` 并在 `initScene.js`/`App.jsx` 中挂载，实现 `setVisible`、`updateLabelScale` 等接口。
    4. 编写最小单测（`buildPois.test.js`、`useSceneStore.test.js`），最后在页面中截图确认“全部 POI 常显”效果。
- **阶段二（交互展示，独立 POI 不变）**：复用阶段一 Geometry，将文字默认隐藏，仅在 hover/click 时通过交互动态显示；状态写入 store 驱动 React 信息卡或屏幕标签，独立 POI 仍保持 Sprite 表现。
  - **允许修改范围**：新增 `app/src/three/interactions/poiPicking.js`、`PoiLabel`（或扩展 `InfoCard`），`useSceneStore.js` 增加 `hoveredPoiId`、`selectedPoiId`、`activePoiList`、`hoveredFeatureId`，`App.jsx` 绑定指针事件；既有 Three.js 图层仅可补充 `userData.stableId` 等元数据，数据脚本保持不变。
  - **完成方法**：
    1. 设计 `poiPicking` API（pointer move/click/clear），在 `useSceneStore` 中补齐所需状态与 action，并更新 `config.layers.poi` 以加入文字透明度控制。
    2. 在 `buildPois.js` 中为 Sprite 写入 `userData`，并提供 helper 以便交互模块查询；对建筑/道路 Mesh 在构建时补充 `userData.stableId`。
    3. 实现 `app/src/three/interactions/poiPicking.js` 和 `PoiLabel.jsx`，在 `App.jsx` 注册 `pointermove`/`click` 事件，将命中结果写入 store，再由 `InfoCard`/`PoiLabel` 响应渲染。
    4. 编写 `poiPicking.test.js`、扩展 `useSceneStore.test.js` 与组件测试，最后录屏展示 hover/click 联动效果。
- **阶段三（独立 POI 建模）**：为没有附属几何的 POI（雕塑、公交站等）替换 Sprite，按类型加载圆柱体或定制模型，通过配置集中管理材质、尺寸与 LOD；交互逻辑保持阶段二一致。
  - **允许修改范围**：扩展 `config.layers.poi` 或新增 `config/poi-models.js` 描述模型形态，更新 `buildPois.js`（必要时新增 `app/src/three/models/poi/`）以加载模型，`tools/extract-poi.js` 可新增 `modelType` 字段，交互/Store 仅做兼容性优化。
  - **完成方法**：
    1. 在配置层制定 `poiType → 模型` 映射（几何类型、半径/高度、材质颜色、LOD 规则），并在数据脚本中为需要特殊模型的 POI 标记 `modelType`。
    2. 在 `buildPois.js` 中根据 `modelType` 创建对应 Mesh（如圆柱体、方柱或引入 glTF），保留 Sprite 作为 hover 标签；为新 Mesh 设置 `userData.poiId` 供拾取复用。
    3. 扩展 `poiPicking` 的拾取列表，确认模型与 Sprite 均可命中；若模型数量大，需在 `DebugPanel` 中加入性能监控项并进行截图/录屏验收。
- **排除项**：POI 搜索、分类筛选、路线规划、HUD 等需求需另起 spec 说明，不在本文件范围。

## 数据管线
1. **脚本位置**：`tools/extract-poi.js`。
2. **解析与清洗**：
   - 仅解析 OSM `node`，过滤 `tags.name` 为空的节点。
   - 依据 `tags.amenity/shop/tourism/public_transport` 等生成 `properties.poiType`，未命中写 `unknown`。
   - 保留原始 `geometry.coordinates`（WGS84），投影操作留给 Three.js 阶段统一处理。
   - 参考建筑高度规则补齐 `properties.elevation`（默认 `0`，若 `tags.level/height` 可得则乘以层高配置）。
   - 生成 `properties.poiId = poi-${osmId}`、`properties.osmId = feature.id`。
   - 读取 `campus.geojson`，对 `featureType` 为建筑/水体/河流/道路/场地的要素建立空间索引：多边形使用点在面判断，线性要素使用 5 米阈值的点到折线距离，仅对“有名称”的 POI 执行关联。
   - 命中后写入 `properties.parentType ∈ {building/site/water/road}` 与 `properties.parentId`（对应要素 `stableId`）；未命中保持 `null`。
   - 额外遍历 `campus.geojson` 中带名称的建筑、水系、道路、场地要素，计算几何重心/中点生成**派生标签 POI**，写入 `properties.sourceType = "label"` 与 `properties.labelTargetType = featureType`，并复用各要素的 `stableId` 作为 `parentId`。
   - 可选 `properties.modelType`（阶段三使用）、`properties.sourceTags`（保留原始标签）。
3. **输出**：`data/pois.geojson`（UTF-8）需包含下表字段。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | GeoJSON Feature/FeatureCollection |
| `geometry` | Point | 原始 WGS84 坐标 |
| `properties.name` | string | OSM 名称，用于渲染 |
| `properties.poiType` | string | amenity/shop/tourism 等归一化结果 |
| `properties.elevation` | number | 单位米，Three.js y 坐标 |
| `properties.poiId` | string | 唯一标识，`poi-${osmId}` |
| `properties.parentType` | string|null | `building/site/water/road` 或 `null` |
| `properties.sourceType` | string | `poi`（默认）或 `label`（派生标签 POI） |
| `properties.labelTargetType` | string|null | 当 `sourceType = "label"` 时记录原始几何类型 |
| `properties.parentId` | string|null | 所属对象稳定 ID |
| `properties.modelType` | string|null | 阶段三模型映射（可空） |
| `properties.sourceTags` | object | 原始 OSM 标签备查 |

4. **回归**：脚本运行后输出统计（POI 总数、独立 POI 数、缺失高度条目）。异常通过 `logWarn` 记录，必要时在 `data/reports/poi-summary.json` 追加快照。

## 渲染方案
### 共享基础
- `app/src/three/buildPois.js` 读取 `src/data/pois.geojson` 构建 `POIGroup`，提供：
  - `setVisible(visible: boolean)`：LayerToggle 同步显隐。
  - `updateLabelScale(camera)`：相机缩放时统一调整字号。
  - `getPoiById(poiId)`、`getPoiListByParent(parentId)`：交互层查询。
- `POIGroup` 内区分 `attachedPoi`（有 `parentId`）与 `independentPoi`（`parentId = null`），以便交互处理。

### 阶段一：常显文字
1. **附属 POI**：读取 `pois.geojson` 后使用 `findProjectionOrigin(campus.features)` + `projectCoordinate` 动态计算平面坐标，再生成文字 Sprite，或仅在 `userData` 储存 `{ poiId, parentId, name, poiType }` 并保持极低透明度。
2. **独立 POI**：同样基于运行时投影的 `(x, z)` 创建 `THREE.Sprite`，材质按 `config.layers.poi.independent`（字体、描边、背景）设置，Sprite 位置 `(x, elevation + labelHeight, z)`，可附加底座圆盘增强拾取。
3. **集成**：`initScene.js` 返回 `POIGroup`；`App.jsx` 在场景初始化完毕后挂载。`LayerToggle` 新增 `POI` 条目（默认 `true`），`DebugPanel` 展示总量与独立数量。

### 阶段二：交互展示
1. **拾取模块**：`app/src/three/interactions/poiPicking.js` 使用 `Raycaster`：
   - 命中建筑/道路 Mesh：读取 `userData.stableId`，调用 `getPoiListByParent` 获取附属 POI 并写入 store。
   - 命中独立 POI Sprite/拾取代理：根据 `poiId` 查详情写入 store。
2. **显示策略**：默认降低 Sprite 透明度，仅 hover/click 时通过 `PoiLabel`（屏幕空间）或 Sprite 恢复显示；`InfoCard` 展示 `activePoiList`。
3. **日志**：hover 写 `logDebug('POI Hover', { poiId, name })`；click 写 `logInfo('POI Selected', { poiId, parentId })`。

### 阶段三：独立 POI 建模
1. **模型生成**：按 `modelType` 创建圆柱/方柱/定制 Mesh，可集中放在 `app/src/three/models/poi/`，并保留 Sprite 作为 hover 标签。
2. **拾取兼容**：`poiPicking` 需将模型 Mesh 纳入射线检测列表，保持 `userData.poiId` 一致。
3. **性能**：配置中需声明最大面数、LOD 或可见距离；如需进一步细化将在新增 spec 中补充，本文件仅占位提醒。

## 状态与 UI 对接
- `useSceneStore` 字段：
  - `poiLayerVisible: boolean`（阶段一）。
  - `hoveredPoiId`, `selectedPoiId`（阶段二）。
  - `hoveredFeatureId`: 当前命中的建筑/道路。
  - `activePoiList: PoiFeature[]`: 点击建筑/道路后展示列表。
  - `poiDetailsMap: Record<string, PoiFeature>`：缓存 POI 详情。
- `LayerToggle`：读取 `config.layers.poi`，调用 `toggleLayer('poi')` 并输出日志。
- `DebugPanel`：展示 POI 总数、独立/附属比例、最近一次交互。
- `InfoCard`：展示 `activePoiList` 与 `selectedPoiId` 的详细属性。
- `PoiLabel`：屏幕空间文字，hover 独立 POI 时显示（阶段三可扩展为模型顶端标签）。

## 日志与测试
- **日志**：
  - 数据加载成功：`logInfo('POI 数据加载完成', { total, independent })`。
  - 数据加载失败或数量异常：`logError` / `logWarn`。
  - Hover/Click：参考渲染方案记录 POI ID、名称、parentId。
- **测试计划**：
  - `src/tests/three/buildPois.test.js`：验证 Sprite/模型数量、`userData`、`updateLabelScale`。
  - `src/tests/three/poiPicking.test.js`：模拟 Raycaster 命中独立 POI 与建筑 Mesh，确认 store 状态更新与节流逻辑。
  - `src/tests/store/useSceneStore.test.js`：覆盖 `poiLayerVisible`、hover/selected/active 切换。
  - 组件测试：若新增 `PoiLabel` 等 React 组件，需在 `src/tests/components/` 下写 Vitest。
- **验收标准**：
  - 阶段一：提交全图 POI 常显截图，展示独立 POI Sprite 效果。
  - 阶段二：录屏演示 hover/click、InfoCard/PoiLabel 联动。
  - 阶段三：演示至少一类实体模型与拾取交互，提供性能统计或说明。
