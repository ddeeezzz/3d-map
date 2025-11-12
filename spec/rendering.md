# 渲染层次 Spec

## 目标

- 将校园 GeoJSON 以「三维体块 + 数据图层」呈现，支持导航交互与热点展示。

## Three.js 场景

- **基础组件**：透视相机、轨道控制、自适应 renderer、环境光 + 方向光。
- **建筑体块**：
  - 输入：GeoJSON Polygon。
  - 处理：`ExtrudeGeometry`，高度取 `properties.elevation`。
  - 材质：按分类映射颜色，默认使用半透明 `MeshPhongMaterial`（例如 `opacity: 0.75, transparent: true`）。
- **导航轨迹**：使用 `Line2` 或自定义着色器，支持动画流动效果。
- **共享上下文**：优先使用 deck.gl 暴露的 `gl`，若不稳定则双 Canvas 并同步相机矩阵。

### 场景初始化

1. 在 `src/three/initScene.js` 封装初始化：
   - 创建 `Scene`、`PerspectiveCamera`（初始位置覆盖整个校园）、`WebGLRenderer`（抗锯齿+shadowMap）。
   - 添加 `OrbitControls`，限制俯仰与距离，防止穿透地面。
   - 配置 `AmbientLight` + `DirectionalLight`，方向光用于投影建筑阴影。
2. 提供 `resize(width, height)` 与 `render()` 方法，让 React 在窗口变化时同步 camera/renderer，并掌控渲染循环。
3. 返回 `{ scene, camera, renderer, controls }`，供建筑、路径等模块注册 Mesh。
4. 初始化完成后立刻在页面中挂载 renderer 的 canvas（例如通过 React ref 注入 DOM），即使暂未载入建筑，也能看到基础背景和相机控制，便于开发调试。
5. 开发模式（`import.meta.env.DEV`）下，可添加 `GridHelper` + `AxesHelper` 作为辅助线，确认坐标系与灯光方向；生产模式不启用。

### 建筑 Mesh 构建流程（`src/three/buildBuildings.js`）

1. 数据入口：`import rawGeojson from "./data/campus.geojson?raw"`，解析后在场景 ready 时调用 `buildBuildings(scene)`。
2. 构建步骤：
   - 过滤 `featureType = "building"`。
   - 将经纬度映射到平面坐标（统一缩放，1 单位≈1 米）。
   - 对每个 Polygon/MultiPolygon 用 `Shape` + `ExtrudeGeometry` 拉伸，`height = properties.elevation`。
   - 颜色来自 `config.colors[properties.category]`，共享材质避免重复创建；选中时切换材质或开启 emissive。
   - Mesh 加入 `buildingGroup`，便于统一清理和高亮控制。
3. 提供接口：
   - `highlightBuilding(stableId)`：在 store 中记录 ID，并更新对应 Mesh 材质。
   - `resetHighlight()`：恢复默认。
4. 可选优化：预计算法线、合并几何、启用 `InstancedMesh`（可在后续阶段再评估）。

## deck.gl 图层（暂缓）

- 由于近期回退了 deck.gl 轮廓层实现，当前阶段仅保留 spec 描述，不在代码中加载任何 deck.gl 图层。
- 后续若再次启用，需重新评估「双 Canvas vs 共享 gl」方案，并根据 Phase 规划逐步恢复 `GeoJsonLayer`、`PathLayer` 等。

## 建筑 Hover/Click 交互（Three.js）

- **目标**：直接在 Three.js 场景内完成建筑拾取与反馈，替代 deck.gl 轮廓层的交互职责。
- **状态字段**：
  - `store` 需新增 `hoveredBuilding`（可选）或复用 `selectedBuilding`，明确 hover 和 click 的写入逻辑。
  - 每个 Mesh 在 `buildBuildings` 阶段写入 `mesh.userData = { stableId, name, category }`，便于拾取后读取。
