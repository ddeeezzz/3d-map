# src/tests 说明

- 所有 Vitest 单元测试集中于此目录，按照 `<模块>/xxx.test.js` 组织（如 `logger/logger.test.js`、`lib/data-utils.test.js`）。
- 测试文件需 `import` 对应源文件（位于 `src/` 其他目录），禁止在业务目录中再创建 `__tests__`。
- 运行方式：在 `t2/app` 下执行 `pnpm run test`。
