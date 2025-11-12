# three

- `initScene.js`：初始化 Scene/Camera/Renderer/OrbitControls，开发模式下添加 Grid/Axes helper，并立即挂载 canvas。
- `buildBuildings.js`：静态 `import "./data/campus.geojson?raw"`，解析 GeoJSON，生成 `ExtrudeGeometry` Mesh，写入 `userData`（stableId/name/category）并按分类设置半透明材质后挂载到场景。
- `interactions/buildingPicking.js`：封装 Raycaster 拾取逻辑，监听 `pointermove`/`click`，在 hover 时高亮 Mesh 并回调，离开时恢复；供 `App.jsx` 调用以写入 store 与记录日志。
- 后续可继续添加 `navigation.js` 等模块，用于路径动画或其他三维效果。
