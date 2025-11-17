# logger

统一封装日志输出，便于在 DebugPanel 中展示最近日志并分析交互问题。所有业务模块必须通过此处的 API 记录日志，不得使用 `console.log`。

## API

`logger.js` 导出 `logInfo/logDebug/logWarn/logError(moduleName, message, extra?)` 四个方法：

- 输出格式：`[HH:mm:ss][LEVEL][模块] 消息｜数据：<JSON>`。
- 时间使用 `dayjs().format("HH:mm:ss")`；extra 会被序列化为 JSON。
- 消息、模块名必须为中文，便于排查。

## 使用建议

- 可能失败但非逐帧调用的流程（数据加载、纹理初始化、Raycaster 命中、配置写入）至少写一条 `logInfo`。
- 错误场景请使用 `logError` 并附详细 extra，如 `{ stableId, reason }`。
- DebugPanel 通过 `useSceneStore.logsPreview` 展示最近 50 条日志，调用方应避免写入过大的 extra。

## 测试

- `src/tests/logger/logger.test.js` 覆盖等级输出与数据序列化；新增功能需同步扩充测试。
- 若调整输出格式，务必更新 DebugPanel、store 以及自动化测试。
