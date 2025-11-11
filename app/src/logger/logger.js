import dayjs from "dayjs";

const latinRegex = /[A-Za-z]/;

const methodMap = {
  INFO: "log",
  DEBUG: "debug",
  WARN: "warn",
  ERROR: "error",
};

function getWriter(level) {
  const method = methodMap[level];
  if (!method || typeof console[method] !== "function") {
    throw new Error(`Unknown log level: ${level}`);
  }
  return console[method].bind(console);
}

function warnIfNonChinese(field, text) {
  if (!text) {
    return;
  }
  if (latinRegex.test(text)) {
    console.warn(`[日志模块][WARN] ${field}必须使用中文，收到：${text}`);
  }
}

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

function writeLog(level, moduleName, message, extra) {
  const writer = getWriter(level);

  const resolvedModule = (moduleName ?? "未命名模块").trim();
  const resolvedMessage = (message ?? "未提供内容").trim();

  warnIfNonChinese("模块名", resolvedModule);
  warnIfNonChinese("日志内容", resolvedMessage);

  const time = dayjs().format("HH:mm:ss");
  const extraSegment = formatExtra(extra);
  writer.call(console, `[${time}][${level}][${resolvedModule}] ${resolvedMessage}${extraSegment}`);
}

export function logInfo(moduleName, message, extra = null) {
  writeLog("INFO", moduleName, message, extra);
}

export function logDebug(moduleName, message, extra = null) {
  writeLog("DEBUG", moduleName, message, extra);
}

export function logWarn(moduleName, message, extra = null) {
  writeLog("WARN", moduleName, message, extra);
}

export function logError(moduleName, message, extra = null) {
  writeLog("ERROR", moduleName, message, extra);
}

const logger = {
  logInfo,
  logDebug,
  logWarn,
  logError,
};

export default logger;
