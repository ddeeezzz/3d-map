# components/

React 导航面板、信息卡片、图层开关以及调试工具等 UI 组件。

遵循“纯 UI + hooks”模式，业务逻辑放入 `src/lib/` 或状态管理中。`DebugPanel.jsx` 仅在 DEV 环境显示，用于调节场景旋转/缩放/偏移并写入 store。
