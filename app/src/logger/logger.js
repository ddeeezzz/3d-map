/**
 * 日志模块：统一的日志输出接口
 * 
 * 职责：
 * 提供四个等级的日志函数（INFO、DEBUG、WARN、ERROR），统一格式和输出方式
 * 所有日志包含时间戳、等级前缀、模块名和消息内容，支持额外数据对象
 * 
 * 使用场景：
 * - 初始化流程：记录场景加载、数据解析等关键步骤
 * - 用户交互：记录建筑选中、图层切换等事件
 * - 错误处理：记录异常信息便于调试
 * 
 * 输出格式：[HH:mm:ss][等级][模块名] 消息｜数据：{...}
 * 例：[14:30:45][INFO][三维渲染] Three.js 场景初始化完成
 */

import dayjs from "dayjs";

/**
 * methodMap：日志等级到 console 方法的映射
 * 映射关系：
 * - INFO → console.log（一般信息）
 * - DEBUG → console.debug（调试信息）
 * - WARN → console.warn（警告信息）
 * - ERROR → console.error（错误信息）
 */
const methodMap = {
  INFO: "log",
  DEBUG: "debug",
  WARN: "warn",
  ERROR: "error",
};

/**
 * getWriter：根据日志等级获取对应的 console 输出函数
 * 
 * 参数：level - 日志等级字符串（"INFO"/"DEBUG"/"WARN"/"ERROR"）
 * 返回：console 对象的对应方法（已绑定 this 上下文）
 * 异常：若等级不存在或 console 未提供该方法，抛出 Error
 * 
 * 用途：内部工具函数，被 writeLog 调用以获取正确的输出方法
 */
function getWriter(level) {
  const method = methodMap[level];
  if (!method || typeof console[method] !== "function") {
    throw new Error(`Unknown log level: ${level}`);
  }
  return console[method].bind(console);
}

/**
 * formatExtra：格式化日志的额外数据对象
 * 
 * 参数：extra - 任意类型的额外信息（通常为对象）
 * 返回：格式化字符串 "｜数据：{JSON}" 或空字符串
 * 
 * 逻辑：
 * - 若 extra 为 null/undefined，返回空字符串（不打印数据段）
 * - 正常情况下，使用 JSON.stringify 序列化对象
 * - 若序列化失败，降级为 String() 转换，避免整个日志输出失败
 * 
 * 例：formatExtra({ 错误: "网络超时" }) → "｜数据：{"错误":"网络超时"}"
 */
function formatExtra(extra) {
  if (extra == null) {
    return "";
  }
  try {
    return `｜数据：${JSON.stringify(extra)}`;
  } catch (_error) {
    return `｜数据：${String(extra)}`;
  }
}

/**
 * writeLog：内部日志写入函数，组装完整的日志行
 * 
 * 参数：
 * - level: 日志等级（"INFO"/"DEBUG"/"WARN"/"ERROR"）
 * - moduleName: 模块名称，用于标识日志来源（如"三维渲染"、"数据处理"）
 * - message: 日志消息文本（中文）
 * - extra: 额外的数据对象（可选），将被 JSON 序列化
 * 
 * 副作用：调用 console 对应方法输出完整的格式化日志行
 * 格式示例：[14:30:45][INFO][三维渲染] Three.js 场景初始化完成｜数据：{...}
 */
function writeLog(level, moduleName, message, extra) {
  // 获取对应等级的 console 输出方法
  const writer = getWriter(level);
  
  // 规范化模块名和消息：去除首尾空白，确保非空
  const resolvedModule = (moduleName ?? "未命名模块").trim();
  const resolvedMessage = (message ?? "未提供内容").trim();
  
  // 获取当前时间（精确到秒），格式：HH:mm:ss
  const time = dayjs().format("HH:mm:ss");
  
  // 格式化额外数据
  const extraSegment = formatExtra(extra);
  
  // 组装完整日志行并输出：[时间][等级][模块] 消息 + 额外数据
  writer(`[${time}][${level}][${resolvedModule}] ${resolvedMessage}${extraSegment}`);
}

/**
 * logInfo：记录一般信息日志（等级：INFO）
 * 
 * 参数：
 * - moduleName: 模块名称（中文）
 * - message: 日志消息（中文）
 * - extra: 额外信息对象（可选）
 * 
 * 用途：
 * - 初始化完成提示：logInfo("三维渲染", "场景初始化完成")
 * - 用户操作反馈：logInfo("三维交互", `选中 ${buildingName}`)
 * 
 * 示例：
 * logInfo("数据处理", "GeoJSON 解析完成", { 建筑数: 120, 道路数: 45 })
 */
export function logInfo(moduleName, message, extra = null) {
  writeLog("INFO", moduleName, message, extra);
}

/**
 * logDebug：记录调试日志（等级：DEBUG）
 * 
 * 参数同 logInfo
 * 用途：开发调试阶段的详细信息，生产环境通常被过滤
 * 
 * 示例：
 * logDebug("坐标转换", "投影原点", { 经度: 104.05, 纬度: 30.64 })
 */
export function logDebug(moduleName, message, extra = null) {
  writeLog("DEBUG", moduleName, message, extra);
}

/**
 * logWarn：记录警告日志（等级：WARN）
 * 
 * 参数同 logInfo
 * 用途：表示可能的问题但程序继续执行的情况
 * 
 * 示例：
 * logWarn("数据清洗", "建筑高度数据缺失，使用默认值", { 建筑ID: "BLDG001" })
 */
export function logWarn(moduleName, message, extra = null) {
  writeLog("WARN", moduleName, message, extra);
}

/**
 * logError：记录错误日志（等级：ERROR）
 * 
 * 参数同 logInfo
 * 用途：记录异常和错误，用于问题诊断
 * 
 * 示例：
 * logError("三维渲染", "着色器编译失败", { 着色器: "buildingVS", 原因: error.message })
 */
export function logError(moduleName, message, extra = null) {
  writeLog("ERROR", moduleName, message, extra);
}

/**
 * logger：导出的日志模块对象，包含所有四个日志函数
 * 用途：允许通过 import logger 后使用 logger.logInfo(...) 等调用方式
 * 
 * 备选导入方式：
 * - import { logInfo, logDebug, logWarn, logError } from './logger/logger'
 * - import logger from './logger/logger'; logger.logInfo(...)
 */
const logger = {
  logInfo,
  logDebug,
  logWarn,
  logError,
};

export default logger;