- **实现步骤**：
  1. 在 `src/three/interactions/buildingPicking.js`（新建）封装拾取逻辑：内部创建 `THREE.Raycaster` 与 `Vector2` 鼠标指示。
  2. `initScene` 初始化时调用 `attachBuildingPicking({ domElement, camera, scene, buildingGroup })`，注册 `pointermove` 和 `click` 事件。
  3. 每次 `pointermove`：
     - 将鼠标像素坐标转换为标准设备坐标（NDC），用 Raycaster 与 `buildingGroup.children` 做 `intersectObjects`。
     - 若命中 Mesh 则更新 `hoveredBuilding`，并在材质上做临时高亮（例如切换 `emissive` 或 `opacity`）；离开时恢复默认。
  4. `click` 事件：若当前有 hover 对象，则调用 `setSelectedBuilding(stableId)`，并通过 `logInfo("三维交互", \`选中 ${name}\`)` 记录日志。
- **性能要求**：
  - Raycaster 及临时 `Vector2` 需复用，避免频繁创建对象。
  - 拾取组仅包含建筑 Mesh（不含地面/辅助线），必要时可给建筑 group 添加包围盒以提前过滤。
- **UI 联动**：
  - `spec/ui.md` 后续应补充 Tooltip 或 InfoCard 与 `hoveredBuilding` 的对应关系（例如显示名称、分类）。
  - Debug 面板无需参与，但在 DEV 环境可显示当前命中 ID 作为调试信息。
- **测试**：
  - 在 `src/tests/three/buildingPicking.test.js` 编写单测，模拟 Raycaster 命中场景时的状态变化（可通过 stub Mesh/userData 验证）。

  ## 道路建模（快速落地方案）

- **数据输入**：继续从 `campus.geojson` 读取 `featureType = "road"` 的 LineString/MultiLineString，渲染阶段直接根据 `config.roadWidths[properties.highway]` 估算宽度；若 `width`/`lanes` 存在，可优先在渲染阶段读取覆盖配置值。
- **几何构建**：
  - 在 `src/three/buildRoads.js`（新增）中遍历道路要素，将线段转换为低矮的 Extrude/带宽线段（可以使用 `THREE.Shape` 挤出高度 0.2m 或 `Line2` + `LineGeometry`），厚度取 `estimatedWidth / sceneScale`。
  - 与建筑一样复用投影/坐标转换（`projectCoordinate`），并在最终 Group 上应用 `SCENE_BASE_ALIGNMENT` 与 `sceneTransform` 的缩放/旋转/偏移。
- **颜色与可见性**：
  - 道路默认使用更浅的灰色（接近白的灰，例如 `#d0d0d0`），在 `config` 中配置可使用 `config.colors.道路`。
  - Group 名称 `roads`，后续通过 store 的 `layerVisibility.roads` 控制显隐。
- **交互**：
  - 首次实现仅用于渲染参考，不做 hover/click；若未来需要交互，再在本节追加拾取需求。
- **集成**：
  - `App.jsx` 在建筑之后调用 `buildRoads(scene)`，并在 `applySceneTransform` 内一同处理 `roadsGroup`。
  - 测试：在 `src/tests/three/buildRoads.test.js` 验证宽度查找逻辑（给定 highway/residential，应生成预期厚度）。

### 道路交互（hover/click）

- **目标**：在 Three.js 场景内为道路提供基础拾取反馈（hover 高亮 + click 记录日志），暂不影响 UI/store 状态。
- **实现**：
  - 新建 `src/three/interactions/roadPicking.js`，导出 `attachRoadPicking({ domElement, camera, roadsGroup, onHover, onSelect })`。
  - 内部复用单例 `THREE.Raycaster` 与 `THREE.Vector2`，监听 `pointermove` 与 `click`；当 `roadsGroup.visible === false` 时直接返回以节省计算。
  - `pointermove`：计算与 `roadsGroup.children` 的最近交点，若命中 Mesh，则将其与上一次 hover Mesh 对比；命中变化时通过 `onHover(mesh.userData)` 回调，并在材质上设置 `emissive = #ffffff`、`emissiveIntensity ≈ 0.4`，离开时恢复 `0`。
  - `click`：若存在当前 hover Mesh，则调用 `onSelect(hoverMesh.userData)` 并保持 hover 高亮状态不变。
