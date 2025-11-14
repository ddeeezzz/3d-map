# 渲染规格（Rendering Spec）

## 目标
- 将 `t2/app/src/data/campus.geojson` 中的要素以 Three.js / deck.gl 呈现，支撑校园导航、热点展示与后续交互。

## Three.js 场景
- **基础组件**：`Scene`、`PerspectiveCamera`、`WebGLRenderer`（开启抗锯齿与阴影）、`OrbitControls`（限制俯仰与距离）、`AmbientLight + DirectionalLight`。
- **辅助**：开发模式可挂载 `GridHelper` 与 `AxesHelper`，便于核对坐标。

### 场景初始化（`src/three/initScene.js`）
1. 创建 Scene/Camera/Renderer，并将 renderer canvas 插入 React 容器。
2. 暴露 `resize(width, height)` 与 `render()`，供上层响应窗口尺寸与主动重绘。
3. 返回 `{ scene, camera, renderer, controls, start(), stop() }`，start/stop 管理 RAF。

### 建筑建模（`src/three/buildBuildings.js`）
1. 过滤 `featureType = "building"`，将地理坐标投影为平面点。
2. 每个 Polygon/MultiPolygon -> `Shape` + `ExtrudeGeometry`，高度取 `properties.elevation`。
3. 材质颜色来自 `config.colors[category]`，默认半透明 `MeshPhongMaterial`。
4. 为 Mesh 写入 `userData = { stableId, name, category, elevation }` 以供拾取。
5. 挂入 `buildings` group 并返回，供 `applySceneTransform` 统一变换。

## deck.gl 图层（暂缓）
- 当前阶段仅保留规范描述，不加载 deck.gl；如需恢复，需先评估 gl 共享策略再补充实现。

## 建筑 Hover/Click（`src/three/interactions/buildingPicking.js`）
- 监听 `pointermove`/`click`，使用 Raycaster 命中建筑 Mesh，将 hover/selected 写入 `useSceneStore`。
- hover 高亮可切换材质 emissive，点击触发 `logInfo("三维交互", ...)`。

## 道路建模（`src/three/buildRoads.js`）
1. 读取 `featureType = "road"` LineString/MultiLineString。
2. 宽度优先取 `properties.width/lanes`，否则查 `config.roadWidths[highwayType]`。
3. 通过左右 offset + `ExtrudeGeometry` 生成低矮条带，材质取浅灰 `config.colors.道路`。

### 道路交互（`src/three/interactions/roadPicking.js`）
- hover 时 emissive 变亮，click 记录 `logInfo("道路交互", ...)`，暴露 `clearHover`/`dispose` 以配合图层隐藏。

## 水系建模
- **湖泊（`src/three/buildWater.js`）**：Polygon/MultiPolygon 统一读取 `config.waterway.surfaceDepth/surfaceBaseY` 挤出厚度与底边高度，材质半透明蓝色，emissive 加强可见性。
- **河流（`src/three/buildWaterway.js`）**：LineString/MultiLineString 参考道路方案，统一读取 `config.waterway.width/height/baseY` 计算 offset 挤出，不再按标签区分参数。

### 水系交互（`src/three/interactions/waterPicking.js` & `riverPicking.js`）
- Hover 显示 emissive，高亮信息通过回调返回，不写入 store；点击输出日志。

## 围墙建模（`src/three/buildBoundary.js`）
- 继续消费 `featureType = "campusBoundary"`，但渲染模式从「开放式搭建」改为「闭合挤出 + 挖孔」，先生成实心区域再减去内部空腔，从而确保墙体连续且门洞可控。
- 实施步骤：
  1. `prepareClosedRing` 仅负责去重与首尾闭合，原始坐标仍然作为外环 `outerRing`。
  2. 新增 `buildClosedWallShape(outerRing)`：利用 `clipper-lib`（或 `@turf/transformScale` 退化方案）沿法线向内偏移 `wallThickness + config.boundary.holeInset`，得到与外环方向相反的 `innerRing`，并将其写入 `Shape.holes`，实现主空腔。
  3. 若 `properties.boundaryGates` 存在（数据清洗阶段写入 gate 中点、朝向、净宽/深度），调用 `buildGateHolePolygons` 构造矩形洞并追加到 `Shape.holes`，形成「挖孔」门洞。
  4. 使用单次 `ExtrudeGeometry`（`depth = config.boundary.height`，`bevelEnabled = false`）生成 Mesh，`mesh.userData = { stableId, boundaryType, wallMode: "closedSubtractive", gateIds }`，并开启 `castShadow/receiveShadow`。
  5. `applySceneTransform` 只对最终 Mesh 执行一次即可，Group 只作为集中控制 `layerVisibility.boundary`。
