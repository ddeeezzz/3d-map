 # POI Route Overlay Spec

## 背景与目标
- 浏览器端输入两处 POI 名称后，系统需计算最短路径，并在 Three.js 场景中以“路线光带”形式展示完整路径。
- 数据来源固定为 `t2/campus.geojson`（道路、建筑）与 `pois.geojson`（兴趣点）；最短路依据阶段一生成的道路图。
- 仍采用“道路图构建 → 控制台 API + 最短路 → 渲染层优化”三阶段节奏，本文聚焦阶段三的路线 Mesh 方案。

---

## 阶段一：道路图构建（数据清洗 + 抽象）
1. **输入**：`t2/campus.geojson`，筛选 `featureType = "road"` 的 Paths。
2. **处理**：通过 `projectCoordinate` 统一坐标 → 生成节点 `nodes = [{ id, worldX, worldZ }]`，并将折线拆分为 `{ from, to, length, roadId }`。
3. **输出**：`app/src/data/roads-graph.json`。
4. **验收**：在 `t2/data/reports/` 记录节点/边数量与抽象校验结果，`logInfo("路网生成", {...})`。

---

## 阶段二：控制台 API + 最短路
1. `app/src/lib/roadGraph.js` 构建 `{ nodeMap, adjacency }`。
2. `solveRouteBetweenPoints(startPoi, endPoi)` 输出 `{ nodePath, edgePath, pointPath, totalLength, roadIds }`。
3. 控制台 API：
   - `window.highlightRouteByPoiNames(nameA, nameB)` 校验 POI → 求最短路 → 写入 store。
   - `window.clearRouteHighlight()` 清理状态。
4. **状态**：`highlightedRoadIds`、`activeRoute = { from, to, length }`。
5. **调试**：`drawRouteDebug(pointPath)` 在 `roads` Group 下绘制蓝色调试折线，继承 `SCENE_BASE_ALIGNMENT`。
6. **测试**：`app/src/tests/lib/roadGraph.test.js` 覆盖 Dijkstra 正常/无解/路径长度场景。

---

## 阶段三：渲染层优化（路线 Mesh + UI）

### 目标
- 完全抛弃道路 Mesh emissive 方案，改为“根据 `pointPath` 动态生成路线光带 Mesh”。
- 提供 DebugPanel / InfoCard 展示路线信息与“清空路线”按钮，并与日志联动。

### 允许修改范围
- `app/src/three/buildRoads.js` 或新增 `app/src/three/buildRouteOverlay.js`，封装 `renderRouteOverlay(pointPath, options)`、`clearRouteOverlay()`。
- `app/src/App.jsx`：接入渲染 API + store。
- `useSceneStore.js`：新增 `highlightedRoutePath`、`highlightedRouteMeta` 状态及 setter。
- DebugPanel / InfoCard 组件、`spec/ui.md`。

### 配置引用
```js
poiRoute.highlightMesh = {
  width: 4,      // 光带宽度（米）
  height: 0.3,   // 挤出高度
  yOffset: 0.05, // 相对地面的抬升高度
  color: "#FF5252",
  opacity: 0.85
}
```
- 渲染层默认读取 `config.poiRoute.highlightMesh`；若 DebugPanel 修改参数，需写入 store，再次调用渲染函数。

### 状态与 Group
- `highlightedRoutePath = pointPath`：完整路线点序列。
- `highlightedRouteMeta`：记录本次渲染使用的 `width/height/yOffset/color/opacity`。
- `routeOverlayGroup`：挂载在 `roads` Group 下的 Three.js Group，存放全部光带 Mesh，自动继承 `SCENE_BASE_ALIGNMENT`。

### 渲染流程
1. `renderRouteOverlay(pointPath, options)`：
   - 先调用 `clearRouteOverlay()` 释放旧 Mesh 与材质。
   - 将 `pointPath` 转换为 `THREE.CatmullRomCurve3`，可选平滑重新取样。
   - 使用 `THREE.TubeGeometry`（或 `Line2`）依据 `options.width/height/yOffset` 构建 Mesh，材质采用 `MeshStandardMaterial`（或 ShaderMaterial）以实现颜色 + 透明 + 自发光感。
   - 将 Mesh 添加到 `routeOverlayGroup`。
2. `clearRouteOverlay()`：
   - 遍历 `routeOverlayGroup.children` 调用 `geometry.dispose()`、`material.dispose()`，并移除节点。
   - 清空 store 中 `highlightedRoutePath`、`highlightedRouteMeta`，同时清除调试折线。

### App.jsx 接入
1. `highlightRouteByPoiNames`：
   - 根据 POI 求最短路，获得 `pointPath`、`roadIds`、`totalLength`。
   - 调用 `setHighlightedRoutePath(pointPath)`、`setActiveRoute({ from, to, length })`、`setHighlightedRoads(roadIds)`。
   - 读取 `config.poiRoute.highlightMesh` 作为 `options` 并传给 `renderRouteOverlay(pointPath, options)`。
   - 继续绘制 `drawRouteDebug(pointPath)` 供开发调试。
   - 成功后 `logInfo("路线光带", { from, to, length, nodes: pointPath.length })`。
2. `clearRouteHighlight()`：
   - 调用 `clearRouteOverlay()`、`setHighlightedRoads([])`、`setActiveRoute(null)`，并移除调试折线。
   - 记录 `logInfo("路线光带", "已清除")`。

### DebugPanel / UI
- 展示 `{ from, to, length }` 字段与起终点 POI 名称。
- 提供“清空路线”按钮，优先调用 `window.clearRouteHighlight`，否则直接调用 store setter。
- 在开发模式可增加宽度/高度/颜色/透明度调节控件，写入 `highlightedRouteMeta` 后再次 `renderRouteOverlay`。

### 日志与验收
- 成功：`logInfo("路线光带", { from, to, length, nodes: pointPath.length })`。
- 验收录屏需展示 “输入命令 → 光带出现 → DebugPanel 显示 → 点击清空 → 光带移除”。

---

## 后续扩展（非本阶段范围）
- UI 表单 / 搜索建议。
- 多路线对比、分段变色、动画等。
- 与语音导航、地面 AR 提示联动。
