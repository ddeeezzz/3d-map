# store

- `useSceneStore.js` 使用 Zustand 存放全局状态（建筑选中、导航、图层可见性、日志预览、sceneTransform 等），供 React/Three.js/deck.gl 共享。
- `sceneTransform` 仅存储相对于基准对齐（`SCENE_BASE_ALIGNMENT`，旋转 54°、偏移 -500/-141）的增量；Three.js 在应用时会将基准与增量相加，保证调试面板的初始值显示为 0。
- 所有写操作通过 store 暴露的 setter 完成，禁止在外部直接 mutate state。
- 调试面板、地图交互等模块都应复用此 store，字段定义见 `spec/store.md`。
