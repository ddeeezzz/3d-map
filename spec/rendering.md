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

## 天空盒与环境贴图
- **资源与路径**：统一在 `app/public/textures/skyboxes/` 存放 HDR 贴图，本阶段使用 `citrus_orchard_road_puresky_4k.hdr`（蓝天晴朗环境），后续如需替换必须在该目录内保留原素材并更新命名规范。
- **加载方式**：`src/three/initScene.js` 中使用 `HDRLoader`（原 `RGBELoader` 已废弃）读取 HDR，配合 `PMREMGenerator` 转换为 `WebGLRenderTarget`，完成后将 `scene.background` 与 `scene.environment` 指向同一纹理，确保天空背景与 PBR 反射一致，加载过程出现异常时写入 `logWarn("天空盒加载", ...)`。
- **初始化 Hook**：在 `initScene` 初始化 renderer 后立即创建 `pmremGenerator`，并在 `start()` 前加载 HDR；渲染循环销毁时调用 `pmremGenerator.dispose()` 与纹理 `dispose()`，避免内存泄漏。
- **配置项**：`app/src/config/index.js` 追加 `environment` 段（如 `{ skybox: "citrus_orchard_road_puresky_4k.hdr", exposure: 1.0, toneMapping: "ACESFilmic" }`），供 DebugPanel/场景初始化读取，支持未来切换贴图、调整曝光或 tone mapping。
- **调试面板**：DebugPanel 新增“天空盒”折叠面板，提供贴图选择（下拉）、曝光滑杆、环境强度开关，并通过 `useSceneStore` 的 `environmentSettings` 同步到 Three.js；变更参数时立即刷新 renderer 的 tone mapping 与背景。

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
3. 通过左右 offset + `ExtrudeGeometry` 生成条带，材质取浅灰 `config.colors.道路`；`config.road.height` 固定为 2m，`config.road.baseY` 负责整体下沉，使道路顶面（`baseY + height`）保持原有高度。

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
  1. `prepareClosedRing` 去重并闭合原始坐标圈，将清洗后的多边形视为「围墙的内侧基准」，即最终 Shape 的第一个 hole。
  2. `buildClosedWallShape(innerRing)`：根据 `config.boundary.width` 与 `holeInset` 把基准环沿外法线偏移 `width + holeInset`，得到更大的 `outerRing`，再以 `outerRing` 构建 Shape 外轮廓，实现「围墙完全向外拓展，内侧不侵入校园范围」。偏移算法需处理凹角、重复点与自交情况。
  3. 若 `properties.boundaryGates` 存在（数据清洗阶段写入 gate 中点、切向量、净宽/深度），使用 `gate.tangent` 与 `gate.depth` 沿外法线放置矩形洞，洞体默认朝外拓展，并依次 push 到 `Shape.holes`。未匹配的 gate 需写日志。
  4. 使用单次 `ExtrudeGeometry`（`depth = config.boundary.height = 2`，`bevelEnabled = false`）生成 Mesh，`mesh.userData = { stableId, boundaryType, wallMode: "closedSubtractive", gateIds }`，并开启 `castShadow/receiveShadow`；`config.boundary.baseY` 会抬升底面，确保围墙顶面仍与既有高度对齐。
  5. `applySceneTransform` 只对最终 Mesh 执行一次即可，Group 只作为集中控制 `layerVisibility.boundary`。
- 编码范围：仅允许运行 `app/src/three/buildBoundary.js`（闭合建模）、`app/src/config/index.js`（`width/height/baseY/holeInset/gateWidth/gateDepth`）、`tools/clean-geojson.js`（写 `properties.boundaryGates`）与对应测试/数据示例，禁止修改其他模块。
- 排障要点：
  1. 若 offset 失败则写日志并回退到旧的开放式构建，便于比较差异。
  2. 记录 `boundary` Mesh 的 `geometry.boundingBox`，用于 DebugPanel 校验墙高/宽是否符合 `config.boundary`。
  3. 2178276210 ↔ 5194469641 缺段优先通过插值补点，再观察闭合偏移后是否仍然断裂。

### 围墙交互（`src/three/interactions/boundaryPicking.js`）
- hover：材质 emissive 置为 `#ffe082` 并缓存原值；click：`logInfo("围墙交互", "点击 ${name||stableId||未命名围墙}", { stableId, boundaryType })`。
- 暴露 `clearHover`/`dispose`，供 `layerVisibility.boundary` 与组件卸载时使用。

