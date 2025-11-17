# src/tests 说明

集中管理 Vitest 用例，目录结构与 `src/` 同步，方便定位。请勿在业务目录再建 `__tests__`。

## 目录结构

- `components/`：React 组件测试，使用 `@testing-library/react`。
- `lib/`：纯函数测试。
- `logger/`：日志输出测试。
- `store/`：Zustand 状态行为测试。
- `three/`：几何构建与交互模块测试，可使用 three-mock/虚拟 WebGL。
- `tools/`：数据脚本或辅助函数测试。

## 规范

- 文件命名 `<module>.test.js|jsx`，与被测文件同名。
- 所有测试需中文描述 `describe/it`，并覆盖核心流程、边界情况、错误分支。
- 涉及异步需使用 `await` + `vi.useFakeTimers` 或 `waitFor`。
- 运行命令：在 `t2/app` 内执行 `pnpm run test`；调试单个文件可 `pnpm vitest run src/tests/<path>.test.js`。

## 覆盖要求

- Three.js 构建函数至少验证：数据过滤、几何数量、关键属性（高度/颜色）。
- 交互模块需模拟 hover/click，断言 store/日志写入。
- React 组件测试：渲染、交互、副作用（store setter/log）。
- 关键工具函数需测试异常输入，防止数据污染。
