# UI 结构 Spec

## React 架构
- `App`：整体布局（地图区域 + 侧边导航 + 底部状态栏），负责注入 Store。
- `NavigationPanel`：
  - 楼栋搜索、分类筛选、收藏。
  - 路线规划：起点/终点选择、策略（最快/最短/避开施工）。
- `InfoCard`：显示当前建筑信息（名称、用途、开放时间、实时数据）。
- `LayerToggle`：控制 deck.gl 图层（道路、热点、热力图）。
- `StatusBar`：展示数据更新时间、日志摘要、当前模式。
- `LoggerViewer`（可选）：折叠面板，读取 `logger.js` 缓存的最新 N 条日志。

## 交互流程
1. 用户在面板中选中建筑 → 更新 Store → deck.gl/Three.js 同步高亮。
2. 路径规划提交后，触发数据层计算（暂定 mock），将结果注入 PathLayer 与 Three.js 动画。
3. Hover 建筑 → InfoCard 自动切换，日志记录一次“信息”级别的交互事件。

## UI 状态管理
- 建议使用 Zustand：
  - `selectedBuilding`
  - `route`
  - `layerVisibility`
  - `logsPreview`

## TODO
- [ ] 设计主界面布局（断点、响应式策略）。
- [ ] 确定 panel 与 3D 视图的通信 API。
