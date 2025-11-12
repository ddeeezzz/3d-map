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

## deck.gl 图层

- `GeoJsonLayer`：用于 hover/click 交互、建筑轮廓描边。
- `PathLayer`：道路、推荐路径。
- `IconLayer` / `ScatterplotLayer`：兴趣点、实时人流。
- `TileLayer`（可选）：底图瓦片或其他统计背景。

## 状态同步

- React Store（Zustand/Context）维护选中建筑、路径结果、图层开关。
- deck.gl 事件（onHover/onClick）更新 Store；Three.js 订阅 Store 改变材质。

## 数据加载

- Three.js 与 deck.gl 初始化时，通过静态 `import data from "./data/campus.geojson"` 获取校园 GeoJSON，不使用 `fetch`。
- 如需切换到远程接口，需先在 spec 更新约定并调整加载逻辑。

## TODO

- [ ] 定义共享 WebGL 流程（单 canvas vs 双 canvas 决策）。
- [ ] 描述导航路径动画细节（速度、颜色、方向）。