- **日志**：
  - `App.jsx` 传入的 `onSelect` 内调用 `logInfo("道路交互", \`选中 ${name ?? stableId ?? "未知道路"} (${highway ?? "未知等级"})\`)`，hover 阶段不写日志。
- **集成**：
  - `App.jsx` 在 `attachBuildingPicking` 之后调用 `attachRoadPicking`，并在 `useEffect` 清理阶段注销监听及重置 hover 高亮。
  - 需要以 ref 记录当前 hover Mesh，确保在 `roadsGroup` 显隐切换或场景卸载时恢复材质。
- **测试规划**：
  - 后续在 `src/tests/three/roadPicking.test.js` 中通过 stub Mesh/材质验证 emissive 切换与回调触发顺序；当前阶段仅记录 spec，待需求进入编码再实现。


## 水系渲染（湖泊与水体）

- **数据输入**：继续复用 `campus.geojson`，筛选 `featureType = "lake"` 的 Polygon/MultiPolygon；若原始 OSM 使用 `natural = water` 或 `water = lake`，需在数据清洗阶段映射为统一的 `featureType`。
- **几何构建**：
  - 新增 `src/three/buildWater.js`，通过 `projectCoordinate`/`projectPolygon` 投影后使用 `THREE.Shape` 构建几何，可直接使用 `ShapeGeometry`，或采用 `ExtrudeGeometry` 并将 `depth` 控制在 0.05 以内以避免 z-fighting。
  - 所有 Mesh 收纳于 `water` group，并在 group 层复用 `SCENE_BASE_ALIGNMENT + sceneTransform` 的旋转/缩放/偏移，确保与建筑、道路对齐。
  - 处理 MultiPolygon 时需按主轮廓→洞的顺序添加 `shape.holes`，保证湖中岛屿被正确镂空。
- **材质与显隐**：
  - `app/src/config/index.js` 补充 `colors.水系`（建议默认 `#4fc3f7`）以及 `layers` 配置 `{ name: "水系", key: "water", visible: true, order: 15 }`，供 LayerToggle/DebugPanel 使用。
  - 水面材质采用 `MeshPhongMaterial`，`opacity ≈ 0.6`、`transparent: true`、`side: THREE.DoubleSide`，必要时设置轻微 `emissive` 以提升可读性。
- **集成顺序**：
  - `App.jsx` 在构建建筑后立即调用 `buildWater(scene)`，再构建道路，初步建议顺序为“建筑 → 水系 → 道路”，如需调整遮挡可再修改。
  - `applySceneTransform` 与 `layerVisibility.water` 需同时作用在 `waterGroup` 上，默认显示，可通过 UI 切换。
- **交互与日志**：
  - 首次实现仅渲染参考，不做 hover/click；若后续需要拾取或日志记录，应在本节补充细则。
- **测试计划**：
  - 在 `src/tests/three/buildWater.test.js` 构造多段湖泊数据，校验 Mesh 数量、group 命名和材质透明度，并确认洞处理正确。


## 状态同步

- React Store（Zustand/Context）维护选中/悬停建筑、路径结果、图层开关。
- Three.js 拾取逻辑通过 `useSceneStore` 写入 `hoveredBuilding` / `selectedBuilding`，UI（InfoCard、NavigationPanel）订阅这些字段并更新展示。
- 若未来恢复 deck.gl 图层，再在本节补充其与 store 的接口。

## 数据加载

- Three.js 与 deck.gl 初始化时，通过静态 `import data from "./data/campus.geojson"` 获取校园 GeoJSON，不使用 `fetch`。
- 如需切换到远程接口，需先在 spec 更新约定并调整加载逻辑。

## TODO

- [ ] 实现建筑 hover/click 拾取及材质高亮。
- [ ] 描述导航路径动画细节（速度、颜色、方向）。
