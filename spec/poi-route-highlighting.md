# POI 路径高亮 Spec

## 背景与目标
- 使用者希望在浏览器控制台输入两个 POI 名称，页面即可根据校园道路高亮它们之间的推荐路径。
- 现有数据只包含道路几何与 POI 位置，没有图结构与最短路逻辑，需构建路网、寻径与渲染高亮三部分。
- 采用“三阶段推进”方式，避免一次性改动过大，便于迭代验证。

## 阶段一：路网数据准备（数据清洗 + 图构建）
- **目标**：在数据层生成可寻径的路网图，前端可直接加载使用。
- **允许修改范围**：
  - `tools/` 下新增 `build-road-graph.js`；
  - `data/roads-graph.json`（以及 `app/src/data/roads-graph.json` 的同步副本）；
  - `spec/data-pipeline.md` 更新。
- **完成方法**：
  1. **节点抽取**：
     - 遍历 `campus.geojson` 中 `featureType = "road"` 的所有折线；
     - **保留全部顶点**（包括端点与中间控制点），不进行 Douglas-Peucker 等简化；
     - 对坐标差值 ≤ 0.1 米的顶点进行去重并复用同一节点 ID；
     - 为每个节点写入 `{ id, lng, lat, worldX, worldZ }`，其中 worldX/worldZ 使用与 Three.js 一致的投影。
  2. **边构建**：每条折线相邻两点形成一条边，记录：
     - `fromNodeId`、`toNodeId`；
     - `length`（按米制距离计算）；
     - `roadId`（方便渲染时映射回原始 Mesh）。
     - 保持双向（若未来需限制方向，可在数据中标记）。
  3. **POI 映射准备**：输出节点坐标，供前端将 POI 投影后找到最近节点。
  4. **导出文件**：`roads-graph.json` 结构建议包含
     ```json
     {
       "nodes": [{ "id": "node-1", "x": 0, "z": 0 }],
       "edges": [{ "from": "node-1", "to": "node-2", "length": 12.3, "roadId": "road-abc" }],
       "metadata": { "projectionOrigin": [lng, lat], "version": "2025-02-xx" }
     }
     ```
  5. **回归**：在 `data/reports/road-graph.json` 记录节点数、边数、孤立节点列表；日志写 `logInfo("路网图生成", {...})`。

## 阶段二：控制台命令 + 最短路计算
- **目标**：在前端加载路网图，允许在控制台输入函数 `highlightRouteByPoiNames("图书馆", "体育馆")`，即启动最短路并收集涉及的道路段。
- **允许修改范围**：
  - `app/src/lib/roadGraph.js`：解析 `roads-graph.json`、提供 `findNearestNode(x,z)`、`findShortestPath(startNode, endNode)`（Dijkstra/A*）。
  - `app/src/data/roads-graph.json`（由阶段一生成）。
  - `app/src/store/useSceneStore.js`：新增 `highlightedRoadIds`、`setHighlightedRoads`。
  - `app/src/App.jsx` 或 `initScene.js`：挂载 `window.highlightRouteByPoiNames` 便利函数。
  - `app/src/logger/logger.js`：允许新日志前缀。
- **完成方法**：
  1. **载入数据**：在应用初始化时加载 `roads-graph.json`，构建内存图（节点数组 + 邻接表）。
  2. **POI 映射**：
     - 复用 `buildPois.js` 的投影函数取得 POI 的 world 坐标；
     - 搜索 20 米半径内的最近边，若无则直接抛出 “POI 未贴合道路”；
     - 命中边后，按距离在该边上插入**临时节点**：计算 t=distance(from→POI)/edgeLength，在 `{from→temp→to}` 之间生成两条临时边；
     - 临时节点 ID 与边仅在当前寻径过程中存在，算法结束后销毁。
  3. **寻径实现**：
     - 对常规节点 + 可能存在的临时节点运行 Dijkstra（或 A*）；
     - 返回 `{ nodes, edges, tempNodes }`，其中 edges 至少包含 `edgeId/roadId` 以便渲染高亮；
     - 若起点终点本就是同一节点，直接返回空路径并提示 “起终点重合”。
  4. **控制台 API**：在 `window` 注入 `highlightRouteByPoiNames(nameA, nameB)`：
     ```js
     window.highlightRouteByPoiNames = (nameA, nameB) => {
       const poiA = poiStore.findByName(nameA);
       const poiB = poiStore.findByName(nameB);
       if (!poiA || !poiB) {
         console.warn("POI 不存在");
         return;
       }
       const path = roadGraph.findShortestPath(poiA, poiB);
       useSceneStore.getState().setHighlightedRoads(path.roadIds);
       logInfo("POI 路径高亮", { from: nameA, to: nameB, length: path.totalLength });
     };
     ```
  5. **回归**：编写最小单测（`roadGraph.test.js`）验证 Dijkstra 结果正确；在浏览器控制台演示并截图。

## 阶段三：渲染层优化（高亮道路 + UI）
- **目标**：让最短路结果在页面显著呈现（例如红色道路、路径动画），并提供基础 UI。
- **允许修改范围**：
  - `app/src/three/buildRoads.js`：只需沿用既有道路高亮材质（如 roadPicking 中的 emissive 方案），根据 `highlightedRoadIds` 切换现有 Mesh 材质即可。
  - `app/src/components/DebugPanel.jsx` / `InfoCard`：可显示当前路线长度、起讫 POI 名称。
  - `useSceneStore.js`：增加 `activeRoute = { from, to, length }` 等。
  - `spec/ui.md` 更新说明。
- **完成方法**：
  1. **状态联动**：`highlightRouteByPoiNames` 运行后，除了更新 `highlightedRoadIds`，还写入 `activeRoute` 供 React 组件显示（例如 DebugPanel 中 “当前路线：图书馆 → 体育馆，长度 320m”）。
  2. **清除机制**：提供 `clearRouteHighlight()` 控制台函数或 UI 按钮，调用 `setHighlightedRoads([])`。
  3. **日志与验收**：高亮成功记录 `logInfo("路网高亮", {...})`；录屏展示输入命令 → 高亮效果 → 清除流程。

## 后续扩展（非本阶段）
- 按类别筛选 POI / 支持模糊搜索；
- 提供 UI 表单输入而非控制台；
- 支持多段路径、避让特定道路、步行/骑行等模式；
- 结合实时定位或导航动画。
