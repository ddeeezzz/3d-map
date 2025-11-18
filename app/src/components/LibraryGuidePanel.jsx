/**
 * LibraryGuidePanel 组件：图书馆使用指南面板
 * 
 * 职责：
 * 1. 在地图左侧显示"图书馆使用指南"按钮
 * 2. 点击按钮后弹出包含五个功能按钮的面板
 * 3. 提供开放时间、楼层功能分区、图书借阅/还书流程、违规与补救措施、座位预约功能入口
 */

/** React 状态钩子：用于控制各类弹窗开关 */
import { useState } from "react";
/** React DOM Portal：将弹窗传送至 body，确保相对视口定位 */
import { createPortal } from "react-dom";
/** 全局场景状态：管理图书馆指南面板显隐 */
import { useSceneStore } from "../store/useSceneStore";
/** 样式文件：提供按钮、弹窗与内容布局 */
import "./LibraryGuidePanel.css";

/**
 * ModalPortal 组件：将弹窗内容通过 Portal 渲染到 body，避免父级 transform 影响 fixed 定位
 * @param {Object} props - 组件参数
 * @param {JSX.Element} props.children - 弹窗内部结构
 * @param {() => void} props.onClose - 点击遮罩时触发的关闭回调
 * @param {string} props.contentClassName - 弹窗主体样式类，便于复用不同布局
 * @returns {JSX.Element} Portal 结构
 */
