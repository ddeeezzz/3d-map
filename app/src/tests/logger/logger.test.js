import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

vi.mock("dayjs", () => ({
  default: () => ({
    format: () => "12:34:56",
  }),
}));

import logger, {
  logInfo,
  logDebug,
  logWarn,
  logError,
} from "../../logger/logger.js";

describe("logger", () => {
  let logSpy;
  let debugSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logInfo 输出包含附加数据", () => {
    logInfo("数据管线", "生成成功", { 特征数: 512 });
    expect(logSpy).toHaveBeenCalledWith(
      '[12:34:56][INFO][数据管线] 生成成功｜数据：{"特征数":512}'
    );
  });

  it("logDebug 输出基本字符串", () => {
    logDebug("三维渲染", "进入 debug");
    expect(debugSpy).toHaveBeenCalledWith(
      "[12:34:56][DEBUG][三维渲染] 进入 debug"
    );
  });

  it("logWarn 使用 console.warn 输出", () => {
    logWarn("导航面板", "出现异常");
    expect(warnSpy).toHaveBeenCalledWith(
      "[12:34:56][WARN][导航面板] 出现异常"
    );
  });

  it("logError 使用 console.error 输出", () => {
    logError("三维渲染", "渲染失败");
    expect(errorSpy).toHaveBeenCalledWith(
      "[12:34:56][ERROR][三维渲染] 渲染失败"
    );
  });

  it("默认导出包含四个方法", () => {
    expect(logger).toMatchObject({
      logInfo,
      logDebug,
      logWarn,
      logError,
    });
  });
});
