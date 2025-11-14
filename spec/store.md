# Store（Zustand）Spec

## 目标
- 在 React、Three.js、deck.gl 之间提供统一的全局状态，保证组件、场景与可视化层的读写保持一致；
- 强制所有状态定义与更新路径集中在 `t2/app/src/store/useSceneStore.js`，当状态拆分或扩展时需同步更新本 spec 及 `spec/app-structure.md`。

## 状态结构
```ts
type SceneStore = {
  selectedBuilding: string | null
  setSelectedBuilding: (id: string | null) => void

  route: {
    start?: string
    end?: string
    path?: Array<[number, number]>
  } | null
  setRoute: (route: SceneStore["route"]) => void

  layerVisibility: Record<string, boolean>
  toggleLayerVisibility: (layerKey: string) => void

  logsPreview: Array<{
    time: string
    level: "INFO" | "DEBUG" | "WARN" | "ERROR"
    module: string
    message: string
  }>
  pushLogPreview: (entry) => void

  sceneTransform: {
    rotationY: number
    scale: number
    offset: { x: number, z: number }
  }
  updateSceneTransform: (partial: Partial<SceneStore["sceneTransform"]>) => void
  resetSceneTransform: () => void

  environmentSettings: {
    enabled: boolean
    skybox: string
    exposure: number
    toneMapping: string
  }
  updateEnvironmentSettings: (partial: Partial<SceneStore["environmentSettings"]>) => void
  resetEnvironmentSettings: () => void

  hoveredBuilding: Record<string, any> | null
  setHoveredBuilding: (info: Record<string, any> | null) => void

  resetStore: () => void
}
```

## 字段职责
- **selectedBuilding**：导航面板或三维拾取写入的建筑 ID，驱动高亮、信息卡片与路线规划输入。
- **route**：路线模块写入的路径数据，deck.gl PathLayer、Three.js 行动画线只读该字段。
- **layerVisibility**：LayerToggle 调用 `toggleLayerVisibility` 修改；Three.js、deck.gl 图层监听对应 key 控制显隐。
- **logsPreview**：DebugPanel/LoggerViewer（规划中）读取最近日志，`pushLogPreview` 负责滚动窗口裁剪（默认 50 条）。
- **sceneTransform**：DebugPanel 写入增量旋转/缩放/平移，Three.js 在 `applySceneTransform` 中与基准对齐值合成后应用到全部 Group。
- **environmentSettings**：存放天空盒与环境贴图的实时配置，`App.jsx` 监听并调用 `sceneContext.applyEnvironmentSettings`；DebugPanel 使用 update/reset 接口驱动 UI 控件。
- **hoveredBuilding**：建筑拾取在 hover 时写入，Tooltip 与信息卡片按需读取；置空表示移除 hover。
- **resetStore**：测试场景与 UI “重置”按钮使用，避免手动覆盖内部状态。

### 基准对齐
- `SCENE_BASE_ALIGNMENT = { rotationY: 54°, scale: 1, offset: { x: -500, z: -141 } }` 描述 OSM → Three.js 的稳定姿态，禁止在其他模块硬编码；
- store 仅存储相对增量 `sceneTransform`，Three.js 必须执行“基准 + 增量”后才应用；
- 若基准值调整，需同步更新 `useSceneStore.js`、本 spec 以及依赖对齐的测试用例。

### 天空盒 / 环境设置
- `environmentSettings` 的初始值来自 `config.environment`，若缺失则使用 `{ enabled: true, exposure: 1, toneMapping: "ACESFilmic" }` 兜底；
- `updateEnvironmentSettings` 支持部分字段更新，适合作为表单控件的 onChange 回调；`resetEnvironmentSettings` 恢复到配置默认值；
- `initScene` 负责消费该状态并通过 `HDRLoader + PMREMGenerator` 设置 `scene.environment/background`，`disposeEnvironment` 用于组件卸载或切换 HDR 后的资源回收。

## 实现建议
- 所有状态与 setter 放在 `src/store/useSceneStore.js`，若后续拆分需在 `spec/app-structure.md` 说明；
- 只能通过 setter 更新状态，禁止直接 mutate `useSceneStore.getState()` 返回的对象；
- 新增/删除字段时同步更新：本 spec、`spec/app-structure.md`、对应测试与引用模块；
- `resetSceneTransform`、`resetEnvironmentSettings`、`resetStore` 分别承担不同粒度的重置职责，使用时需明确场景，避免一次性清空造成 UI 闪烁。

## 模块协作
- **Three.js**：读取 `sceneTransform`、`environmentSettings`、`selectedBuilding` 等，具体渲染流程见 `spec/rendering.md`。
- **deck.gl**：监听 `layerVisibility`、`route`，按需启用/关闭 PathLayer、GeoJsonLayer，细节由 `spec/rendering.md` 管理。
- **React UI**：
  - DebugPanel 读写 `sceneTransform`、`environmentSettings`；
  - NavigationPanel / InfoCard 读取 `selectedBuilding`、`route`；
  - LayerToggle 操作 `layerVisibility`；
  - LoggerViewer（若实现）读取 `logsPreview`。
- 本文仅描述 store 字段与职责，涉及 UI、渲染、数据流程的具体交互需参照其对应 spec（如 `spec/ui.md`、`spec/rendering.md`、`spec/data-pipeline.md` 等）。***
