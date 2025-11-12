# UI 结构 Spec

## React 架构
- `App`：整体布局（地图区域 + 侧边导航 + 底部状态栏），负责注入 Store。
- `NavigationPanel`：
  - 楼栋搜索、分类筛选、收藏。
  - 路线规划：起点/终点选择、策略（最快/最短/避开施工）。
- `InfoCard`：显示当前建筑信息（名称、用途、开放时间、实时数据）。
- `LayerToggle`：
  - 根据 `config.layers` 动态生成开关，显示 `name`，内部使用 `key` 和 `order` 控制层状态。
  - 切换时更新 store 的 `layerVisibility[key]`，并同步 deck.gl/Three.js。
- `StatusBar`：展示数据更新时间、日志摘要、当前模式。
- `LoggerViewer`（可选）：
  - 若未来实现，将通过 `logger` 模块提供的接口读取最新日志（目前 logger 无缓存，需在 spec 中另行规划后再实现）。
- `DebugPanel`（仅 DEV 环境显示）：
  - 提供绕 Y 轴旋转角度、场景整体缩放、地面偏移等滑块，写入 store 中的 `sceneTransform`。
  - 调用 Three.js 层的接口（如 `buildingGroup.rotation.y`、`buildingGroup.scale`），便于校准校园整体坐标。

## 交互流程
1. 用户在面板中选中建筑 → 更新 Store → deck.gl/Three.js 同步高亮。
2. 路径规划提交后，触发数据层计算（暂定 mock），将结果注入 PathLayer 与 Three.js 动画。
3. Hover 建筑 → InfoCard 自动切换，日志记录一次“信息”级别的交互事件。

## UI 状态管理
- 使用 Zustand：
  - `selectedBuilding`：当前选中的建筑 StableId，供 Three.js 和面板高亮同步。
  - `route`：导航结果（起终点、路径点集合）。
  - `layerVisibility`：记录 deck.gl 图层的开关状态（`{ [layerKey]: boolean }`）。
  - `logsPreview`：LoggerViewer（若实现）展示的最新 N 条日志。
  - `sceneTransform`：调试面板使用，结构 `{ rotationY: number, scale: number, offset: { x: number, z: number } }`，用于控制建筑群绕 Y 轴旋转、整体缩放、平移。

## TODO
- [ ] 设计主界面布局（断点、响应式策略）。
- [ ] 确定 panel 与 3D 视图的通信 API。
- [ ] 当 LoggerViewer 需求明确后，补充“日志缓存/订阅”实现方案，再动手开发。
