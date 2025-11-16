# 渲染层 Rendering Spec

## 目标
- 对 `t2/app/src/data/campus.geojson` 中的要素实施 Three.js / deck.gl 混合渲染，支撑西南交通大学犀浦校区的三维可视化与交互。
- 所有三维实体、交互模块与 deck.gl 图层均需在 `t2/` 目录内完成，实现配置、材质、数据源的全量可追溯。

## Three.js 架构
- **核心组件**：`Scene`、`PerspectiveCamera`、`WebGLRenderer`，统一接入 `OrbitControls` 与 `AmbientLight + DirectionalLight` 组成可交互场景。
- **调试辅助**：`GridHelper`、`AxesHelper` 只在开发模式启用，便于校准场景坐标系。

### 初始化流程（`src/three/initScene.js`）
1. 创建 Scene / Camera / Renderer，并将 renderer canvas 挂载到 React 容器。
2. 暴露 `resize(width, height)`、`render()`、`start()`、`stop()`，供 App 复用。
3. 封装 `disposeEnvironment` 释放 HDR RenderTarget，避免切换天空盒时的占用泄漏。

## 天空盒与环境贴图
- HDR 资源统一放在 `app/public/textures/skyboxes/`，默认使用 `citrus_orchard_road_puresky_4k.hdr`。
- 通过 `HDRLoader -> PMREMGenerator` 生成 `scene.environment/background`，异常时写 `logWarn("天空贴图加载失败", ...)`。
- `config.environment = { skybox, exposure, toneMapping }` 作为 DebugPanel 的初始值，调节时调用 `sceneContext.applyEnvironmentSettings`。

## 建筑建模（`src/three/buildBuildings.js`）
1. 过滤 `featureType = "building"` 的 Polygon/MultiPolygon，投影后使用 `Shape + ExtrudeGeometry` 构造几何。
2. 高度来源 `properties.elevation`，材质使用 `config.colors[category]` 与半透明 `MeshPhongMaterial`，`userData = { stableId, name, category, elevation }`。
3. 全部 Mesh 收束到 `buildings` group，再通过 `applySceneTransform` 统一旋转、缩放、平移。

## deck.gl 说明
- 当前阶段只保留规范与数据结构，尚未启用真实 deck.gl 图层；未来 PathLayer / GeoJsonLayer 的启停需与 `layerVisibility` 保持一致。

## 建筑 Hover/Click（`src/three/interactions/buildingPicking.js`）
- `pointermove/click` 监听 + Raycaster 拾取，hover 时改变 emissive，高亮结束后恢复。
- onHover/onSelect 将数据写入 `useSceneStore`（`hoveredBuilding`、`selectedBuilding`），点击时记录 `logInfo("建筑交互", ...)`。

## 道路建模与拾取
- **建模（`src/three/buildRoads.js`）**：读取 `featureType = "road"` 的 LineString，根据 `properties.width/lanes` 与 `config.roadWidths[highwayType]` 计算宽度，`config.road.height/baseY` 控制厚度与基准。
- **拾取（`src/three/interactions/roadPicking.js`）**：Raycaster + emissive 高亮，返回的 userData 直接写入日志，并暴露 `clearHover/dispose` 供图层切换。

## 水系建模
- **水体（`src/three/buildWater.js`）**：Polygon/MultiPolygon 读取 `config.waterway.surfaceDepth/surfaceBaseY`，透明蓝色材质强化可见度。
- **水道（`src/three/buildWaterway.js`）**：对 LineString 做缓冲形成截面，宽度来源 `config.waterway.width`，与水体一致的材质。
- **拾取**：`riverPicking`、`waterPicking` 分别处理 MultiLineString/Polygon，hover 信息缓存在 App，click 时写日志。

## 围墙地面层
- **数据来源**：仅针对 `campus.geojson` 中 `featureType = "campusBoundary"` 的多边形，使用 `projectCoordinate/findProjectionOrigin` 投影到本地平面，生成围墙与地面的统一坐标。
- **建模策略**：`buildBoundary.js` 先用 `ensureCounterClockwise` 处理外环，再将所有内环写入 `holes`；使用 `THREE.Shape + ShapeGeometry` 生成淡黄色地面 Mesh，并在生成前剔除自交或退化环，保证拓扑稳定。
- **材质与高度**：`config.ground.color` 决定地面颜色（默认 #fef3c7），`config.ground.baseY` 控制 Mesh 的 Y 坐标；材质采用 `MeshStandardMaterial`，推荐 `roughness=0.95`、`metalness=0` 以贴合校园地面的漫反射效果。
- **渲染集成**：地面 Mesh 加入 `boundary` group，设置 `receiveShadow = true`，并根据需要调整 `renderOrder` 保证处于建筑/道路之下；DebugPanel / LayerToggle 的围墙显隐应同时作用于地面，防止局部裸露或遮挡问题。

## 场地渲染（Sites）
- 数据来源 `featureType = "site"`，保留 `properties.siteCategory/displayName/sportsType/stableId`。
- `buildSites.js` 对 Polygon/MultiPolygon 进行拉伸，`height = config.site.categoryHeights[siteCategory] + properties.elevation + config.site.height`。
- Mesh 使用 `config.colors.site` 中的色板，透明度 0.85，命名 `sites-<stableId>-<index>` 并写 `userData`。
- `sitesGroup` 同步 `applySceneTransform`，显隐由 `layerVisibility.sites` 控制。

### 场地交互（`src/three/interactions/sitePicking.js`）
- Raycaster 只针对 `sitesGroup`，hover 时设置 #34d399 emissive 与透明度，`clearHover`/`dispose` 还原材质。
- onHover/onSelect 输出 `{ stableId, displayName, siteCategory, sportsType }` 写入 Store，并记录 `logInfo("场地交互", ...)`。
- `layerVisibility.sites` 关闭时自动调用 `clearHover` 与 `useSceneStore.setHoveredSite(null)`，保持 UI 同步。

## 场景状态同步
- `useSceneStore` 管理 `sceneTransform`、`environmentSettings`、多图层显隐以及 hover/selected 状态，所有 Three.js 交互模块通过 setter 写入。
- `App.jsx` 监听 `sceneTransform` 变化触发 `applySceneTransform`，图层显隐通过 `group.visible` 控制，天空盒设置由 `sceneContext.applyEnvironmentSettings` 执行。

## 数据加载
- 所有三维模块均通过 `import data from "../data/campus.geojson?raw"` 解析 GeoJSON；新增数据需先更新 data pipeline spec。

## 校园范围控制
- **数据范围**：仅加载 `properties.region = "xipu-campus"` 的建筑、场地、绿化、水系，所有 Group 提供 `toggleVisibility`，默认开启。
- **道路分层**：`buildRoads.js` 根据 `properties.roadScope` 将道路拆为“校内 + 市政”两个 Group，市政道路使用更低高度与颜色，并在 `userData` 记录 `distanceToCampus`。
- **Store 联动**：通过 `useSceneStore` 的 `campusOnly`、`roadBufferMeters` 控制两组道路的显隐与缓冲提示；DebugPanel/LayerToggle 需要绑定状态并在切换时操作对应 Group。
- **UI 展示**：道路 InfoCard/日志输出需读取 `distanceToCampus` 并以中文展示“距校界 xx 米”；范围切换操作需记录 `logInfo("范围切换", ...)` 便于排查误操作。

## TODO
- [ ] 完善 hover/click 与 UI 面板的联动方案。
- [ ] 道路宽度、材质与阴影的细节调优。
