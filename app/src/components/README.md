# components/

本目录收纳所有 React UI 组件及其样式文件，是校园导航产品的界面层。组件职责、状态来源与交互规范需与 `spec/ui.md`、`spec/navigation-panel.md`、`spec/guide-panels.md` 保持一致。

## 主要文件

| 组件 | 内容摘要 |
| --- | --- |
| `DebugPanel.jsx/.css` | 调试界面，仅 DEV 环境挂载，调节 `sceneTransform`、`environmentSettings`、图层显隐并展示 `logsPreview`。 |
| `NavigationPanel.jsx/.css` | 左侧导航总面板，整合地点搜索、路线规划、范围切换等操作。 |
| `LocationSearchInput.jsx/.css` | POI/建筑搜索输入框，依赖 `lib/poiIndex.js` 的索引结果，交互细节见导航 spec。 |
| `LibraryGuidePanel.jsx/.css` | 图书馆指南面板，受 `store.guidePanelsVisible.library` 控制，与 `config.guidePanels` 对齐。 |
| `GymnasiumGuidePanel.jsx/.css` | 体育馆指南面板，展示预约/使用流程。 |

新增组件时请同步创建样式文件，并在 README 中补充表格。

## 开发规范

- 组件遵循“展示 + hooks”模式，复杂逻辑拆至 `src/lib/` 或 `src/store/`，UI 内仅调用 hooks 与 logger。
- 所有 `import` 语句上方写明依赖原因；组件、props、内部函数必须使用中文 JSDoc 注释。
- 样式作用域限制在组件内，类名前缀如 `nav-panel__`；共享样式统一放入 `App.css` 并附意图说明。
- 与 Three.js 或 store 的交互需要记录日志，例如 `logInfo("导航面板", "切换图层", { layerKey })`。

## 状态与数据

- 全局共享状态来自 `useSceneStore`（选中建筑、图层显隐、指南面板开关等）；本地 UI 状态（搜索输入等）存放在 `navigationStore.js`。
- 配置数据（颜色、图层顺序、指南映射）统一读取 `src/config/index.js`，禁止散落常量。
- 需要调用 Three.js 操作时，通过 store setter 或消息通道传递，避免直接操作场景实例。

## 测试策略

- Vitest + React Testing Library 测试存放于 `src/tests/components/`，命名 `<Component>.test.jsx`。
- 覆盖范围包括：基础渲染、关键交互（按钮/输入）、与 store 的读写及日志调用。

## TODO

- [ ] 为指南面板与搜索组件补充测试样例，覆盖常见交互。
- [ ] 抽取可复用的表单/按钮子组件，减少面板间样式重复。
