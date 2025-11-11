# 渲染层次 Spec

## 目标
- 将校园 GeoJSON 以「三维体块 + 数据图层」呈现，支持导航交互与热点展示。

## Three.js 场景
- **基础组件**：透视相机、轨道控制、自适应 renderer、环境光 + 方向光。
- **建筑体块**：
  - 输入：GeoJSON Polygon。
  - 处理：`ExtrudeGeometry`，高度取 `properties.elevation`。
  - 材质：按分类映射颜色，可配置高亮状态。
- **导航轨迹**：使用 `Line2` 或自定义着色器，支持动画流动效果。
- **共享上下文**：优先使用 deck.gl 暴露的 `gl`，若不稳定则双 Canvas 并同步相机矩阵。

## deck.gl 图层
- `GeoJsonLayer`：用于 hover/click 交互、建筑轮廓描边。
- `PathLayer`：道路、推荐路径。
- `IconLayer` / `ScatterplotLayer`：兴趣点、实时人流。
- `TileLayer`（可选）：底图瓦片或其他统计背景。

## 状态同步
- React Store（Zustand/Context）维护选中建筑、路径结果、图层开关。
- deck.gl 事件（onHover/onClick）更新 Store；Three.js 订阅 Store 改变材质。

## TODO
- [ ] 定义共享 WebGL 流程（单 canvas vs 双 canvas 决策）。
- [ ] 描述导航路径动画细节（速度、颜色、方向）。
