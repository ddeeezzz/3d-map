# 日志方案 Spec

## 目标
- 定义 `src/logger/logger.js` 的最小实现：除等级前缀外的日志内容全部使用中文，并覆盖 `INFO / DEBUG / WARN / ERROR` 四个等级。
- 当前仅实现最小日志能力；若未来需要 LoggerViewer 或状态栏，再在此基础上扩展。

## 输出规范
- **等级**：仅允许 `INFO`、`DEBUG`、`WARN`、`ERROR` 作为前缀。
- **模块名**：调用方传入中文描述（如“数据管线”“三维渲染”“导航面板”）；若检测到英文字符需在控制台告警。
- **格式**：`[HH:mm:ss][等级][模块名] 消息`，示例：`[20:45:01][INFO][数据管线] 生成 campus.geojson 完成｜数据：{"特征数":512}`。
- **附加数据**：可选对象，存在时追加 `｜数据：<JSON 字符串>`；若序列化失败则退回 `String(extra)`。

## 命名要求
- `src/logger/logger.js` 内所有自定义标识符（函数名、变量名、默认导出属性等）统一使用英文名称，保持与项目其余代码一致。
- 日志文本中的模块名与内容依旧要求是中文。

## API
- `logInfo(moduleName, message, extra = null)` → 输出 `INFO`。
- `logDebug(moduleName, message, extra = null)` → 输出 `DEBUG`。
- `logWarn(moduleName, message, extra = null)` → 输出 `WARN`。
- `logError(moduleName, message, extra = null)` → 输出 `ERROR`。
- 四个函数共用 `writeLog(level, moduleName, message, extra)`，其职责：
  1. 使用 `dayjs().format("HH:mm:ss")` 获取时间；
  2. 校验模块名、消息是否含英文字符，若有则 `console.warn` 提示；
  3. 根据等级调用 `console.log` / `console.debug` / `console.warn` / `console.error`。

## 使用约定
- 数据解析、配置加载、Three.js/deck.gl 初始化、网络请求、文件 IO 等非逐帧流程必须至少记录一条 `logInfo`。
- 渲染循环、鼠标移动等高频调用禁止写日志；如需记录，在进入循环前写一次即可。
- 捕获异常时，先 `logError` 再抛出或返回，logger 不吞异常。
- 当前实现不包含日志缓存；若未来需要 UI 订阅，再在此文件中补充方案。

## TODO
- [ ] 在 `spec/ui.md` 中占位描述：若未来实现 LoggerViewer，则通过日志模块暴露的接口读取最新日志。
- [x] `src/logger/logger.js` 已按本 spec（2025-11-11）实现。
