# 渲染层 Rendering Spec

## 目标
- 对 `t2/app/src/data/campus.geojson` 中的要素进行 Three.js / deck.gl 双轨渲染，支持犀浦校区的三维展示与交互探索。
- 所有三维实现、交互拾取与 deck.gl 约束需在 `t2/` 内完成，保证配置、脚本与数据来源可追溯。

## Three.js 架构
- **核心组件**：`Scene`、`PerspectiveCamera`、`WebGLRenderer`，配合 `OrbitControls`、`AmbientLight + DirectionalLight` 完成导航场景。
- **辅助工具**：`GridHelper`、`AxesHelper` 仅在调试模式使用，便于校准坐标系。

### 初始化流程（`src/three/initScene.js`）
1. 创建 Scene / Camera / Renderer，并把 renderer canvas 注入 React 容器。
2. 暴露 `resize(width, height)`、`render()`、`start()`、`stop()`，方便 App 复用。
3. 统一封装 `disposeEnvironment` 释放 HDR RenderTarget，防止切换天空盒时泄漏。

## 天空盒与环境贴图
- HDR 资源统一放在 `app/public/textures/skyboxes/`，默认使用 `citrus_orchard_road_puresky_4k.hdr`。
- 通过 `HDRLoader -> PMREMGenerator` 生成 `scene.environment/background`，异常时调用 `logWarn("天空盒加载", ...)`。
- `config.environment = { skybox, exposure, toneMapping }` 为 DebugPanel 的初始值，改动时触发 `sceneContext.applyEnvironmentSettings`。

## 建筑建模（`src/three/buildBuildings.js`）
1. 消费 `featureType = "building"` 特征，Polygon/MultiPolygon 经过投影后生成 `Shape + ExtrudeGeometry`。
2. 高度读取 `properties.elevation`，材质使用 `config.colors[category]` + 半透明 `MeshPhongMaterial`，写入 `userData = { stableId, name, category, elevation }`。
3. 所有 Mesh 装入 `buildings` group，再由 `applySceneTransform` 统一旋转/缩放/平移。

## deck.gl 说明
- 当前阶段仅保留规范与数据结构，未启用实际 deck.gl 图层；未来 PathLayer / GeoJsonLayer 的开启/关闭要与 `layerVisibility` 协议一致。

## 建筑 Hover/Click（`src/three/interactions/buildingPicking.js`）
- `pointermove/click` 监听 + Raycaster 拾取，hover 时克隆材质并设置 emissive，离开后恢复。
- onHover/onSelect 将数据写入 `useSceneStore`（`hoveredBuilding`、`selectedBuilding`），并在点击时记录 `logInfo("建筑交互", ...)`。

## 道路建模与拾取
- **建模（`src/three/buildRoads.js`）**：读取 `featureType = "road"` 的 LineString，结合 `properties.width/lanes` 与 `config.roadWidths[highwayType]` 决定挤出宽度，`config.road.height/baseY` 控制厚度与基准。
- **拾取（`src/three/interactions/roadPicking.js`）**：Raycaster + emissive 高亮，返回 userData 直接写入日志；提供 `clearHover/dispose` 方便图层切换时清理。

## 水系建模
- **水体（`src/three/buildWater.js`）**：Polygon/MultiPolygon 加载 `config.waterway.surfaceDepth/surfaceBaseY`，透明蓝色材质增强可视化。
- **河流（`src/three/buildWaterway.js`）**：对线性要素进行偏移挤出，宽度来源 `config.waterway.width`，材质保持与水体一致以形成连续水系。
- **拾取**：`riverPicking`、`waterPicking` 分别负责 MultiLineString 与 Polygon，hover 信息保存在 App 内部引用，click 仅记录日志。

## 围墙与绿化
- **围墙（`src/three/buildBoundary.js`）**：Polygon 拉伸 + `Raycaster` 可选 hover，用于展示校园边界。
- **绿化（`src/three/buildGreenery.js`）**：同时支持 Polygon（低矮体块）与 LineString（带宽度的走廊）模式，颜色读取 `config.colors.greenery`。

## 场地渲染（Sites）
- 数据来源 `featureType = "site"`，重点保留 `properties.siteCategory/displayName/sportsType/stableId`。
- `buildSites.js` 对 Polygon/MultiPolygon 进行投影、转换为 Shape 后执行 `ExtrudeGeometry`。高度优先级：`config.site.categoryHeights[siteCategory]` → `properties.elevation` → `config.site.height` → `config.heights.site/default`。
- 所有 Mesh 共享 `config.colors.site` 中的颜色映射，材质透明度 0.85，命名统一为 `sites-<stableId>-<index>` 并写入 `userData`。
- `sitesGroup` 同样接入 `applySceneTransform`，与建筑/道路保持一致的基准姿态；显隐状态由 `layerVisibility.sites` 控制。

### 场地交互（`src/three/interactions/sitePicking.js`）
- Raycaster 针对 `sitesGroup` children 执行拾取，命中对象沿父链找到顶层 Mesh，避免 Extrude 内部 Mesh 被选中。
- hover 时克隆材质，设置 #34d399 emissive 和轻微透明度变化；`clearHover`/`dispose` 负责恢复原材质并释放 GPU 资源。
- onHover/onSelect 统一输出 `{ stableId, displayName, siteCategory, sportsType }`，App 将其写入 `hoveredSite`、`selectedSite`，并打点 `logInfo("场地交互", ...)`。
- 当 `layerVisibility.sites` 关闭时，`sitePickingHandleRef` 会触发 `clearHover` 且调用 `useSceneStore.setHoveredSite(null)`，确保 UI 与场景状态同步。

## 状态同步
- `useSceneStore` 维护 `sceneTransform`、`environmentSettings`、各类 `layerVisibility` 以及 hover/selected 状态，所有 Three.js 交互模块通过 setter 写入。
- `App.jsx` 监听状态变化：`sceneTransform` 更新触发 `applySceneTransform`，图层显隐通过 ref 控制 `group.visible`，天空盒设置通过 `sceneContext.applyEnvironmentSettings` 套用。

## 数据加载
- 三维模块通过静态导入 `import data from "../data/campus.geojson?raw"` 解析 GeoJSON 数据；如果需要增量更新，需先提升 data pipeline spec。

## TODO
- [ ] 完善 hover/click 与 UI 面板的联动方案。
- [ ] 道路宽度、材质与阴影的细节调优。
