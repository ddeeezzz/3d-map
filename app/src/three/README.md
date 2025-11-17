# three

Three.js 渲染与交互模块，负责构建犀浦校区 3D 场景。与数据/配置的约束详见 `spec/rendering.md`、`spec/data-pipeline.md`。

## 目录

- 根目录：`initScene.js`、`build*.js`（建筑、道路、围墙、水系、绿化、场地、POI、路线光带等）。
- `interactions/`：Raycaster 拾取模块。
- `roads/`：道路子模块（如分层、材质工具）。

## 核心模块

| 文件 | 职责 |
| --- | --- |
| `initScene.js` | 创建 `Scene/PerspectiveCamera/WebGLRenderer`，挂载 `OrbitControls`、环境光/平行光，提供 `resize/start/stop/applyEnvironmentSettings/ disposeEnvironment`。 |
| `buildBoundary.js` | 解析 `featureType = "campusBoundary"`，校正多边形方向、挖孔、生成围墙与地面 Mesh，尊重 `config.boundary`。 |
| `buildBuildings.js` | 处理建筑 Polygon/MultiPolygon，读取 `properties.elevation` + `config.heights` 挤出，写入 `userData`。 |
| `buildRoads.js` | 构造道路挤出 group，分“校内/市政”，宽度来自 `config.roadWidths`。 |
| `buildWater.js` / `buildWaterway.js` | 水体/水道拉伸，使用统一材质。 |
| `buildGreenery.js` / `buildSites.js` | 绿化与体育场地几何。 |
| `buildRouteOverlay.js` / `buildPois.js` | 路线光带、POI 图标 mesh（依赖 `config.poiRoute`、`data/pois.geojson`）。 |
| `interactions/*.js` | 封装 Raycaster 逻辑（建筑/道路/水体/围墙/场地等），处理 hover/click、写 store、输出日志。 |

## 开发规范

- 所有模块需以函数形式导出 `{ group, dispose }` 或 `{ init, dispose }`，由 `App.jsx` 管理生命周期。
- 读取数据时统一通过 `import geo from "../data/campus.geojson?raw"`，再借助 `lib/coordinates.js` 投影。
- `userData` 必须包含 `stableId/name/category` 等关键字段，供交互与 UI 使用。
- 日志：任何构建/拾取异常需调用 `logger` 输出中文信息。
- 资源释放：`dispose()` 中清理几何、材质、纹理、事件监听，避免内存泄露。

## 与 store 协作

- `sceneTransform`：通过 `applySceneTransform(group, store.sceneTransform)` 应用于所有 group。
- `layerVisibility`：每个 group 挂载 `group.visible = store.layerVisibility[key]`，切换时同步调用交互模块的 `clearHover`。
- `selectedBuilding/hoveredSite` 等状态由交互模块写入，React 组件订阅。
- `environmentSettings`：`initScene` 监听 store 变化并调用 `applyEnvironmentSettings`。

## 测试

- `src/tests/three/*.test.js` 覆盖几何构建、拾取逻辑、sceneTransform 应用等。修改 geometry 需更新快照/断言。
