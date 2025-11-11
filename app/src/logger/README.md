# logger

- `logger.js` 导出 `logInfo/logDebug/logWarn/logError` 四个方法，输出 `[HH:mm:ss][LEVEL][模块] 消息`。
- 依赖 `dayjs` 生成时间戳，附加数据通过 `｜数据：...` 拼接，调用方负责确保文字为中文。
- 测试见 `src/tests/logger/logger.test.js`，覆盖基本输出场景。
