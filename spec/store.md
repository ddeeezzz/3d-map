# Store（Zustand）Spec

## 目标
- 集中管理 React、Three.js、deck.gl 共用的状态，并提供清晰的字段定义与更新职责。
- 初期采用 Zustand（放置在 `src/store/useSceneStore.js`），后续如需拆分可扩展。

## 状态结构示例
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
    rotationY: number      // 弧度，默认 0，表示在基准对齐的基础上额外旋转
    scale: number          // 默认 1
    offset: { x: number, z: number } // 单位：米，默认 { x: 0, z: 0 }
  }
  updateSceneTransform: (partial: Partial<SceneStore["sceneTransform"]>) => void
}
```

## 字段职责
- **selectedBuilding**：由导航面板或地图点击更新；Three.js 根据该 ID 高亮对应 Mesh。
- **route**：导航模块写入路径点，deck.gl PathLayer 与 Three.js 动画读取。
- **layerVisibility**：LayerToggle 调用 `toggleLayerVisibility`，两端图层监听变化调整可见性。
- **logsPreview**：LoggerViewer（若实现）可读取最新日志；初期可保持空数组。
- **sceneTransform**：调试面板写入旋转/缩放/偏移，Three.js 在渲染循环中应用到建筑 Group。

### 基准对齐
- 为了让调试面板初始显示为“0”而又保持校园实际朝向，定义 `sceneBaseAlignment = { rotationY: 54° (Math.PI * 0.3), scale: 1, offset: { x: -500, z: -141 } }`。
- store 中的 `sceneTransform` 保存相对于该基准的增量；Three.js 在读取时需执行 `实际值 = sceneBaseAlignment + sceneTransform`（缩放直接相乘）。
- 若基准数据调整，需同步更新 `sceneBaseAlignment`（位于 `useSceneStore.js` 导出的常量）与相关测试。

## 实现建议
- 状态文件位于 `src/store/useSceneStore.js`（如需拆分再在 app-structure 中更新）。
- 使用 `zustand` 创建并导出 hook 与 `useSceneStore.getState()`，所有字段应有 setter/更新函数，禁止直接 mutate。
- 若状态字段新增或删减，在本 spec 与 `app-structure` 的 store 部分同步描述。

## 模块配合说明
- Three.js：通过 `useSceneStore.getState()` 或 `useSceneStore.subscribe` 读取 `sceneTransform`、`selectedBuilding` 等，负责将旋转/缩放/高亮实际应用到 Mesh。相关渲染实现细节在 `spec/rendering.md` 中描述，store 只提供字段与更新方式。
- deck.gl：监听 `layerVisibility`、`route` 等字段，按需开启/关闭 PathLayer、GeoJsonLayer。具体图层行为仍由 `spec/rendering.md` 管理。
- React UI：
  - 调试面板（`DebugPanel`）读写 `sceneTransform`。
  - NavigationPanel/InfoCard 读写 `selectedBuilding`、`route`。
  - LayerToggle 操作 `layerVisibility`。
  - LoggerViewer（如实现）读取 `logsPreview`。
- 本文件允许描述 store 与各模块交互的字段、订阅方式；若需要详细 UI 或渲染流程，请在对应 spec（`ui.md`、`rendering.md` 等）继续细化，以免职责混淆。