## 绿化渲染（Greenery）
- **数据输入**：清洗脚本输出的 `featureType = "greenery"` 要素，`properties.greenType` 可能来自 `natural = wood/tree_row/scrub/grass/meadow`，或 `landuse = grass/forest`（`forest` 仅从 landuse 而来）。
- **几何处理（纯 Three.js）**：
  - 面状绿化（Polygon/MultiPolygon）：参考湖泊流程，在 `src/three/buildGreenery.js` 中使用 `Shape` + `ExtrudeGeometry`，挤出厚度固定为 2m（`config.greenery.surfaceDepth`），底边 `surfaceBaseY` 用于统一下沉，从而保持顶面高度；颜色取 `config.colors.绿化`（缺省 `#4caf50`），`opacity = 0.6`。
  - 线状绿化（LineString/MultiLineString）：沿用 `buildWaterway` 的 offset 逻辑，统一读取 `config.greenery.width/height/baseY` 生成条带，其中 `height` 亦固定为 2m，`baseY` 调整下沉量，确保顶面位置与面状一致；无须按 `greenType` 再划分配置。
  - 若未来需要针对特定 `greenType` 调整尺寸，需先在 `spec/config.md` 说明扩展方案。
- **图层与显隐**：
  - `config.layers` 需新增 `{ name: "绿化", key: "greenery", visible: true, order: 18 }`，LayerToggle/DebugPanel 读取后同步到 `useSceneStore`。
  - `App.jsx` 在水系之后调用 `buildGreenery(scene)`，缓存 `greeneryGroupRef`，纳入 `applySceneTransform` 并监听 `layerVisibility.greenery`。
- **交互**：不实现 hover/click。
- **测试计划**：允许新增测试后，在 `src/tests/three/buildGreenery.test.js` 准备面状与线状示例，验证 Mesh 数量、挤出厚度以及 `userData.greenType`。

## 场地渲染（Sites）
- **数据输入**：`featureType = "site"` 要素，包含 `properties.siteCategory`、`displayName`、`sportsType` 与 `stableId`。
- **几何构建**：
  - 在 `src/three/buildSites.js` 内复用建筑的投影工具，将 Polygon/MultiPolygon 转为 `Shape`，再以 `ExtrudeGeometry` 挤出矮柱体；
  - `depth` 读取 `properties.elevation ?? config.site.height`，挤出后统一 `geometry.rotateX(-Math.PI / 2)`，`mesh.position.y = config.site.baseY`，确保与道路/绿化共享的基准面一致。
- **与场景基准对齐**：
  - `buildSites` 必须沿用 `buildBuildings` 中的坐标投影/归一化逻辑：从 `coordinates.js` 读取已缓存的校园原点（首个建筑质心），用相同的 `projectPolygonToPlane`/`centerGeometry` 工具生成 XZ 平面坐标，避免出现与建筑错位的“第二坐标系”；
  - 生成的 `sitesGroup` 调用 `applySceneTransform(sitesGroup, sceneTransform, SCENE_BASE_ALIGNMENT)`，以保持与建筑、道路统一的旋转/缩放/平移；禁止在 `buildSites` 内额外写死平移或缩放，所有对准操作均应依赖 `sceneTransform`；
  - 当 DebugPanel 修改 `sceneTransform` 或 `config.site.baseY` 调整矮柱基线时，`useEffect` 需与建筑 group 同步更新，确保组合旋转后的地块仍紧贴地面（即 `SCENE_BASE_ALIGNMENT.offset` 始终作用于整组 Mesh）。
- **材质与分组**：
  - 颜色取 `config.colors.site[siteCategory] ?? config.colors.site.默认`，使用半透明 `MeshPhongMaterial`（`opacity ≈ 0.85`、`side = THREE.DoubleSide`）；
  - 所有 Mesh 挂入 `sites` Group，统一交给 `applySceneTransform`，禁止额外平移/旋转以保持与建筑坐标一致。
- **userData**：写入 `{ stableId, displayName, siteCategory, sportsType }`，便于后续拾取或信息面板使用。
- **图层控制**：
  - `config.layers` 新增 `{ name: "场地", key: "sites", visible: true, order: 16 }`；
  - `App.jsx` 创建 `sitesGroupRef`，在初始化阶段 `buildSites(scene)`，并监听 `layerVisibility.sites` 控制显隐。
- **交互与日志**：当前不实现拾取；保留扩展点，可复用道路/边界拾取模式。加载成功、数据缺失等仍需调用 `logInfo/logWarn`。
- **测试建议**：在 `src/tests/three/buildSites.test.js` 构造多种 `siteCategory` 输入，校验挤出高度、`position.y`、材质颜色与 `userData`。

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
