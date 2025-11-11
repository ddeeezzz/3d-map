# 应用目录结构 Spec

## 目标
- 约定 `t2/app/src/` 内部子目录划分，保证 deck.gl、Three.js、React 组件和日志体系有统一落点。

## 目录划分
- `src/components/`
  - React 导航面板、信息卡片、图层开关等 UI 组件。
  - 遵循“纯 UI + hooks”模式，业务逻辑放入 `src/lib/` 或状态管理中。
- `src/lib/`
  - 数据解析、坐标转换、公共工具（高度计算、字典读取等）。
- `src/three/`
  - Three.js 场景封装（renderer、camera、lights、OrbitControls）。
  - `ExtrudeGeometry` 拉伸、导航轨迹动画等统一集中在此。
- `src/deck/`
  - deck.gl 图层定义（GeoJsonLayer、PathLayer、IconLayer 等）。
  - 输出工厂/Hook，供 React 组件控制图层开关。
- `src/logger/logger.js`
  - 中文日志模块，导出 `logInfo/logDebug/logWarn/logError` 等方法，负责时间戳与模块名检查。
- `src/config/`
  - 颜色映射、默认层高、API 端点、图层默认可见性等配置。
- `src/tests/`
  - 全局测试目录：集中存放 Vitest 单测（如 `logger/logger.test.js`、`lib/data-utils.test.js`）与后续集成测试。
  - 测试命名遵循 `<模块>/<文件>.test.js`，便于定位。

## 关联目录（按需启用）
- `src/data/`
  - 存放 `campus.geojson` 等静态数据，由数据管线脚本生成。
  - 在组件和 Three.js/deck.gl 中通过 `import` 或 `fetch` 加载。
- `src/store/`（可选）
  - 状态管理层：集中保存需要跨组件、Three.js、deck.gl 共享的状态。
  - 适合在交互复杂后再引入（Zustand、Context+Reducer 等）。

## TODO
- [x] 在 `t2/app/src/` 按上述结构创建空目录与占位 README。
- [ ] 在 `spec/rendering.md`、`spec/ui.md` 中补充与 `src/three/`、`src/deck/` 的接口关系（正式实现前先写清楚接口示例）。
