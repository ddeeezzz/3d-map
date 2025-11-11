#!/usr/bin/env node
const { mkdirSync, writeFileSync } = require("fs");
const { resolve, dirname, join } = require("path");
const { spawnSync } = require("child_process");

const projectRoot = resolve(__dirname, "..");
const inputPath = join(projectRoot, "map.osm");
const outputPath = join(projectRoot, "data", "tmp.json");
const appDir = join(projectRoot, "app");

mkdirSync(dirname(outputPath), { recursive: true });

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const isWin = process.platform === "win32";
const command = isWin ? process.env.ComSpec || "cmd.exe" : pnpmCmd;
const args = isWin
  ? ["/c", "pnpm", "exec", "osmtogeojson", inputPath]
  : ["exec", "osmtogeojson", inputPath];

const result = spawnSync(command, args, {
  cwd: appDir,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 64,
});

if (result.status !== 0) {
  const errorMessage =
    result.stderr ||
    result.stdout ||
    (result.error ? result.error.message : "未知错误");

  console.error("[convert-osm] 命令执行失败：", errorMessage);
  process.exit(result.status ?? 1);
}

writeFileSync(outputPath, result.stdout, "utf8");
console.log(`[convert-osm] 已生成临时文件：${outputPath}`);
