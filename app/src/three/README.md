# three

- `initScene.js`：初始化 Scene / Camera / Renderer / OrbitControls，开发模式挂载 Grid/Axes helper，并暴露 `resize/start/stop` 接口。
- `buildBuildings.js`：静态导入 `campus.geojson` 构建建筑 group，写入 `userData`（stableId/name/category/elevation），供拾取与 UI 使用。
- `buildRoads.js`：遍历 `featureType = "road"` 的线要素估算宽度生成低矮 Extrude 几何，统一加入 `roads` group，并在 `userData` 中记录道路属性。
- `buildWater.js`：解析 `featureType = "lake"` 的 Polygon/MultiPolygon，投影后生成 1m 厚的水面 Mesh，加入 `water` group，材质半透明带轻微 emissive。
- `interactions/buildingPicking.js`：封装建筑拾取逻辑，监听 `pointermove`/`click`，在 hover/选中时回调并配合 store 写入状态。
- `interactions/roadPicking.js`：道路拾取模块，负责 hover 高亮与点击日志，提供 `clearHover`/`dispose` 便于图层开关。
- `interactions/waterPicking.js`：水系拾取模块，复用 Raycaster 完成 hover 发光与 click 日志，不写入 store，仅通过回调报告当前命中的水体信息。