function ModalPortal({ children, onClose, contentClassName }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={contentClassName}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function LibraryGuidePanel() {
  const isOpen = useSceneStore((state) => state.guidePanelsVisible?.library);
  const setGuidePanelVisible = useSceneStore((state) => state.setGuidePanelVisible);
  // 控制开放时间详情弹窗
  const [showOpeningHours, setShowOpeningHours] = useState(false);
  // 控制楼层功能分区弹窗
  const [showFloorLayout, setShowFloorLayout] = useState(false);
  // 控制图书借阅/还书流程弹窗
  const [showBorrowReturn, setShowBorrowReturn] = useState(false);
  // 控制座位预约弹窗
  const [showSeatReservation, setShowSeatReservation] = useState(false);
  // 控制违规与补救措施弹窗
  const [showViolations, setShowViolations] = useState(false);

  // 切换面板显示状态
  const togglePanel = () => {
    setGuidePanelVisible("library", !isOpen);
  };

  // 关闭面板
  const closePanel = () => {
    setGuidePanelVisible("library", false);
  };

  // 五个功能按钮的点击处理（暂时占位，后续实现具体功能）
  const handleOpeningHours = () => {
    setShowOpeningHours(true);
  };

  const handleFloorLayout = () => {
    setShowFloorLayout(true);
  };

  const handleBorrowReturn = () => {
    setShowBorrowReturn(true);
  };

  const handleViolations = () => {
    setShowViolations(true);
  };

  const handleSeatReservation = () => {
    setShowSeatReservation(true);
  };

  return (
    <div className="library-guide-container">
      {/* 主按钮：图书馆使用指南 */}
      <button className="library-guide-main-btn" onClick={togglePanel}>
        📚 图书馆使用指南
      </button>

      {/* 弹出面板 */}
      {isOpen && (
        <div className="library-guide-panel">
          {/* 面板头部 */}
          <div className="library-guide-header">
            <h3>图书馆使用指南</h3>
            <button className="library-guide-close-btn" onClick={closePanel}>
              ✕
            </button>
          </div>

          {/* 功能按钮列表 */}
          <div className="library-guide-content">
            <button className="library-guide-item-btn" onClick={handleOpeningHours}>
              🕒 开放时间
            </button>
            <button className="library-guide-item-btn" onClick={handleFloorLayout}>
              🏢 楼层功能分区
            </button>
            <button className="library-guide-item-btn" onClick={handleBorrowReturn}>
              📖 图书借阅/还书流程
            </button>
            <button className="library-guide-item-btn" onClick={handleViolations}>
              ⚠️ 违规与补救措施
            </button>
            <button className="library-guide-item-btn" onClick={handleSeatReservation}>
              💺 座位预约
            </button>
          </div>
        </div>
      )}

      {/* 开放时间详情弹窗 */}
      {showOpeningHours && (
        <ModalPortal
          onClose={() => {
            setShowOpeningHours(false);
          }}
          contentClassName="modal-content"
        >
            <div className="modal-header">
              <h2>📅 图书馆开放时间</h2>
              <button className="modal-close-btn" onClick={() => setShowOpeningHours(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="time-section">
                <h3>📌 日常开放时间</h3>
                <p className="time-detail">
                  周一至周三、周五至周日：<strong>早 7:30 - 晚 22:30</strong>
                </p>
                <p className="time-notice">
                  ⚠️ 周四下午闭馆（设备维护与馆藏整理）
                </p>
              </div>

              <div className="time-section">
                <h3>🎉 法定节假日</h3>
                <p className="time-detail">
                  以 2025 年国庆为例：
                </p>
                <ul className="time-list">
                  <li>10 月 1 - 3 日、6 日：犀浦馆和九里馆开馆，<span className="highlight">暂停人工服务</span></li>
                  <li>10 月 4 - 5 日、7 - 8 日：三校区图书馆正常开放</li>
                </ul>
                <p className="time-note">
                  📢 具体假期安排以图书馆官网通知为准
                </p>
              </div>

              <div className="time-section">
                <h3>🌞 寒暑假期间</h3>
                <p className="time-detail">
                  犀浦校区图书馆开放时间：
                </p>
                <p className="time-schedule">
                  周一至周五：<strong>8:30 - 17:30</strong>
                </p>
                <p className="time-note">
                  📢 周末及其他校区安排以图书馆通知为准
                </p>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 楼层功能分区详情弹窗 */}
      {showFloorLayout && (
        <ModalPortal
          onClose={() => {
            setShowFloorLayout(false);
          }}
          contentClassName="modal-content floor-layout-modal"
        >
            <div className="modal-header">
              <h2>🏢 图书馆楼层功能分区</h2>
              <button className="modal-close-btn" onClick={() => setShowFloorLayout(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="floor-section">
                <h3>📍 二楼功能分区</h3>
                <div className="floor-content">
                  <p className="floor-detail">
                    <strong>A 区</strong>：行政办公区
                  </p>
                  <p className="floor-detail">
                    <strong>B 区</strong>：图书馆入口，设有综合服务台等设施
                  </p>
                </div>
                <div className="floor-image-container">
                  <img src="/OIP.webp" alt="图书馆二楼" className="floor-image" />
                </div>
              </div>

              <div className="floor-section">
                <h3>📚 各楼层阅览室分布</h3>
                
                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">B201</span>
                    <span className="room-type">中文图书阅览室</span>
                  </div>
                  <p className="room-description">
                    藏有自动化技术、计算机技术等相关图书
                  </p>
                </div>

                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">B301</span>
                    <span className="room-type">中文图书阅览室</span>
                  </div>
                  <p className="room-description">
                    收藏工业技术、机械仪表等图书
                  </p>
                </div>

                <div className="floor-image-container">
                  <img src="/OIP (1).webp" alt="图书馆阅览室" className="floor-image" />
                </div>

                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">A302</span>
                    <span className="room-type">报刊阅览室</span>
                  </div>
                  <p className="room-description">
                    提供最新报刊杂志阅览服务
                  </p>
                </div>

                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">A308</span>
                    <span className="room-type">党建阅览室</span>
                  </div>
                  <p className="room-description">
                    党建文献及相关资料专区
                  </p>
                </div>

                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">B401</span>
                    <span className="room-type">中文图书阅览室</span>
                  </div>
                  <p className="room-description">
                    收藏马列主义、经济等方面的图书
                  </p>
                </div>

                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">A402</span>
                    <span className="room-type">中文图书阅览室</span>
                  </div>
                  <p className="room-description">
                    藏有文学、历史等图书
                  </p>
                </div>

                <div className="room-card">
                  <div className="room-header">
                    <span className="room-number">A502</span>
                    <span className="room-type">外文阅览室</span>
                  </div>
                  <p className="room-description">
                    外文图书及文献专区
                  </p>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 图书借阅/还书流程弹窗 */}
      {showBorrowReturn && (
        <ModalPortal
          onClose={() => {
            setShowBorrowReturn(false);
          }}
          contentClassName="modal-content borrow-return-modal"
        >
            <div className="modal-header">
              <h2>📖 图书借阅/还书流程</h2>
              <button className="modal-close-btn" onClick={() => setShowBorrowReturn(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* 借阅流程 */}
              <div className="process-section">
                <h3>📚 一、图书借阅流程</h3>
                
                <div className="step-card">
                  <div className="step-header">
                    <span className="step-number">步骤 1</span>
                    <span className="step-title">选书</span>
                  </div>
                  <div className="step-content">
                    <p>在图书馆各楼层阅览室或书库挑选目标图书</p>
                    <div className="step-tip">
                      💡 <strong>检索技巧：</strong>可通过馆内查询机或"西南交通大学图书馆"官网/公众号检索图书位置（含校区、楼层、书架号）
                    </div>
                  </div>
                </div>

                <div className="step-card">
                  <div className="step-header">
                    <span className="step-number">步骤 2</span>
                    <span className="step-title">准备凭证</span>
                  </div>
                  <div className="step-content">
                    <p>携带本人<strong>校园卡</strong>（实体卡）或<strong>电子校园卡</strong>（需绑定图书馆系统）</p>
                    <div className="step-notice">
                      ⚠️ 未绑定电子卡需先在服务台完成关联
                    </div>
                  </div>
                </div>

                <div className="step-card">
                  <div className="step-header">
                    <span className="step-number">步骤 3</span>
                    <span className="step-title">办理借阅</span>
                  </div>
                  <div className="step-content">
                    <div className="method-card">
                      <h4>🤖 自助借阅</h4>
                      <ol className="method-steps">
                        <li>找到馆内自助借还机</li>
                        <li>刷校园卡/扫码登录</li>
                        <li>将图书放置在感应区</li>
                        <li>按屏幕提示确认借阅</li>
                        <li>打印凭条（可选）</li>
                      </ol>
                    </div>
                    <div className="method-card">
                      <h4>👨‍💼 人工借阅</h4>
                      <p>前往各校区图书馆综合服务台，出示校园卡和图书，工作人员核对后完成借阅登记</p>
                    </div>
                  </div>
                </div>

                <div className="info-box">
                  <h4>📌 重要须知</h4>
                  <ul>
                    <li>每本图书借阅期限一般为 <strong>30 天</strong></li>
                    <li>可通过线上系统或自助机<strong>续借 1 次</strong>（续期 30 天）</li>
                    <li>逾期未续借将产生<span className="warning-text">滞纳金</span></li>
                  </ul>
                </div>
              </div>

              {/* 还书流程 */}
              <div className="process-section">
                <h3>🔄 二、图书还书流程</h3>
                
                <div className="step-card">
                  <div className="step-header">
                    <span className="step-number">步骤 1</span>
                    <span className="step-title">准备工作</span>
                  </div>
                  <div className="step-content">
                    <p>整理需归还的图书，<strong>无需携带校园卡</strong></p>
                    <div className="step-notice">
                      ⚠️ 确保图书无破损、污渍（若有损坏需到服务台登记处理）
                    </div>
                  </div>
                </div>

                <div className="step-card">
                  <div className="step-header">
                    <span className="step-number">步骤 2</span>
                    <span className="step-title">办理归还</span>
                  </div>
                  <div className="step-content">
                    <div className="method-card">
                      <h4>🤖 自助还书</h4>
                      <p>将图书放入自助借还机的还书口，机器自动识别图书信息并完成归还，可查看屏幕确认归还成功</p>
                    </div>
                    <div className="method-card">
                      <h4>👨‍💼 人工还书</h4>
                      <p>到综合服务台提交图书，工作人员核对后完成注销借阅记录</p>
                    </div>
                    <div className="method-card highlight-method">
                      <h4>🏫 异地还书</h4>
                      <p>支持<strong>跨校区还书</strong>（如犀浦校区图书可还至九里校区图书馆），直接提交至目标校区服务台或自助还书设备即可</p>
                    </div>
                  </div>
                </div>

                <div className="step-card">
                  <div className="step-header">
                    <span className="step-number">步骤 3</span>
                    <span className="step-title">确认归还</span>
                  </div>
                  <div className="step-content">
                    <p>还书后可通过图书馆系统查询个人借阅记录，确认图书状态更新为"已归还"，避免漏还</p>
                  </div>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 座位预约弹窗 */}
      {showSeatReservation && (
        <ModalPortal
          onClose={() => {
            setShowSeatReservation(false);
          }}
          contentClassName="modal-content seat-reservation-modal"
        >
            <div className="modal-header">
              <h2>💺 座位预约指南</h2>
              <button className="modal-close-btn" onClick={() => setShowSeatReservation(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* 预约对象说明 */}
              <div className="info-banner">
                <p>
                  📢 西南交通大学犀浦校区和九里校区图书馆的座位预约<strong>仅对本校全日制学生和教职工开放</strong>
                </p>
              </div>

              {/* 三种预约方式 */}
              <div className="reservation-section">
                <h3>📱 预约方式</h3>

                {/* 官网预约 */}
                <div className="method-block">
                  <div className="method-title">
                    <span className="method-icon">🌐</span>
                    <h4>方式一：官网预约</h4>
                  </div>
                  
                  <div className="method-step">
                    <div className="step-label">步骤 1：登录系统</div>
                    <p>直接访问座位预约链接：</p>
                    <a href="http://zuowei.lib.swjtu.edu.cn/" target="_blank" rel="noopener noreferrer" className="reservation-link">
                      🔗 http://zuowei.lib.swjtu.edu.cn/
                    </a>
                    <div className="method-notice">
                      ⚠️ 该链接支持犀浦、九里两校区预约。网站暂不支持 IE 浏览器，推荐使用谷歌 Chrome、火狐等浏览器
                    </div>
                  </div>

                  <div className="method-step">
                    <div className="step-label">步骤 2：完成认证</div>
                    <p>初次登录需用读者证号绑定：</p>
                    <ul className="auth-list">
                      <li>一卡通：卡号前加 0 补至 10 位</li>
                      <li>条码证：直接输入</li>
                      <li>初始密码：身份证后六位</li>
                    </ul>
                  </div>

                  <div className="method-step">
                    <div className="step-label">步骤 3：选择预约</div>
                    <p>进入系统后挑选预约日期（可约当日及次日）、目标区域和具体座位，确认预约时段后提交，完成预约锁定</p>
                  </div>
                </div>

                {/* 微信公众号预约 */}
                <div className="method-block">
                  <div className="method-title">
                    <span className="method-icon">💬</span>
                    <h4>方式二：微信公众号预约</h4>
                  </div>
                  
                  <div className="method-step">
                    <div className="step-label">步骤 1：绑定账号</div>
                    <p>关注"<strong>西南交大图书馆</strong>"官方微信公众号，点击右下角菜单"<strong>常用服务 — 座位预约</strong>"</p>
                    <div className="method-tip">
                      💡 初次使用需在此绑定读者证号，操作和官网绑定规则一致
                    </div>
                  </div>

                  <div className="method-step">
                    <div className="step-label">步骤 2：预约座位</div>
                    <p>绑定后进入预约界面，选择校区、日期和对应的座位区域及时段，确认信息后提交，即可完成预约</p>
                  </div>
                </div>

                {/* 馆内选位机预约 */}
                <div className="method-block">
                  <div className="method-title">
                    <span className="method-icon">🖥️</span>
                    <h4>方式三：馆内选位机预约</h4>
                  </div>
                  
                  <div className="method-step">
                    <div className="step-label">步骤 1：找到设备</div>
                    <p>前往犀浦校区图书馆或九里茅以升图书馆，在二至四层阅览区外找到选位机</p>
                  </div>

                  <div className="method-step">
                    <div className="step-label">步骤 2：现场选座</div>
                    <p>在选位机上输入个人相关认证信息，<strong>仅能选取当日开馆后的空闲座位</strong>，确认后就能完成当场座位锁定</p>
                  </div>
                </div>
              </div>

              {/* 预约后续规则 */}
              <div className="reservation-section">
                <h3>📋 预约后续及补充规则</h3>

                <div className="rule-card">
                  <div className="rule-header">
                    <span className="rule-icon">✅</span>
                    <h4>签到规则</h4>
                  </div>
                  <p>预约成功后，需在预约开始时间<strong>前后 30 分钟内</strong>，扫描座位上的二维码完成签到</p>
                  <div className="rule-warning">
                    ⚠️ 未按时签到会被记为违约，座位自动释放
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-header">
                    <span className="rule-icon">⏸️</span>
                    <h4>暂离与退座</h4>
                  </div>
                  <ul className="rule-list">
                    <li>临时离开可操作"暂离"，系统保留座位 <strong>15 分钟</strong></li>
                    <li>用餐时段暂离时长可延长至 <strong>60 分钟</strong></li>
                    <li>使用完毕后，需点击预约卡片的"退座"按钮或扫码退座，避免违约</li>
                  </ul>
                </div>

                <div className="rule-card violation-card">
                  <div className="rule-header">
                    <span className="rule-icon">⚠️</span>
                    <h4>违约提醒</h4>
                  </div>
                  <p>若被他人发起监督，需在 <strong>20 分钟内</strong>扫码落座或退座，否则记违约</p>
                  <div className="rule-warning">
                    ⚠️ 多次违约可能影响后续预约权限，具体规则以系统提示为准
                  </div>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 违规与补救措施弹窗 */}
      {showViolations && (
        <ModalPortal
          onClose={() => {
            setShowViolations(false);
          }}
          contentClassName="modal-content violations-modal"
        >
            <div className="modal-header">
              <h2>⚠️ 违规行为界定与补救措施</h2>
              <button className="modal-close-btn" onClick={() => setShowViolations(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* 说明横幅 */}
              <div className="violations-banner">
                <p>
                  为保障图书馆资源有序利用，维护全体读者的合法权益，西南交通大学图书馆针对座位预约、图书借阅等场景制定了明确的违规管理规范。以下是常见违规行为的界定标准、处理规则及具体补救措施，覆盖<strong>犀浦、九里、峨眉三校区</strong>。
                </p>
              </div>

              {/* 一、座位预约类违规 */}
              <div className="violation-category">
                <h3>📍 一、座位预约类违规及补救措施</h3>
                <p className="category-intro">座位预约违规以"违约记录"为核心管理依据，累计违约将影响后续预约权限</p>

                <div className="violation-subsection">
                  <h4>1. 主要违规情形</h4>
                  
                  <div className="violation-item">
                    <div className="violation-title">❌ 未按时签到</div>
                    <p>预约座位后，未在预约开始时间<strong>前30分钟至开始时间后30分钟内</strong>完成扫码签到（扫描座位二维码），系统自动释放座位并记为"违约1次"</p>
                  </div>

                  <div className="violation-item">
                    <div className="violation-title">⏰ 暂离超时</div>
                    <p>操作"暂离"功能后，普通时段（非用餐时间）超过<strong>15分钟</strong>未返回落座，或用餐时段（11:30-13:30、17:30-19:30）超过<strong>60分钟</strong>未返回，系统记为"违约1次"</p>
                  </div>

                  <div className="violation-item">
                    <div className="violation-title">👁️ 被监督违约</div>
                    <p>已预约座位但长时间空置，被其他读者发起"座位监督"后，<strong>20分钟内</strong>未扫码确认落座或主动退座，系统记为"违约1次"</p>
                  </div>

                  <div className="violation-item severe">
                    <div className="violation-title">🚫 恶意占座</div>
                    <p>通过多账号预约、用物品占用未预约座位等方式恶意占用资源，经图书馆工作人员核实后，记为<strong>"严重违约"</strong></p>
                  </div>
                </div>

                <div className="violation-subsection">
                  <h4>2. 违规处理规则</h4>
                  
                  <div className="penalty-grid">
                    <div className="penalty-card level-1">
                      <div className="penalty-header">累计 1-2 次违约</div>
                      <p>无权限限制，系统仅记录违约信息，读者可正常预约</p>
                    </div>

                    <div className="penalty-card level-2">
                      <div className="penalty-header">累计 3 次违约</div>
                      <p>触发"预约限制"，自第3次违约当日起，<strong>7天内</strong>无法预约图书馆座位，仅可使用当日空闲座位（通过馆内选位机现场选取）</p>
                    </div>

                    <div className="penalty-card level-3">
                      <div className="penalty-header">累计 5 次及以上违约</div>
                      <p>将被纳入"座位使用重点关注名单"，<strong>30天内</strong>禁止预约座位，需前往对应校区图书馆综合服务台提交书面说明后，方可恢复部分权限</p>
                    </div>

                    <div className="penalty-card level-4">
                      <div className="penalty-header">严重违约（恶意占座）</div>
                      <p>首次核实后暂停座位预约权限<strong>15天</strong>，二次及以上将上报学校学生工作部门，结合校规校纪追加处理</p>
                    </div>
                  </div>
                </div>

                <div className="violation-subsection">
                  <h4>3. 补救措施</h4>
                  
                  <div className="remedy-box">
                    <div className="remedy-item">
                      <span className="remedy-icon">✅</span>
                      <div className="remedy-content">
                        <strong>及时退座减少违约</strong>
                        <p>若确认无法按时使用预约座位，需在预约开始时间前通过"西南交大图书馆"公众号或座位预约系统主动"取消预约"，取消操作不记违约（当日取消同一座位不得超过2次）</p>
                      </div>
                    </div>

                    <div className="remedy-item">
                      <span className="remedy-icon">🔄</span>
                      <div className="remedy-content">
                        <strong>违约后权限恢复</strong>
                        <p>普通违约的限制期限届满后，系统将自动恢复预约权限，无需额外申请；严重违约需携带校园卡到服务台提交《座位使用规范承诺书》，经工作人员审核后1-2个工作日内恢复</p>
                      </div>
                    </div>

                    <div className="remedy-item">
                      <span className="remedy-icon">📝</span>
                      <div className="remedy-content">
                        <strong>异议申诉</strong>
                        <p>若对违约记录有异议（如系统故障、突发疾病等特殊情况），可在违约记录生成后<strong>3个工作日内</strong>，通过图书馆官网"服务反馈"栏目提交申诉材料（含证明文件），图书馆将在<strong>5个工作日内</strong>给出核查结果</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 二、图书借阅类违规 */}
              <div className="violation-category">
                <h3>📚 二、图书借阅类违规及补救措施</h3>
                <p className="category-intro">图书借阅违规主要包括逾期未还、图书损坏、图书遗失三类，违规处理与读者信用等级挂钩，直接影响后续借阅权限</p>

                {/* 借书逾期 */}
                <div className="borrow-violation-section">
                  <h4>（一）借书逾期</h4>
                  
                  <div className="violation-detail-box">
                    <div className="detail-label">违规界定</div>
                    <p>图书借阅期限为<strong>30天</strong>，续借后可延长<strong>30天</strong>（仅支持续借1次），超过到期日未归还或未续借即视为"逾期"，逾期时长从到期日次日开始计算</p>
                  </div>

                  <div className="violation-detail-box">
                    <div className="detail-label">违规处理</div>
                    <ul className="penalty-list">
                      <li><strong>滞纳金收取：</strong>按"0.1元/天·册"标准收取逾期滞纳金，单册图书滞纳金最高不超过50元（即逾期500天及以上，单册仅收50元）</li>
                      <li><strong>权限限制：</strong>当读者累计滞纳金超过10元，或单册图书逾期超过30天，系统将暂停其图书借阅、续借权限，仅可正常还书</li>
                      <li><strong>信用影响：</strong>逾期超过90天的图书将被标记为"长期逾期"，读者信用等级降为"C级"，影响电子资源优先获取权限</li>
                    </ul>
                  </div>

                  <div className="violation-detail-box remedy">
                    <div className="detail-label">补救措施</div>
                    <ul className="remedy-list">
                      <li>📌 <strong>及时还书缴清费用：</strong>携带逾期图书和校园卡到任意校区图书馆自助借还机或综合服务台办理还书，通过自助设备或服务台缴纳滞纳金，费用结清后即时恢复借阅权限</li>
                      <li>📌 <strong>续借补救（逾期前）：</strong>在图书到期日前3天内，可通过图书馆官网、公众号或自助机办理续借，避免逾期（已逾期的图书不可续借）</li>
                      <li>📌 <strong>特殊情况申请减免：</strong>因住院、疫情隔离等不可抗力导致逾期的，可凭医院诊断证明、隔离通知等材料到服务台申请减免滞纳金，经审核通过后，系统将清除对应逾期记录</li>
                    </ul>
                  </div>
                </div>

                {/* 图书损坏 */}
                <div className="borrow-violation-section">
                  <h4>（二）图书损坏</h4>
                  
                  <div className="violation-detail-box">
                    <div className="detail-label">违规界定</div>
                    <p><strong>轻微损坏：</strong>封面褶皱、少量批注、页码轻微撕裂（可修复）</p>
                    <p><strong>严重损坏：</strong>缺页、撕毁、浸泡、污损（无法修复）、涂改ISBN或条形码等</p>
                  </div>

                  <div className="violation-detail-box">
                    <div className="detail-label">违规处理</div>
                    <ul className="penalty-list">
                      <li><strong>轻微损坏：</strong>需支付图书修复费<strong>5-20元</strong>（根据修复难度确定），由图书馆工作人员统一处理修复</li>
                      <li><strong>严重损坏：</strong>按"图书原价的<strong>1-3倍</strong>"赔偿，若图书为孤本、珍本或已绝版，需按原价<strong>5-10倍</strong>赔偿，同时收回损坏图书</li>
                      <li><strong>恶意损坏：</strong>除赔偿费用外，上报学校相关部门，记入学生综合素质评价档案，暂停借阅权限<strong>30天</strong></li>
                    </ul>
                  </div>

                  <div className="violation-detail-box remedy">
                    <div className="detail-label">补救措施</div>
                    <ul className="remedy-list">
                      <li>📌 <strong>主动申报减少损失：</strong>借阅时发现图书已存在损坏，需立即向服务台工作人员说明，由工作人员标注损坏情况并备案，避免还书时承担责任；还书时主动申报损坏，可根据实际情况降低赔偿标准</li>
                      <li>📌 <strong>自行修复审核：</strong>若轻微损坏可自行修复（如封面粘贴、页码装订），需提交修复方案给图书馆采编部，审核通过后自行修复，经工作人员验收合格可免交修复费</li>
                      <li>📌 <strong>替代赔偿：</strong>对于严重损坏的图书，若读者能提供同版本、同ISBN的全新图书替代，经采编部确认后，可免交赔偿费，仅需支付<strong>5元</strong>图书加工费</li>
                    </ul>
                  </div>
                </div>

                {/* 图书遗失 */}
                <div className="borrow-violation-section">
                  <h4>（三）图书遗失</h4>
                  
                  <div className="violation-detail-box">
                    <div className="detail-label">违规界定</div>
                    <p>图书借出后，因保管不善导致遗失，或明确表示无法归还的，均视为"遗失违规"，读者需在发现遗失后<strong>7天内</strong>主动向图书馆报告</p>
                  </div>

                  <div className="violation-detail-box">
                    <div className="detail-label">违规处理</div>
                    <ul className="penalty-list">
                      <li><strong>赔偿标准：</strong>
                        <ul>
                          <li>普通中文图书按原价<strong>2-3倍</strong>赔偿</li>
                          <li>外文图书、专业核心图书按原价<strong>3-5倍</strong>赔偿</li>
                          <li>绝版书、工具书按原价<strong>10倍</strong>赔偿</li>
                          <li>成套图书遗失其中1册的，按<strong>整套图书原价</strong>赔偿，剩余册数归图书馆所有</li>
                        </ul>
                      </li>
                      <li><strong>逾期叠加：</strong>若遗失图书已超过借阅期限，需在赔偿费用基础上，额外缴纳逾期滞纳金（按正常逾期标准计算至赔偿当日）</li>
                      <li><strong>权限限制：</strong>自图书遗失确认之日起，暂停读者借阅权限，直至完成赔偿手续</li>
                    </ul>
                  </div>

                  <div className="violation-detail-box remedy">
                    <div className="detail-label">补救措施</div>
                    <ul className="remedy-list">
                      <li>📌 <strong>及时报告减少滞纳金：</strong>发现图书遗失后，立即到服务台登记"遗失报备"，报备后滞纳金计算暂停（若后续找回图书，可撤销报备）；未主动报备的，滞纳金将持续计算至赔偿之日</li>
                      <li>📌 <strong>替代赔偿优先：</strong>读者可购买同ISBN、同版本的全新图书替代遗失图书，经采编部核对无误后，仅需支付<strong>5元</strong>加工费，无需承担倍数赔偿；若购买的图书为精装版替代平装版，需补差价</li>
                      <li>📌 <strong>找回图书退款：</strong>已完成赔偿的读者，若在赔偿后<strong>60天内</strong>找回遗失图书，可携带图书和赔偿凭证到服务台申请退款，图书馆将全额退还赔偿费（加工费和已缴滞纳金不予退还）</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 三、通用违规处理说明 */}
              <div className="violation-category">
                <h3>📋 三、通用违规处理说明</h3>
                
                <div className="general-info-box">
                  <div className="info-item">
                    <span className="info-number">1</span>
                    <div className="info-text">
                      <strong>违规记录查询</strong>
                      <p>读者可通过"西南交大图书馆"公众号"我的图书馆"栏目，或登录图书馆官网个人中心，查询座位预约违约记录、图书借阅逾期/损坏/遗失记录及待缴费用</p>
                    </div>
                  </div>

                  <div className="info-item">
                    <span className="info-number">2</span>
                    <div className="info-text">
                      <strong>申诉渠道</strong>
                      <p>对违规处理有异议的，可提交《图书馆违规处理申诉表》（可在服务台领取或官网下载）及相关证明材料，提交至对应校区图书馆办公室，审核周期为<strong>3-5个工作日</strong>，申诉期间不影响违规处理的执行</p>
                    </div>
                  </div>

                  <div className="info-item">
                    <span className="info-number">3</span>
                    <div className="info-text">
                      <strong>校区通用规则</strong>
                      <p>上述违规处理规则适用于西南交通大学所有校区图书馆，跨校区借阅的图书出现违规，可在任意校区办理补救手续（如九里校区借出的图书逾期，可在犀浦校区还书并缴纳滞纳金）</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 咨询电话 */}
              <div className="contact-footer">
                <h4>📞 图书馆服务咨询电话</h4>
                <div className="contact-grid">
                  <div className="contact-item">
                    <strong>犀浦校区</strong>
                    <p>028-66366265</p>
                  </div>
                  <div className="contact-item">
                    <strong>九里校区</strong>
                    <p>028-87600567</p>
                  </div>
                  <div className="contact-item">
                    <strong>峨眉校区</strong>
                    <p>0833-5198268</p>
                  </div>
                </div>
                <p className="contact-note">若有违规处理相关疑问，可工作日 9:00-17:00 致电咨询</p>
              </div>
            </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default LibraryGuidePanel;
