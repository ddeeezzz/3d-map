# 指南面板组件集成 Spec

## 背景与目标

将版本2中的图书馆使用指南面板和体育馆使用指南面板组件添加到当前项目中，丰富UI功能，为用户提供详细的图书馆和体育馆使用信息。

## 组件说明

### LibraryGuidePanel（图书馆使用指南面板）

- **位置**：页面左侧中间位置（`top: 50%`）
- **功能**：提供图书馆相关的5个功能入口
  - 开放时间：展示日常开放时间、法定节假日、寒暑假期间的开放安排
  - 楼层功能分区：展示二楼功能分区、各楼层阅览室分布及图片
  - 图书借阅/还书流程：详细说明借阅和还书的步骤与注意事项
  - 违规与补救措施：说明座位预约和图书借阅的违规行为界定、处理规则及补救措施
  - 座位预约：介绍官网预约、微信公众号预约、馆内选位机预约三种方式

### GymnasiumGuidePanel（体育馆使用指南面板）

- **位置**：页面左侧，位于图书馆指南面板下方（`top: calc(50% + 70px)`）
- **功能**：提供体育馆相关的4个功能入口
  - 场馆功能分区与核心设施：介绍篮球馆、羽毛球馆、乒乓球馆、健身房、体质测试区
  - 体质健康测试专项安排：说明测试时间、场地、内容与规范、注意事项
  - 场馆日常使用规范与预约流程：展示开放时间、使用规范、预约流程、违约处理
  - 服务与应急保障：介绍服务项目、医疗急救、消防安全、安保监控、恶劣天气应对

## 文件清单

### 需要复制的文件

1. **组件文件**（`app/src/components/`）：
   - `LibraryGuidePanel.jsx`
   - `LibraryGuidePanel.css`
   - `GymnasiumGuidePanel.jsx`
   - `GymnasiumGuidePanel.css`

2. **资源文件**（`app/public/`）：
   - `OIP.webp`：图书馆二楼功能分区图片
   - `OIP (1).webp`：图书馆阅览室图片

### 需要修改的文件

- `app/src/App.jsx`：
  - 添加组件导入语句
  - 在return语句中添加组件使用

## 实施步骤

### 1. 复制组件文件

从 `版本2/app/src/components/` 复制以下文件到 `app/src/components/`：
- `LibraryGuidePanel.jsx`
- `LibraryGuidePanel.css`
- `GymnasiumGuidePanel.jsx`
- `GymnasiumGuidePanel.css`

### 2. 复制资源文件

从 `版本2/app/public/` 复制以下图片文件到 `app/public/`：
- `OIP.webp`
- `OIP (1).webp`

### 3. 修改 App.jsx

在 `app/src/App.jsx` 文件顶部导入区域添加：
```javascript
import LibraryGuidePanel from "./components/LibraryGuidePanel";
import GymnasiumGuidePanel from "./components/GymnasiumGuidePanel";
```

在return语句中，在 `<DebugPanel />` 之前添加：
```jsx
{/* 图书馆使用指南面板 */}
<LibraryGuidePanel />

{/* 体育馆使用指南面板 */}
<GymnasiumGuidePanel />
```

### 4. 验证

- 确认组件正常显示在页面左侧
- 验证点击按钮后面板正常弹出
- 确认各个功能按钮的弹窗正常显示
- 验证图片资源正常加载

## 样式说明

- 两个组件使用固定定位（`position: fixed`），位于页面左侧
- 组件按钮采用渐变色背景（图书馆：紫色渐变，体育馆：橙色渐变）
- 弹出面板使用毛玻璃效果（`backdrop-filter: blur(10px)`）
- 模态弹窗采用居中显示，宽度固定（750-850px），最大高度为80vh
- 支持响应式设计，在移动端（`max-width: 768px`）会自动调整布局

## 注意事项

1. **组件定位**：
   - LibraryGuidePanel 位于左侧中间（`left: 20px, top: 50%`）
   - GymnasiumGuidePanel 位于 LibraryGuidePanel 下方（`left: 20px, top: calc(50% + 70px)`）

2. **图片路径**：
   - LibraryGuidePanel 中引用的图片路径为 `/OIP.webp` 和 `/OIP (1).webp`
   - 这些图片必须放在 `public` 目录下，才能通过 `/` 路径访问

3. **样式冲突**：
   - 两个组件都使用了 `.modal-overlay` 和 `.modal-content` 类名
   - 这些样式在各自的 CSS 文件中都有定义，不会产生冲突

4. **交互逻辑**：
   - 组件内部使用 React 的 `useState` 管理面板和弹窗的显示状态
   - 每个功能按钮点击后会显示对应的详细内容弹窗
   - 弹窗可以通过点击遮罩层或关闭按钮关闭

## 测试建议

- 在开发环境中验证组件正常渲染
- 测试各个功能按钮的点击交互
- 验证弹窗内容的完整性和可读性
- 检查响应式布局在不同屏幕尺寸下的表现
- 确认图片资源加载正常

## 未来扩展

- 可以考虑将指南内容数据化，从配置文件或API加载
- 可以添加更多场馆的指南面板（如食堂、教学楼等）
- 可以优化移动端的交互体验
