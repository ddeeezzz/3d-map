/**
 * GymnasiumGuidePanel 组件：体育馆使用指南面板
 * 
 * 职责：
 * 1. 在地图左侧显示"体育馆使用指南"按钮（位于图书馆使用指南按钮下方）
 * 2. 点击按钮后弹出包含四个功能按钮的面板
 * 3. 提供场馆功能分区与核心设施、体质健康测试专项安排、场馆日常使用规范与预约流程、服务与应急保障功能入口
 */

/** React 状态钩子：管理各体育馆弹窗开关 */
import { useState } from "react";
/** React DOM Portal：解决弹窗 fixed 定位受父级 transform 影响的问题 */
import { createPortal } from "react-dom";
/** 全局场景 store：同步体育馆指南面板显隐 */
import { useSceneStore } from "../store/useSceneStore";
/** 样式文件：提供按钮、弹窗与内容排版 */
import "./GymnasiumGuidePanel.css";

/**
 * ModalPortal 组件：通过 createPortal 将弹窗挂载至 body，保持相对视口定位
 * @param {Object} props - 组件参数
 * @param {JSX.Element} props.children - 弹窗内部结构
 * @param {() => void} props.onClose - 点击遮罩时需执行的关闭逻辑
 * @param {string} props.contentClassName - 弹窗主体额外样式类
 * @returns {JSX.Element} Portal 包裹的弹窗节点
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

function GymnasiumGuidePanel() {
  const isOpen = useSceneStore((state) => state.guidePanelsVisible?.gymnasium);
  const setGuidePanelVisible = useSceneStore((state) => state.setGuidePanelVisible);
  // 控制场馆功能分区与核心设施弹窗
  const [showFacilityZoning, setShowFacilityZoning] = useState(false);
  // 控制体质健康测试专项安排弹窗
  const [showHealthTest, setShowHealthTest] = useState(false);
  // 控制场馆日常使用规范与预约流程弹窗
  const [showUsageRules, setShowUsageRules] = useState(false);
  // 控制服务与应急保障弹窗
  const [showEmergencyService, setShowEmergencyService] = useState(false);

  // 切换面板显示状态
  const togglePanel = () => {
    setGuidePanelVisible("gymnasium", !isOpen);
  };

  // 关闭面板
  const closePanel = () => {
    setGuidePanelVisible("gymnasium", false);
  };

  // 四个功能按钮的点击处理
  const handleFacilityZoning = () => {
    setShowFacilityZoning(true);
  };

  const handleHealthTest = () => {
    setShowHealthTest(true);
  };

  const handleUsageRules = () => {
    setShowUsageRules(true);
  };

  const handleEmergencyService = () => {
    setShowEmergencyService(true);
  };

  return (
    <div className="gymnasium-guide-container">
      {/* 主按钮：体育馆使用指南 */}
      <button className="gymnasium-guide-main-btn" onClick={togglePanel}>
        🏟️ 体育馆使用指南
      </button>

      {/* 弹出面板 */}
      {isOpen && (
        <div className="gymnasium-guide-panel">
          {/* 面板头部 */}
          <div className="gymnasium-guide-header">
            <h3>体育馆使用指南</h3>
            <button className="gymnasium-guide-close-btn" onClick={closePanel}>
              ✕
            </button>
          </div>

          {/* 功能按钮列表 */}
          <div className="gymnasium-guide-content">
            <button className="gymnasium-guide-item-btn" onClick={handleFacilityZoning}>
              🏢 场馆功能分区与核心设施
            </button>
            <button className="gymnasium-guide-item-btn" onClick={handleHealthTest}>
              📊 体质健康测试专项安排
            </button>
            <button className="gymnasium-guide-item-btn" onClick={handleUsageRules}>
              📋 场馆日常使用规范与预约流程
            </button>
            <button className="gymnasium-guide-item-btn" onClick={handleEmergencyService}>
              🚑 服务与应急保障
            </button>
          </div>
        </div>
      )}

      {/* 场馆功能分区与核心设施弹窗 */}
      {showFacilityZoning && (
        <ModalPortal
          onClose={() => {
            setShowFacilityZoning(false);
          }}
          contentClassName="modal-content"
        >
            <div className="modal-header">
              <h2>🏢 场馆功能分区与核心设施</h2>
              <button className="modal-close-btn" onClick={() => setShowFacilityZoning(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="facility-section">
                <h3>📍 场馆功能分区</h3>
                <p className="facility-intro">
                  西南交通大学犀浦校区体育馆为多功能综合性体育场馆，设有篮球馆、羽毛球馆、乒乓球馆、健身房等专业运动区域，满足师生日常体育锻炼与竞技比赛需求。
                </p>
              </div>

              <div className="facility-section">
                <h3>🏀 核心设施</h3>
                
                <div className="facility-card">
                  <div className="facility-header">
                    <span className="facility-icon">🏀</span>
                    <span className="facility-name">篮球馆</span>
                  </div>
                  <p className="facility-description">
                    标准室内篮球场地，配备专业篮球架、木地板，可容纳多场次同时进行，适合篮球教学、训练及比赛使用。
                  </p>
                </div>

                <div className="facility-card">
                  <div className="facility-header">
                    <span className="facility-icon">🏸</span>
                    <span className="facility-name">羽毛球馆</span>
                  </div>
                  <p className="facility-description">
                    多片标准羽毛球场地，配备专业照明系统与场地分隔网，提供羽毛球教学与日常锻炼服务。
                  </p>
                </div>

                <div className="facility-card">
                  <div className="facility-header">
                    <span className="facility-icon">🏓</span>
                    <span className="facility-name">乒乓球馆</span>
                  </div>
                  <p className="facility-description">
                    多台专业乒乓球台，环境整洁，灯光充足，适合乒乓球教学、训练及日常活动。
                  </p>
                </div>

                <div className="facility-card">
                  <div className="facility-header">
                    <span className="facility-icon">💪</span>
                    <span className="facility-name">健身房</span>
                  </div>
                  <p className="facility-description">
                    配备跑步机、力量训练器械、有氧器械等现代化健身设备，提供专业指导与健身服务。
                  </p>
                </div>

                <div className="facility-card">
                  <div className="facility-header">
                    <span className="facility-icon">📐</span>
                    <span className="facility-name">体质测试区</span>
                  </div>
                  <p className="facility-description">
                    专门用于学生体质健康测试的区域，配备身高体重仪、肺活量测试仪、坐位体前屈测试仪等标准化测试设备。
                  </p>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 体质健康测试专项安排弹窗 */}
      {showHealthTest && (
        <ModalPortal
          onClose={() => {
            setShowHealthTest(false);
          }}
          contentClassName="modal-content health-test-modal"
        >
            <div className="modal-header">
              <h2>📊 体质健康测试专项安排</h2>
              <button className="modal-close-btn" onClick={() => setShowHealthTest(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* 测试时间与对象 */}
              <div className="test-section">
                <h3>📅 测试时间与对象</h3>
                <div className="test-info-box">
                  <p><strong>测试对象：</strong>全校在校本科生与研究生</p>
                  <p><strong>测试周期：</strong>每学年一次，通常安排在每年 9-11 月</p>
                  <p className="test-notice">
                    ⚠️ 具体测试时间以体育部通知为准，请关注学校官网及体育部公告
                  </p>
                </div>
              </div>

              {/* 测试场地 */}
              <div className="test-section">
                <h3>📍 测试场地</h3>
                <div className="venue-card">
                  <h4>室内测试区（体育馆内）</h4>
                  <ul className="venue-list">
                    <li>身高体重测试</li>
                    <li>肺活量测试</li>
                    <li>坐位体前屈测试</li>
                    <li>立定跳远测试</li>
                    <li>仰卧起坐测试（女生）</li>
                    <li>引体向上测试（男生）</li>
                  </ul>
                </div>
                <div className="venue-card">
                  <h4>室外测试区（田径场）</h4>
                  <ul className="venue-list">
                    <li>50 米跑测试</li>
                    <li>800 米跑测试（女生）</li>
                    <li>1000 米跑测试（男生）</li>
                  </ul>
                </div>
              </div>

              {/* 测试内容与规范 */}
              <div className="test-section">
                <h3>📋 测试内容与规范</h3>
                
                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">1</span>
                    <h4>身高体重</h4>
                  </div>
                  <p><strong>测试规范：</strong>脱鞋，轻装上阵，站立测量身高与体重</p>
                </div>

                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">2</span>
                    <h4>肺活量</h4>
                  </div>
                  <p><strong>测试规范：</strong>深吸气后对准仪器吹气口，尽力呼气至无法呼出，每人测试两次，取最高值</p>
                </div>

                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">3</span>
                    <h4>坐位体前屈</h4>
                  </div>
                  <p><strong>测试规范：</strong>坐于测试台前，双腿伸直，脚掌抵住挡板，双手向前推动游标，测试两次，取最高值</p>
                </div>

                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">4</span>
                    <h4>立定跳远</h4>
                  </div>
                  <p><strong>测试规范：</strong>双脚自然分开站立，原地起跳，落地后不得后退或坐倒，测试三次，取最高值</p>
                </div>

                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">5</span>
                    <h4>50 米跑</h4>
                  </div>
                  <p><strong>测试规范：</strong>站立式起跑，听到发令后起跑，冲过终点线，计时精确到 0.1 秒</p>
                </div>

                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">6</span>
                    <h4>800 米跑（女）/ 1000 米跑（男）</h4>
                  </div>
                  <p><strong>测试规范：</strong>站立式起跑，听到发令后起跑，按规定圈数完成测试，不得抢跑或中途退出</p>
                  <p className="test-warning">⚠️ 有心脏疾病或身体不适者请提前申请免测或缓测</p>
                </div>

                <div className="test-item-card">
                  <div className="test-item-header">
                    <span className="test-number">7</span>
                    <h4>仰卧起坐（女）/ 引体向上（男）</h4>
                  </div>
                  <p><strong>测试规范：</strong></p>
                  <ul>
                    <li>仰卧起坐：平躺，双手抱头,双脚固定，1 分钟内完成尽可能多的仰卧起坐</li>
                    <li>引体向上：双手正握单杠，身体悬空，完成尽可能多的引体向上动作</li>
                  </ul>
                </div>
              </div>

              {/* 注意事项 */}
              <div className="test-section">
                <h3>⚠️ 注意事项</h3>
                <div className="notice-box">
                  <ul className="notice-list">
                    <li>测试前需携带<strong>校园卡</strong>进行身份验证</li>
                    <li>穿着<strong>运动服与运动鞋</strong>，避免穿着牛仔裤、皮鞋等不适合运动的服装</li>
                    <li>测试前应充分<strong>热身</strong>，避免运动损伤</li>
                    <li>有身体不适或疾病史的学生，需提前向体育部提交<strong>免测或缓测申请</strong></li>
                    <li>测试成绩将计入学生体质健康档案，影响毕业与评优</li>
                  </ul>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 场馆日常使用规范与预约流程弹窗 */}
      {showUsageRules && (
        <ModalPortal
          onClose={() => {
            setShowUsageRules(false);
          }}
          contentClassName="modal-content usage-rules-modal"
        >
            <div className="modal-header">
              <h2>📋 场馆日常使用规范与预约流程</h2>
              <button className="modal-close-btn" onClick={() => setShowUsageRules(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* 开放时间 */}
              <div className="usage-section">
                <h3>🕒 场馆开放时间</h3>
                <div className="time-info-box">
                  <p><strong>工作日：</strong>上午 8:00 - 晚上 21:00</p>
                  <p><strong>周末及节假日：</strong>上午 9:00 - 晚上 20:00</p>
                  <p className="time-notice">
                    ⚠️ 如遇大型活动、设施维护或特殊情况，场馆可能临时调整开放时间，请关注体育部通知
                  </p>
                </div>
              </div>

              {/* 使用规范 */}
              <div className="usage-section">
                <h3>📜 日常使用规范</h3>
                
                <div className="rule-card">
                  <div className="rule-header">
                    <span className="rule-number">1</span>
                    <h4>入场要求</h4>
                  </div>
                  <ul className="rule-list">
                    <li>进入场馆需出示<strong>校园卡</strong>或<strong>预约凭证</strong></li>
                    <li>必须穿着<strong>运动服与运动鞋</strong>，不得穿着拖鞋、皮鞋、高跟鞋等</li>
                    <li>禁止携带宠物、危险物品进入场馆</li>
                  </ul>
                </div>

                <div className="rule-card">
                  <div className="rule-header">
                    <span className="rule-number">2</span>
                    <h4>场地使用</h4>
                  </div>
                  <ul className="rule-list">
                    <li>爱护场地设施，禁止随意挪动器材</li>
                    <li>使用器械前应检查安全状况，使用后归还原位</li>
                    <li>禁止在场馆内吸烟、饮酒、乱扔垃圾</li>
                    <li>保持场馆安静，避免大声喧哗</li>
                  </ul>
                </div>

                <div className="rule-card">
                  <div className="rule-header">
                    <span className="rule-number">3</span>
                    <h4>安全规范</h4>
                  </div>
                  <ul className="rule-list">
                    <li>运动前应充分热身，避免运动损伤</li>
                    <li>如有身体不适，应立即停止运动并寻求帮助</li>
                    <li>遵守场馆安全规定，服从工作人员管理</li>
                    <li>贵重物品请妥善保管，场馆不负责物品遗失</li>
                  </ul>
                </div>
              </div>

              {/* 预约流程 */}
              <div className="usage-section">
                <h3>📱 场地预约流程</h3>
                
                <div className="booking-step-card">
                  <div className="booking-step-header">
                    <span className="step-badge">步骤 1</span>
                    <h4>选择预约方式</h4>
                  </div>
                  <div className="booking-methods">
                    <div className="booking-method">
                      <h5>🌐 官网预约</h5>
                      <p>登录学校体育部官网，进入场馆预约系统</p>
                    </div>
                    <div className="booking-method">
                      <h5>💬 微信预约</h5>
                      <p>关注"西南交大体育部"公众号，点击"场馆预约"菜单</p>
                    </div>
                    <div className="booking-method">
                      <h5>🏢 现场预约</h5>
                      <p>前往体育馆服务台进行现场登记预约</p>
                    </div>
                  </div>
                </div>

                <div className="booking-step-card">
                  <div className="booking-step-header">
                    <span className="step-badge">步骤 2</span>
                    <h4>选择场地与时段</h4>
                  </div>
                  <p>根据个人需求选择篮球馆、羽毛球馆、乒乓球馆等场地，并选择可用时段</p>
                  <p className="booking-tip">💡 建议提前 1-3 天预约，热门时段（晚上、周末）建议尽早预约</p>
                </div>

                <div className="booking-step-card">
                  <div className="booking-step-header">
                    <span className="step-badge">步骤 3</span>
                    <h4>提交预约申请</h4>
                  </div>
                  <p>填写个人信息（姓名、学号、联系方式），确认预约信息后提交</p>
                </div>

                <div className="booking-step-card">
                  <div className="booking-step-header">
                    <span className="step-badge">步骤 4</span>
                    <h4>确认预约</h4>
                  </div>
                  <p>预约成功后，系统将发送确认短信或公众号消息，凭预约凭证入场</p>
                  <p className="booking-warning">⚠️ 预约后如无法按时到场，请提前<strong>至少 2 小时</strong>取消预约，避免影响他人使用</p>
                </div>
              </div>

              {/* 违约处理 */}
              <div className="usage-section">
                <h3>⚠️ 违约处理</h3>
                <div className="violation-box">
                  <ul className="violation-list">
                    <li><strong>未按时到场：</strong>预约后未在预约时段到场且未提前取消，记为违约 1 次</li>
                    <li><strong>违约 3 次：</strong>暂停预约权限 7 天</li>
                    <li><strong>违约 5 次及以上：</strong>暂停预约权限 30 天，需到体育部办理恢复手续</li>
                    <li><strong>恶意占用场地：</strong>严重违规行为将上报学校相关部门处理</li>
                  </ul>
                </div>
              </div>
            </div>
        </ModalPortal>
      )}

      {/* 服务与应急保障弹窗 */}
      {showEmergencyService && (
        <ModalPortal
          onClose={() => {
            setShowEmergencyService(false);
          }}
          contentClassName="modal-content emergency-service-modal"
        >
            <div className="modal-header">
              <h2>🚑 服务与应急保障</h2>
              <button className="modal-close-btn" onClick={() => setShowEmergencyService(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* 服务项目 */}
              <div className="service-section">
                <h3>🛎️ 服务项目</h3>
                
                <div className="service-card">
                  <div className="service-header">
                    <span className="service-icon">💼</span>
                    <h4>物品寄存服务</h4>
                  </div>
                  <p>提供临时储物柜，供运动期间寄存个人物品</p>
                  <p className="service-detail"><strong>使用方式：</strong>凭校园卡在服务台登记使用</p>
                  <p className="service-warning">⚠️ 贵重物品请随身携带，场馆不负责遗失物品</p>
                </div>

                <div className="service-card">
                  <div className="service-header">
                    <span className="service-icon">👨‍🏫</span>
                    <h4>健身指导服务</h4>
                  </div>
                  <p>健身房配备专业教练，提供器械使用指导与健身计划咨询</p>
                  <p className="service-detail"><strong>服务时间：</strong>工作日下午 14:00 - 20:00</p>
                </div>
              </div>

              {/* 应急保障 */}
              <div className="service-section">
                <h3>🚨 应急保障措施</h3>
                
                <div className="emergency-card urgent">
                  <div className="emergency-header">
                    <span className="emergency-icon">🏥</span>
                    <h4>医疗急救</h4>
                  </div>
                  <ul className="emergency-list">
                    <li>场馆内设有<strong>医务室</strong>，配备急救药品与器材</li>
                    <li>如遇紧急情况，请立即联系现场工作人员或拨打<strong>校医院急救电话</strong></li>
                    <li>场馆工作人员均经过急救培训，可提供基础急救服务</li>
                    <li><strong>校医院急救电话：</strong>028-66366120</li>
                  </ul>
                </div>

                <div className="emergency-card">
                  <div className="emergency-header">
                    <span className="emergency-icon">🔥</span>
                    <h4>消防安全</h4>
                  </div>
                  <ul className="emergency-list">
                    <li>场馆内配备<strong>消防栓、灭火器、烟雾报警器</strong>等消防设施</li>
                    <li>安全出口标识清晰，疏散通道保持畅通</li>
                    <li>如遇火灾，请保持冷静，按照疏散指示有序撤离</li>
                    <li><strong>火警电话：</strong>119</li>
                  </ul>
                </div>

                <div className="emergency-card">
                  <div className="emergency-header">
                    <span className="emergency-icon">🛡️</span>
                    <h4>安保监控</h4>
                  </div>
                  <ul className="emergency-list">
                    <li>场馆内全天候<strong>视频监控</strong>，确保安全</li>
                    <li>保安人员定期巡逻，维护场馆秩序</li>
                    <li>如遇可疑情况或安全问题，请及时联系保安或拨打<strong>校保卫处电话</strong></li>
                    <li><strong>校保卫处电话：</strong>028-66366110</li>
                  </ul>
                </div>

                <div className="emergency-card">
                  <div className="emergency-header">
                    <span className="emergency-icon">☔</span>
                    <h4>恶劣天气应对</h4>
                  </div>
                  <ul className="emergency-list">
                    <li>如遇暴雨、雷电等恶劣天气，室外场地将临时关闭</li>
                    <li>室内场馆正常开放，请优先选择室内运动</li>
                    <li>如遇极端天气（台风、暴雪等），场馆可能全面关闭，请关注体育部通知</li>
                  </ul>
                </div>
              </div>

              {/* 联系方式 */}
              <div className="contact-section">
                <h3>📞 场馆服务联系方式</h3>
                <div className="contact-info-grid">
                  <div className="contact-info-item">
                    <strong>体育馆服务台</strong>
                    <p>028-66366XXX</p>
                  </div>
                  <div className="contact-info-item">
                    <strong>器材租借咨询</strong>
                    <p>028-66366XXX</p>
                  </div>
                  <div className="contact-info-item">
                    <strong>场地预约咨询</strong>
                    <p>028-66366XXX</p>
                  </div>
                  <div className="contact-info-item">
                    <strong>体育部办公室</strong>
                    <p>028-66366XXX</p>
                  </div>
                </div>
                <p className="contact-note">
                  如有任何疑问或建议，欢迎工作日 9:00-17:00 致电咨询
                </p>
              </div>
            </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default GymnasiumGuidePanel;
