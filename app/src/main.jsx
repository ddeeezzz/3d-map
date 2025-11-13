/**
 * React 应用入口文件
 * 职责：挂载根组件 App 到 DOM，启用严格模式以检测潜在的副作用和不规范用法
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * 初始化 React 根节点并渲染应用
 * 使用 StrictMode 包装以便开发环境检测不安全的生命周期、过时 API 等问题
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