- 编码范围：仅允许运行 `app/src/three/buildBoundary.js`（闭合建模）、`app/src/config/index.js`（追加 `boundary.holeInset`、`boundary.gateDepth` 等参数）、`tools/clean-geojson.js`（写 `properties.boundaryGates`）与对应测试/数据示例，禁止修改其他模块。
- 排障要点：
  1. 若 offset 失败则写日志并回退到旧的开放式构建，便于比较差异。
  2. 记录 `boundary` Mesh 的 `geometry.boundingBox`，用于 DebugPanel 校验墙高/宽是否符合 `config.boundary`。
  3. 2178276210 ↔ 5194469641 缺段优先通过插值补点，再观察闭合偏移后是否仍然断裂。

### 围墙交互（`src/three/interactions/boundaryPicking.js`）
- hover：材质 emissive 置为 `#ffe082` 并缓存原值；click：`logInfo("围墙交互", "点击 ${name||stableId||未命名围墙}", { stableId, boundaryType })`。
- 暴露 `clearHover`/`dispose`，供 `layerVisibility.boundary` 与组件卸载时使用。

## 绿化渲染（Greenery）
- **数据输入**：清洗脚本输出的 `featureType = "greenery"` 要素，`properties.greenType` 区分 `wood/forest/tree_row/scrub/grass/meadow` 或 `landuse = grass`。
- **几何处理（纯 Three.js）**：
  - 面状绿化（Polygon/MultiPolygon）：参考湖泊流程，在 `src/three/buildGreenery.js` 中使用 `Shape` + `ExtrudeGeometry`，挤出厚度与底边来自 `config.greenery.surfaceDepth/surfaceBaseY`，颜色取 `config.colors.绿化`（缺省 `#4caf50`），`opacity = 0.6`。
  - 线状绿化（LineString/MultiLineString）：沿用 `buildWaterway` 的 offset 逻辑，统一读取 `config.greenery.width/height/baseY` 生成条带，底部贴地、沿正 Y 拉伸；无须按 `greenType` 再划分配置。
  - 若未来需要针对特定 `greenType` 调整尺寸，需先在 `spec/config.md` 说明扩展方案。
- **图层与显隐**：
  - `config.layers` 需新增 `{ name: "绿化", key: "greenery", visible: true, order: 18 }`，LayerToggle/DebugPanel 读取后同步到 `useSceneStore`。
  - `App.jsx` 在水系之后调用 `buildGreenery(scene)`，缓存 `greeneryGroupRef`，纳入 `applySceneTransform` 并监听 `layerVisibility.greenery`。
- **交互**：不实现 hover/click。
- **测试计划**：允许新增测试后，在 `src/tests/three/buildGreenery.test.js` 准备面状与线状示例，验证 Mesh 数量、挤出厚度以及 `userData.greenType`。

## 状态同步
- `useSceneStore` 维护 `layerVisibility`、`hoveredBuilding`、`selectedBuilding` 等状态。
- Three.js 拾取模块更新 store，UI（如 `DebugPanel`/未来的导航面板）从 store 读取。

## 数据加载
- 所有 Three.js 模块通过静态 `import data from "./data/campus.geojson"` 读取。
- 如需改用远程 API，需先在 spec 中更新约定，并在加载逻辑上兼容异步请求。

## TODO
- [ ] 建筑 hover/click 的 UI 联动。
- [ ] 道路速度/颜色/纹理等细节描述。
- [ ] 绿化 deck.gl 方案评估及交互扩展。


