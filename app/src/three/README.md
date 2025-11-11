# three

- `initScene.js` 负责创建 Scene/Camera/Renderer/OrbitControls 与基础灯光，并立即挂载 renderer canvas。
- 后续在此目录添加：
  - `buildBuildings.js`：解析 `campus.geojson`、生成 `ExtrudeGeometry`。
  - `navigation.js`：处理导航路径、`Line2` 动画。
- 所有 Three.js 相关逻辑集中在此，React 组件通过导出的函数获得 `{ scene, renderer, controls }`。
