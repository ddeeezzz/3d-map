# store

集中管理 Zustand 状态，协调 React UI、Three.js 场景、未来 deck.gl 图层之间的数据同步。所有字段与 setter 以 `spec/store.md` 为准，增删字段必须先更新 spec。

## 文件

- `useSceneStore.js`：全局真源，包含建筑/场地选中、路线数据、图层显隐、场景变换、环境参数、日志预览、指南面板开关等。
- `navigationStore.js`：导航面板局部状态（搜索输入、路线配置表单），不直接驱动渲染。

## 关键约束

- 禁止直接修改 `useSceneStore.getState()` 返回值，必须调用 setter。
- `sceneTransform` 保存相对于 `SCENE_BASE_ALIGNMENT` 的增量（旋转 54°、scale 1、offset -500/-141），Three.js 需将基准与增量相加后应用，保证 DebugPanel 初始值为 0。
- `environmentSettings` 初始值来自 `config.environment`，并提供 `update/reset` 方法。
- `layerVisibility` 与 `config.layers` 顺序一致，LayerToggle/Three.js/未来 deck.gl 需监听相同 key。
- `logsPreview` 只保留最近 50 条，调用 `pushLogPreview` 时注意裁剪。
- `resetStore/ resetSceneTransform/ resetEnvironmentSettings` 分别对应不同粒度的重置，UI 不得混用。

## 测试

- `src/tests/store/useSceneStore.test.js` 覆盖初始状态、setter、副作用；新增字段需追加用例。
- 对导航局部状态的测试放在 `src/tests/store/navigationStore.test.js`（若创建）。

## 开发流程

1. 需求变更 → 更新 `spec/store.md` 与相关 spec；
2. 修改 store 文件并添加注释；
3. 更新引用模块（Three.js、React）及测试；
4. 在 README、PR 中说明字段变化与兼容性。
