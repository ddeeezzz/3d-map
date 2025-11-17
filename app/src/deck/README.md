# deck/

本目录预留 deck.gl 图层实现，用于未来在 Three.js 之外渲染路径、热力、统计图层。当前阶段仅存规范说明，真实代码需在 spec 完成后再实现。

## 规划

- 计划按图层类型拆分文件，如 `createPathLayer.js`、`createPoiLayer.js`，导出工厂函数或自定义 hook。
- 所有图层的可见性与参数需与 `useSceneStore.layerVisibility`、`config.layers` 对齐，禁止维护第二套状态。
- 与 Three.js 共存时，需要通过 `App.jsx` 的渲染循环协调 `deck.gl` canvas 与 WebGLRenderer，避免重复 WebGL 上下文。

## 接入约束

1. 先在 `spec/rendering.md` / `spec/app-structure.md` 描述数据来源、交互、性能预算；
2. 在 `src/config/index.js` 定义图层配置（key、默认显隐、样式）；
3. 在本目录实现工厂函数，确保：
   - 只接收 React/Store 提供的 props；
   - 释放 deck 实例（`deck.finalize()`），防止内存泄露；
   - 记录关键生命周期日志。
4. 在 `components/LayerToggle`/`App.jsx` 挂载图层，并补充 `src/tests/three/` 或 `src/tests/components/` 的覆盖。

## 当前状态

尚未启用真实 deck.gl 图层，提交前请勿在此目录添加假的实现，以免误导调试。如需演示，请在 PR 中附调试截图并说明依赖。
