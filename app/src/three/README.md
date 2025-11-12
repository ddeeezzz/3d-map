# three

- `initScene.js`：初始化 Scene / Camera / Renderer / OrbitControls，开发模式下挂载 Grid/Axes helper，立即将 canvas 注入 DOM 并暴露 `resize/start/stop` 接口。
- `buildBuildings.js`：静态导入 `campus.geojson`，过滤 `featureType = "building"` 生成拉伸 Mesh，写入 `userData`（stableId/name/category）供拾取与 UI 使用。
- `buildRoads.js`：解析 `featureType = "road"` 的 LineString/MultiLineString，估算宽度后生成低矮 Extrude 几何，设置 `userData`（stableId/name/highway/estimatedWidth）并统一加入 `roads` group。
- `interactions/buildingPicking.js`：封装建筑拾取，监听 `pointermove`/`click`，高亮命中 Mesh、回调 hover/select，并由 `App.jsx` 写入 store 与日志。
- `interactions/roadPicking.js`：道路拾取模块，复用 Raycaster 实现 hover 发光与 click 日志，支持 `clearHover`/`dispose` 便于在图层隐藏或场景卸载时撤销状态。
- 后续可按 spec 继续拓展 `navigation` 等模块以承载路径动画或三维特效。
