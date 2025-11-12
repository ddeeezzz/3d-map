# views

承载页面级或场景级的复合组件，例如覆盖在 Three.js 场景之上的 DeckOverlay。此目录下的组件负责调用 store、logger、deck.gl/three 等模块，实现跨层协同。

- `DeckOverlay.jsx`：根据 `campus.geojson` 生成建筑轮廓，使用 `coordinates` 工具投影到平面后，在 `modelMatrix` 中先旋转 -90°（贴合 XZ 平面），再应用 `SCENE_BASE_ALIGNMENT` 与 `sceneTransform` 的缩放/旋转/偏移，保障与 Three.js 建筑完全对齐。hover tooltip 与点击事件遵循 `spec/rendering.md` Phase 1 要求。
