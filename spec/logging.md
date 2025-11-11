# 日志方案 Spec

## 目标
- 定义 `src/logger/logger.js` 的最小实现：除等级前缀外使用中文内容，并覆盖 `INFO / DEBUG / WARN / ERROR` 四个等级。
- 当前仅实现最小日志能力；若未来需要 LoggerViewer 或状态栏，再在此基础上扩展。

## 输出规范
- **等级**：仅允许 `INFO`、`DEBUG`、`WARN`、`ERROR` 作为前缀。
- **模块名 / 内容**：调用方需传入中文描述，但 logger 不再自动检测或警告，遵循规范的责任在调用方。
- **格式**：`[HH:mm:ss][等级][模块名] 消息`，示例：`[20:45:01][INFO][数据管线] 生成 campus.geojson 完成｜数据：{"特征数":512}`。
- **附加数据**：可选对象，存在时追加 `｜数据：<JSON字符串>`；若序列化失败则退回 `String(extra)`。

## 命名要求
- `src/logger/logger.js` 内的函数、变量、默认导出属性等标识符使用英文名称，与项目其他模块保持一致。
- 日志文本（模块名、内容）仍要求使用中文。

## API
- `logInfo(moduleName, message, extra = null)` → 输出 `INFO`。
- `logDebug(moduleName, message, extra = null)` → 输出 `DEBUG`。
- `logWarn(moduleName, message, extra = null)` → 输出 `WARN`。
- `logError(moduleName, message, extra = null)` → 输出 `ERROR`。
- 四个函数共用 `writeLog(level, moduleName, message, extra)`，职责：
  1. 使用 `dayjs().format("HH:mm:ss")` 获取时间；
  2. 组合 `[时间][等级][模块名]` 字符串，并在末尾追加 `formatExtra(extra)`；
  3. 根据等级调用 `console.log` / `console.debug` / `console.warn` / `console.error`。

## 使用约定
- 数据解析、配置加载、Three.js/deck.gl 初始化、网络请求、文件 IO 等非逐帧流程必须至少记录一条 `logInfo`。
- 渲染循环、鼠标移动等高频调用禁止写日志；如需记录，在进入循环前写一次即可。
- 捕获异常时，先 `logError` 再抛出或返回，logger 不吞异常。
- 当前实现不包含日志缓存；若未来需要 UI 订阅，再在此文件补充方案。

## TODO
- [ ] 在 `spec/ui.md` 中占位描述：若未来实现 LoggerViewer，则通过日志模块暴露的接口读取最新日志。
- [x] `src/logger/logger.js` 已按本 spec（2025-11-11）实现。
