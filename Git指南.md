# Git 指南

本文档简明说明常用命令与 VSCode 中的可视化反馈。

---

## 基本命令

### 1. `git add .`

**作用**：将当前工作目录中所有被修改、新增或删除的文件添加到暂存区（Staging Area）。

```bash
git add .
```

- `.` 表示当前目录及其所有子目录
- 文件进入暂存区后才能被提交
- **类比**：把文件放入购物车，等待结账

---

### 2. `git commit -m "xxxx"`

**作用**：将暂存区中的文件提交到本地仓库，并附加一条提交消息。

```bash
git commit -m "添加导航面板组件"
```

- 引号内的文本是提交消息，用于描述本次改动
- 建议提交消息简洁明了，用中文或英文均可
- **类比**：结账并记录购买清单

---

### 3. `git log --encoding=UTF-8`

**作用**：查看提交历史日志，显示所有曾经提交的记录。

```bash
git log --encoding=UTF-8
```

- `--encoding=UTF-8` 确保中文提交消息正常显示
- 显示内容：提交哈希值、作者、时间、提交消息
- 按时间倒序排列（最新在最上方）
- 按 `q` 键退出日志视图

---

## VSCode 中的可视化反馈

### 资源管理器中的文件状态指示

**位置**：文件/文件夹右侧显示单字母标记（仅在 Git 项目中显示）

| 标记 | 含义 | 说明 |
|------|------|------|
| `M` | Modified | 文件已修改，还未暂存 |
| `U` | Untracked | 新增文件，尚未添加到 Git |
| `D` | Deleted | 文件已删除 |
| `A` | Added | 文件已添加到暂存区 |
| （无标记） | Clean | 文件与上次提交一致 |

**示例**：
```
📁 src
  📄 App.jsx                    ← 无标记，已提交
  📄 components
    📄 InfoCard.jsx      M      ← 已修改
    📄 NewPanel.jsx      U      ← 新文件
```

**执行 `git add .` 后**：
```
📁 src
  📄 App.jsx
  📄 components
    📄 InfoCard.jsx      A      ← 标记变为 A
    📄 NewPanel.jsx      A      ← 标记变为 A
```

**执行 `git commit -m "xxx"` 后**：
```
📁 src
  📄 App.jsx
  📄 components
    📄 InfoCard.jsx             ← 所有标记消失
    📄 NewPanel.jsx
```

---

### 代码编辑窗口中的行号左侧指示

**位置**：代码文件左侧行号与代码之间

| 指示 | 含义 | 说明 |
|------|------|------|
| 红色竖线 | 删除行 | 此行在上次提交后被删除 |
| 绿色竖线 | 新增行 | 此行在上次提交后被新增 |
| 蓝色竖线 | 修改行 | 此行在上次提交后被修改 |
| （无指示） | 未变化 | 此行与上次提交相同 |

**提示**：鼠标点击在彩色竖线，VSCode 会显示变化的具体内容。

---

## 完整工作流示例

### 场景：新增一个功能文件

**第 1 步**：创建文件 `lib/helper.js`
```
📄 lib/helper.js         U      ← VSCode 显示 U
```

**第 2 步**：修改文件内容（3 行新增）
```javascript
// 代码窗口显示绿色竖线
export function formatName(name) {
  return name.toUpperCase();
}
```

**第 3 步**：运行 `git add .`
```
📄 lib/helper.js         A      ← 资源管理器显示 A
```

**第 4 步**：运行 `git commit -m "新增字符串格式化工具"`
```
📄 lib/helper.js                ← 标记消失，代码窗口绿色竖线消失
```

**第 5 步**：查看日志
```bash
$ git log --encoding=UTF-8
commit a1b2c3d4e5f6g7h8i9j0k1l2
Author: Your Name <your.email@example.com>
Date:   Thu Dec 19 10:30:00 2024 +0800

    新增字符串格式化工具
```

---

## 回退

### 查看距离上次commit修改了什么

参考VSCode 中的可视化反馈

---

### 回退修改到上次提交

**场景**：修改效果不合预期，想恢复到上次提交的版本。

**方式一：丢弃单个文件的修改**

```bash
git checkout -- src/App.jsx
```

- 将 `src/App.jsx` 恢复到上次提交的版本
- 未暂存的修改直接丢弃

**方式二：丢弃所有未暂存的修改**

```bash
git checkout -- .
```

- 当前目录及子目录所有文件恢复到上次提交版本
- 已执行 `git add .` 的文件不受影响

**方式三：丢弃已暂存的修改（执行过 git add）**

```bash
git reset HEAD .
```

- 从暂存区移除所有文件，恢复为未暂存状态
- 之后再运行 `git checkout -- .` 丢弃修改

**方式四：软回退（保留修改）**

```bash
git reset --soft HEAD~1
```

- 回退到上一次提交，但保留所有修改在暂存区
- 适合重新调整提交或修改提交消息
- `HEAD~1` 表示上一次提交，`HEAD~2` 表示上两次，以此类推

**方式五：硬回退（丢弃所有修改）**

```bash
git reset --hard HEAD~1
```

- 回退到上一次提交，**彻底丢弃**本地所有修改
- 危险操作，确认无需保留修改再执行
- 同样可用 `HEAD~2` 等指定回退次数

---

## 常见问题

**Q：为什么提交后 VSCode 中还有标记？**

A：可能是你新建了文件但还没 `git add`，或者本地文件与远程仓库不同步。运行 `git status` 查看状态。

**Q：如何看到具体修改了什么？**

A：点击 VSCode 左侧"Source Control"标签页（Ctrl+Shift+G），查看"Changes"列表，点击文件可看具体 diff。

**Q：`git log` 信息太多，怎样只看最近几次提交？**

A：使用 `git log -n 5 --encoding=UTF-8` 只看最近 5 次提交。

---

**相关文档**：
- [`AGENTS.md`](AGENTS.md)：编码规范
- [`必读-协作.md`](必读-协作.md)：代码文件管理规范
