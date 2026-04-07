'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─────────────────────────────────────────────────────────────
// Static Reference Data
// ─────────────────────────────────────────────────────────────

const AGENTS = {
  pm:         { id: 'pm',         name: '项目经理',   initials: 'PM', color: '#6366F1' },
  analyst:    { id: 'analyst',    name: '数据分析师', initials: 'DA', color: '#0EA5E9' },
  engineer:   { id: 'engineer',   name: '建模工程师', initials: 'ME', color: '#10B981' },
  business:   { id: 'business',   name: '业务顾问',   initials: 'BC', color: '#F59E0B' },
  qa:         { id: 'qa',         name: '质量评估师', initials: 'QA', color: '#8B5CF6' },
  root_cause: { id: 'root_cause', name: '根因分析师', initials: 'RC', color: '#EF4444' },
};

const SCENARIOS = {
  1: { id: 1, name: '初始建模',     icon: '🚀', desc: '给定输入数据，设计开发代码，获取回测结果',               agents: ['pm','analyst','engineer','qa'] },
  2: { id: 2, name: '迭代优化分析', icon: '📊', desc: '多维度分析建模结果，发现提升机会，制定优化计划',         agents: ['analyst','engineer','business'] },
  3: { id: 3, name: '运营复盘',     icon: '🔍', desc: '复盘近期运行情况，异常分析，根因分析，发现迭代机会',     agents: ['root_cause','analyst','pm'] },
  4: { id: 4, name: '业务驱动优化', icon: '💼', desc: '依据业务给定优化方向，数据探索与建模优化及回测',         agents: ['business','analyst','engineer','qa'] },
  5: { id: 5, name: '业务问题分析', icon: '❓', desc: '对业务方提出的疑问进行数据分析，解释具体原因',           agents: ['analyst','business'] },
  6: { id: 6, name: '监控大盘',     icon: '📈', desc: '制定预测异常关键指标，展示数据大盘',                     agents: ['analyst','root_cause'] },
};

// ─────────────────────────────────────────────────────────────
// Mock Data Store
// ─────────────────────────────────────────────────────────────

const projects = {
  proj_001: {
    id: 'proj_001',
    name: '销量预测模型',
    description: '基于历史销售数据及外部因素预测未来30天SKU级别销量，支持供应链计划优化',
    status: 'active',
    type: 'timeseries',
    tags: ['销量预测', '时序', 'SKU'],
    current_version: 'v3.2',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-04-01T09:15:00Z',
    best_metrics:     { mae: 245.3,  rmse: 312.1, mape: 7.8,  label: 'MAPE' },
    baseline_metrics: { mae: 580.2,  rmse: 710.5, mape: 18.5, label: 'MAPE' },
    improvement: '-58%',
    iteration_count: 5,
  },
  proj_002: {
    id: 'proj_002',
    name: '用户流失预测',
    description: '预测30天内高价值用户流失概率，为精准营销和保留策略提供支持',
    status: 'active',
    type: 'classification',
    tags: ['用户流失', '分类', '营销'],
    current_version: 'v2.1',
    created_at: '2025-02-10T14:00:00Z',
    updated_at: '2025-03-28T11:30:00Z',
    best_metrics:     { auc: 0.87, precision: 0.76, recall: 0.82, f1: 0.79, label: 'AUC' },
    baseline_metrics: { auc: 0.72, precision: 0.61, recall: 0.65, f1: 0.63, label: 'AUC' },
    improvement: '+21%',
    iteration_count: 3,
  },
  proj_003: {
    id: 'proj_003',
    name: '动态定价策略',
    description: '基于市场需求、竞品价格和库存状况，推荐最优动态定价方案',
    status: 'paused',
    type: 'optimization',
    tags: ['定价', '优化', '竞争分析'],
    current_version: 'v1.3',
    created_at: '2025-03-01T09:00:00Z',
    updated_at: '2025-03-15T16:45:00Z',
    best_metrics:     { revenue_lift: 12.3, margin_improvement: 3.1, label: '收入提升%' },
    baseline_metrics: { revenue_lift: 5.2,  margin_improvement: 1.1, label: '收入提升%' },
    improvement: '+137%',
    iteration_count: 2,
  },
};

const iterations = {
  // ── proj_001 ──────────────────────────────────────────────
  iter_001: {
    id: 'iter_001', project_id: 'proj_001', version: 'v1.0', scenario: 1,
    status: 'completed',
    description: 'XGBoost基线模型建立，初步特征工程探索',
    created_at:   '2025-01-20T09:00:00Z',
    completed_at: '2025-01-20T14:30:00Z',
    agents: ['pm','analyst','engineer','qa'],
    metrics: { mae: 580.2, rmse: 710.5, mape: 18.5, model: 'XGBoost (Baseline)' },
    vs_prev: null,
    conclusion: 'MAPE 18.5%，高于业务目标15%，需优化特征工程和外部数据接入',
    highlights: ['完成数据清洗和EDA','建立XGBoost基线','识别关键特征：节假日、促销活动'],
    code_preview: 'import xgboost as xgb\nfrom sklearn.model_selection import TimeSeriesSplit\n\nparams = {\'n_estimators\': 200, \'max_depth\': 6, \'learning_rate\': 0.05}\nmodel = xgb.XGBRegressor(**params)\nmodel.fit(X_train, y_train)',
    backtest_period: '2024-10-01 ~ 2024-12-31',
  },
  iter_002: {
    id: 'iter_002', project_id: 'proj_001', version: 'v1.5', scenario: 2,
    status: 'completed',
    description: '多维度分析发现外部数据缺失，引入天气和节假日精细化特征',
    created_at:   '2025-02-05T10:00:00Z',
    completed_at: '2025-02-06T16:00:00Z',
    agents: ['analyst','engineer','business'],
    metrics: { mae: 420.1, rmse: 530.8, mape: 13.2, model: 'XGBoost + 外部特征' },
    vs_prev: { mae: -27.6, rmse: -25.3, mape: -28.6 },
    conclusion: 'MAPE降至13.2%，达成业务目标。天气特征贡献度最高，节假日效应建模改善',
    highlights: ['新增天气数据接入','节假日效应精细化建模','特征重要性SHAP分析'],
    code_preview: 'features += [\'temperature\', \'holiday_type\', \'promo_intensity\']\nparams.update({\'n_estimators\': 300, \'max_depth\': 7})\nmodel = xgb.XGBRegressor(**params)',
    backtest_period: '2024-10-01 ~ 2024-12-31',
  },
  iter_003: {
    id: 'iter_003', project_id: 'proj_001', version: 'v2.0', scenario: 3,
    status: 'completed',
    description: '运营复盘发现特定品类MAPE异常，根因定位为促销策略变化',
    created_at:   '2025-02-25T09:30:00Z',
    completed_at: '2025-02-26T18:00:00Z',
    agents: ['root_cause','analyst','pm'],
    metrics: { mae: 380.4, rmse: 490.2, mape: 11.8, model: 'XGBoost + 促销感知' },
    vs_prev: { mae: -9.4, rmse: -7.6, mape: -10.6 },
    conclusion: 'Q1促销策略重大调整导致预测偏差，重新建模促销效应后MAPE降至11.8%',
    highlights: ['识别3个MAPE>25%的异常品类','根因：促销力度分类变化','促销效应分层建模'],
    code_preview: 'promo_encoder = PromotionLevelEncoder(levels=[0,1,2,3,4])\nX[\'promo_effect\'] = promo_encoder.transform(X[\'promotion\'])\nX[\'promo_type\'] = label_encode(X[\'promo_category\'])',
    backtest_period: '2024-10-01 ~ 2024-12-31',
  },
  iter_004: {
    id: 'iter_004', project_id: 'proj_001', version: 'v3.0', scenario: 4,
    status: 'completed',
    description: '供应链团队提出补货周期优化需求，调整预测粒度并增加库存特征',
    created_at:   '2025-03-10T09:00:00Z',
    completed_at: '2025-03-12T15:00:00Z',
    agents: ['business','analyst','engineer','qa'],
    metrics: { mae: 290.6, rmse: 375.3, mape: 9.2, model: 'LightGBM + 库存感知' },
    vs_prev: { mae: -23.6, rmse: -23.5, mape: -22.0 },
    conclusion: '切换LightGBM并新增库存周转特征，MAPE降至9.2%，补货准确率提升18%',
    highlights: ['模型切换至LightGBM','新增库存周转率特征','预测粒度优化（周级）'],
    code_preview: 'import lightgbm as lgb\nparams = {\'num_leaves\': 127, \'learning_rate\': 0.03,\n          \'feature_fraction\': 0.8, \'bagging_fraction\': 0.9}\nmodel = lgb.train(params, dtrain, num_boost_round=1000)',
    backtest_period: '2024-10-01 ~ 2025-02-28',
  },
  iter_005: {
    id: 'iter_005', project_id: 'proj_001', version: 'v3.2', scenario: 4,
    status: 'completed',
    description: '超参精调，集成LightGBM与LSTM，达历史最优',
    created_at:   '2025-03-28T10:00:00Z',
    completed_at: '2025-03-29T14:00:00Z',
    agents: ['engineer','qa'],
    metrics: { mae: 245.3, rmse: 312.1, mape: 7.8, model: 'Ensemble (LightGBM + LSTM)' },
    vs_prev: { mae: -15.6, rmse: -16.8, mape: -15.2 },
    conclusion: '集成LightGBM和LSTM，MAPE降至7.8%，达历史最优，相比基线改善58%',
    highlights: ['LSTM捕获长期时序依赖','Stacking集成策略','贝叶斯超参优化'],
    code_preview: 'from sklearn.ensemble import StackingRegressor\nestimators = [(\'lgb\', lgb_model), (\'lstm\', lstm_wrapper)]\nfinal = StackingRegressor(estimators=estimators,\n                          final_estimator=RidgeCV())',
    backtest_period: '2024-10-01 ~ 2025-03-15',
  },
  // ── proj_002 ──────────────────────────────────────────────
  iter_006: {
    id: 'iter_006', project_id: 'proj_002', version: 'v1.0', scenario: 1,
    status: 'completed',
    description: '用户流失预测基线模型建立',
    created_at:   '2025-02-15T09:00:00Z',
    completed_at: '2025-02-16T16:00:00Z',
    agents: ['pm','analyst','engineer','qa'],
    metrics: { auc: 0.72, precision: 0.61, recall: 0.65, f1: 0.63, model: 'Logistic Regression' },
    vs_prev: null,
    conclusion: '逻辑回归基线AUC=0.72，需优化特征工程和模型架构',
    highlights: ['用户行为特征工程','RFM模型基础','类别不平衡处理（SMOTE）'],
    code_preview: 'from sklearn.linear_model import LogisticRegression\nfrom imblearn.over_sampling import SMOTE\nX_res, y_res = SMOTE().fit_resample(X_train, y_train)\nmodel = LogisticRegression(class_weight=\'balanced\', C=0.1)',
    backtest_period: '2024-11-01 ~ 2025-01-31',
  },
  iter_007: {
    id: 'iter_007', project_id: 'proj_002', version: 'v1.8', scenario: 2,
    status: 'completed',
    description: '深度行为序列建模，引入用户生命周期特征',
    created_at:   '2025-03-05T10:00:00Z',
    completed_at: '2025-03-07T17:00:00Z',
    agents: ['analyst','engineer','business'],
    metrics: { auc: 0.81, precision: 0.71, recall: 0.76, f1: 0.73, model: 'GBM + 序列特征' },
    vs_prev: { auc: 12.5, f1: 15.9, recall: 16.9 },
    conclusion: 'GBM+用户序列特征AUC提升至0.81，行为路径特征重要性最高',
    highlights: ['用户行为序列窗口特征','生命周期阶段分类','SHAP特征重要性解读'],
    code_preview: 'window_feats = create_rolling_features(df, windows=[7,14,30])\nmodel = GradientBoostingClassifier(\n    n_estimators=500, max_depth=5, learning_rate=0.05)',
    backtest_period: '2024-11-01 ~ 2025-02-28',
  },
  iter_008: {
    id: 'iter_008', project_id: 'proj_002', version: 'v2.1', scenario: 4,
    status: 'completed',
    description: '营销团队要求提升高价值用户召回率，调整决策阈值和特征权重',
    created_at:   '2025-03-20T09:30:00Z',
    completed_at: '2025-03-22T15:00:00Z',
    agents: ['business','analyst','engineer','qa'],
    metrics: { auc: 0.87, precision: 0.76, recall: 0.82, f1: 0.79, model: 'XGBoost + 业务规则融合' },
    vs_prev: { auc: 7.4, f1: 8.2, recall: 7.9 },
    conclusion: '业务规则融合+阈值优化，高价值用户Recall提升至82%，满足营销需求',
    highlights: ['高价值用户分层策略','业务规则后处理','Precision-Recall权衡优化'],
    code_preview: 'threshold = optimize_threshold(y_prob, y_true, metric=\'f2\')\npred_high_value = apply_business_rules(\n    base_pred=(y_prob>threshold).astype(int),\n    user_tier=df[\'user_tier\']\n)',
    backtest_period: '2024-11-01 ~ 2025-03-15',
  },
  // ── proj_003 ──────────────────────────────────────────────
  iter_009: {
    id: 'iter_009', project_id: 'proj_003', version: 'v1.0', scenario: 1,
    status: 'completed',
    description: '动态定价基线策略建立，价格弹性估计',
    created_at:   '2025-03-05T10:00:00Z',
    completed_at: '2025-03-07T16:00:00Z',
    agents: ['pm','analyst','engineer','qa'],
    metrics: { revenue_lift: 5.2, margin_improvement: 1.1, model: '规则定价' },
    vs_prev: null,
    conclusion: '基于竞品价格弹性的规则定价，收入提升5.2%，优化空间较大',
    highlights: ['价格弹性估计','竞品价格监控','基础定价规则设计'],
    code_preview: 'price = base_price * (1 + elasticity * demand_gap)\nprice = np.clip(price, min_price, max_price)',
    backtest_period: '2024-12-01 ~ 2025-02-28',
  },
  iter_010: {
    id: 'iter_010', project_id: 'proj_003', version: 'v1.3', scenario: 2,
    status: 'completed',
    description: '分析竞品响应延迟，优化定价时机策略，引入强化学习',
    created_at:   '2025-03-12T09:00:00Z',
    completed_at: '2025-03-14T17:00:00Z',
    agents: ['analyst','engineer','business'],
    metrics: { revenue_lift: 12.3, margin_improvement: 3.1, model: 'RL定价 + 时机优化' },
    vs_prev: { revenue_lift: 136.5, margin_improvement: 181.8 },
    conclusion: '引入RL定价时机选择，收入提升12.3%，利润改善3.1%',
    highlights: ['竞品价格响应时间分析','RL定价时机选择','动态价格边界优化'],
    code_preview: 'pricing_agent = RLPricingAgent(state_dim=32, action_space=price_grid)\nfor step in env.steps():\n    action = pricing_agent.act(state)\n    state, reward, done = env.step(action)',
    backtest_period: '2024-12-01 ~ 2025-02-28',
  },
};

// Runtime: active agent streaming sessions
const streamSessions = {};

// ─────────────────────────────────────────────────────────────
// Agent Scripts per Scenario
// ─────────────────────────────────────────────────────────────

const AGENT_SCRIPTS = {
  1: [
    { agent: 'pm', content: `**任务启动**\n\n本次迭代目标：基于提供的历史数据，从零开始建立预测模型并获取回测结果。\n\n**任务分工：**\n- 数据分析师：完成EDA和特征工程方案\n- 建模工程师：负责模型选型、训练和调优\n- 质量评估师：执行回测验证并输出评估报告\n\n各方请按序推进，遇到问题及时同步。` },
    { agent: 'analyst', content: `**数据探索分析（EDA）**\n\n已完成数据加载和全量分析：\n\n📊 **数据概况：**\n- 训练集：180,420条记录，时间跨度 2022-01 至 2024-12\n- 原始特征维度：47个\n- 目标变量：销售数量（右偏分布，建议log变换处理）\n\n🔍 **关键发现：**\n1. **节假日效应**：春节前后销量波动 ±40%，是最强周期性信号\n2. **缺失值**：促销活动字段缺失率 18%，需插补或分箱处理\n3. **结构断点**：3个品类在2023Q3存在明显的趋势断点（疑似渠道策略变化）\n4. **长尾分布**：头部20个SKU贡献75%销售额，建议分层处理\n\n✅ **数据质量评分：76/100**（可建模，建议进行数据增强）` },
    { agent: 'engineer', content: `**模型选型与设计方案**\n\n基于EDA结论，推荐以下建模框架：\n\n\`\`\`python\nimport xgboost as xgb\nfrom sklearn.model_selection import TimeSeriesSplit\nimport numpy as np\n\n# 特征工程\nfeatures = [\n    'lag_7', 'lag_14', 'lag_28',          # 历史滞后特征\n    'rolling_mean_7', 'rolling_std_14',    # 滚动统计特征\n    'holiday', 'promo_level',              # 业务特征\n    'month', 'week_of_year', 'dow'         # 时间特征\n]\n\n# 交叉验证（时序分割）\ntscv = TimeSeriesSplit(n_splits=5)\n\n# 模型训练\nparams = {\n    'n_estimators': 200,\n    'max_depth': 6,\n    'learning_rate': 0.05,\n    'subsample': 0.8,\n    'colsample_bytree': 0.8\n}\nmodel = xgb.XGBRegressor(**params)\nmodel.fit(X_train, np.log1p(y_train),\n          eval_set=[(X_val, np.log1p(y_val))],\n          early_stopping_rounds=50)\n\`\`\`\n\n⏳ **正在训练，预计2~3分钟...**` },
    { agent: 'engineer', content: `**模型训练完成**\n\n✅ 共训练 200 棵树（early stopping 在第187轮触发）\n\n**验证集评估：**\n| 指标 | 值 |\n|------|----|\n| MAE  | 580.2 |\n| RMSE | 710.5 |\n| MAPE | **18.5%** |\n\n📊 **特征重要性 Top 5：**\n1. \`lag_7\` — 0.28\n2. \`promo_level\` — 0.19\n3. \`rolling_mean_7\` — 0.15\n4. \`holiday\` — 0.12\n5. \`lag_14\` — 0.09\n\n⚠️ 注意：\`promo_level\` 当前仅为0/1二值，信息损失较大` },
    { agent: 'qa', content: `**回测评估报告**\n\n回测周期：2024-10-01 至 2024-12-31\n\n📋 **回测结果汇总：**\n| 指标 | 实际值 | 业务目标 | 状态 |\n|------|--------|----------|------|\n| MAE  | 580.2  | < 400    | ❌ 未达标 |\n| MAPE | 18.5%  | < 15%    | ❌ 未达标 |\n| RMSE | 710.5  | < 500    | ❌ 未达标 |\n\n⚠️ **主要问题：**\n1. 大促期间（双11、618）预测偏差最大（MAPE 32%+）\n2. 长尾 SKU 预测稳定性差（P95误差 > 55%）\n3. 缺少天气等外部数据，节假日建模过于粗粒度\n\n💡 **改进建议：**\n- 引入天气、精细化节假日分类等外部数据\n- 对头部/长尾 SKU 分层建模\n- 促销特征精细化（强度分级 + 类型区分）\n\n📁 **迭代v1.0报告已归档，建议进入场景2开展多维优化分析**` },
  ],
  2: [
    { agent: 'analyst', content: `**多维度建模结果深度分析**\n\n基于当前版本建模结果，开展全面的诊断分析：\n\n**分析维度：**\n1. 品类维度误差分布\n2. 时间维度误差趋势\n3. 特征有效性评估\n4. 数据质量专项审查` },
    { agent: 'analyst', content: `**误差分布分析**\n\n📊 **品类误差排行（MAPE Top 5）：**\n| 品类 | MAPE | 样本量 | 主要问题 |\n|------|------|--------|----------|\n| 鲜食   | 31.2% | 2,340 | 保质期短、库存波动 |\n| 电子配件 | 28.7% | 1,890 | 新品频繁上线 |\n| 季节服装 | 25.1% | 3,210 | 季节断点明显 |\n| 进口商品 | 22.4% |   987 | 供应链波动大 |\n| 大促专区 | 21.8% | 5,670 | 促销规律多变 |\n\n🕐 **时间维度分析：**\n- 工作日误差：8.2%（良好）\n- 周末误差：14.6%（待优化）\n- 节假日误差：24.3%（问题突出）\n- 大促活动期：35.7%（严重偏差）\n\n📐 **特征贡献度评估：**\n- \`promo_level\` 当前为二值，信息利用率仅38%\n- \`holiday\` 仅有7分类，建议细化至23类\n- 未纳入天气信号，相关性验证显示 r=0.34（显著）` },
    { agent: 'engineer', content: `**技术优化机会识别**\n\n🚀 **优先级排序（按预期收益）：**\n\n**[优先级1] 促销感知精细化建模**\n- 预期MAPE改善：-5 ~ -8%\n- 当前：二值促销特征 → 优化：5级强度 × 4类型 = 20维特征\n- 实现难度：⭐⭐\n\n**[优先级2] 外部数据接入**\n- 预期MAPE改善：-3 ~ -5%\n- 天气指数（降雨量、气温偏差）\n- 节假日细分（法定节假日23类 + 调休规则）\n- 实现难度：⭐⭐\n\n**[优先级3] SKU分层建模**\n- 预期MAPE改善：-2 ~ -4%\n- Top 500 SKU独立训练 + 长尾SKU协同过滤\n- 实现难度：⭐⭐⭐\n\n**总预期改善：MAPE从当前值下降30~45%**` },
    { agent: 'business', content: `**业务价值评估与优化计划**\n\n📋 **已与业务团队对齐的优化计划：**\n\n**阶段一（本周内，优先级高）：**\n- ✅ 促销强度分级重构（0-4级）\n- ✅ 节假日类型精细化（7类→23类）\n- 预计MAPE改善：-6%\n\n**阶段二（下周，中优先级）：**\n- 📅 天气数据接入与特征工程\n- 📅 品类分层建模框架\n- 预计MAPE改善：-4%\n\n**阶段三（两周内，常规）：**\n- 📝 长尾SKU协同过滤\n- 📝 集成模型与超参优化\n- 预计MAPE改善：-2%\n\n💰 **业务收益预估（阶段一完成后）：**\n- 库存积压减少约15%（对应年化节约约680万）\n- 缺货率降低约12%\n- 补货计划准确率提升约20%\n\n✅ **优化计划已确认，阶段一工作可立即启动**` },
  ],
  3: [
    { agent: 'root_cause', content: `**运营复盘启动**\n\n复盘周期：过去30天（2025-03-01 至 2025-03-31）\n\n📊 **整体指标摘要：**\n| 指标 | 本月 | 上月 | 变化 |\n|------|------|------|------|\n| 平均MAPE | 12.4% | 10.1% | **+2.3pp** ⚠️ |\n| P95误差 | 38.7% | 34.5% | **+4.2pp** ⚠️ |\n| 稳定性指数 | 0.76 | 0.84 | **-0.08** ⚠️ |\n| 数据及时率 | 98.2% | 97.8% | +0.4pp ✅ |\n\n🚨 **异常信号：** 检测到 **7个** 品类MAPE超标，**3个** 时间段异常，开始深入分析...` },
    { agent: 'analyst', content: `**异常指标深度分析**\n\n📊 **异常品类详情：**\n| 品类 | 当月MAPE | 上月MAPE | 变化幅度 | 严重度 |\n|------|---------|---------|---------|-------|\n| 功能性食品 | 28.4% | 11.2% | **+153%** | 🔴 严重 |\n| 健身器材   | 24.1% |  9.8% | **+146%** | 🔴 严重 |\n| 营养保健   | 19.7% | 12.3% | +60%  | 🟡 中等 |\n| 运动服装   | 17.2% | 13.1% | +31%  | 🟡 中等 |\n| 有机食品   | 14.8% | 11.9% | +24%  | 🟢 关注 |\n\n🕐 **时间维度异常：**\n- 3月第2周：系统性低估（实际>预测 约+20%）\n- 3月第3周周末：MAPE飙升至45%（历史最高）\n- 3月28-31日：恢复正常区间\n\n💡 **初步假设：** 可能与3月健康生活消费趋势变化有关，需根因定位` },
    { agent: 'root_cause', content: `**根因分析报告**\n\n🔍 **根因追踪结果（已验证）：**\n\n**主要根因 #1（贡献度：55%）— 新营销活动未同步**\n- 3月8日启动"健康生活月"全平台营销活动\n- 影响品类：所有功能性食品、营养健康品类\n- 根本原因：预测系统未接收到活动预告信号\n- 证据：活动开始前后销量对比 +132%，无提前特征输入\n\n**主要根因 #2（贡献度：30%）— 外部趋势突变**\n- 3月初某健康博主文章引发健身热潮（微博阅读2.3亿次）\n- 功能性食品搜索量峰值 +280%\n- 模型未纳入社交媒体信号特征\n- 证据：搜索量与销量滞后相关系数 r=0.87（滞后1天）\n\n**次要根因 #3（贡献度：15%）— 供应链扰动**\n- 主力SKU断货3天，替代品销量异常放大\n\n✅ **根因定位完成**` },
    { agent: 'pm', content: `**改善方案 & 迭代机会点**\n\n基于根因分析，制定分层改善计划：\n\n**🚨 紧急处理（本周内）：**\n1. 建立营销活动日历接口，提前T-7天同步活动信息\n2. 对当前异常品类手动上调预测系数（临时方案）\n3. 功能性食品+健身器材品类触发实时监控告警\n\n**📅 中期迭代（下个Sprint）：**\n1. 接入百度指数/微信指数API作为先验特征\n2. 事件感知特征框架设计（营销活动 + 社交热点）\n3. 供应链扰动检测机制建立\n\n**🔮 长期规划：**\n1. 实时特征流水线架构升级（T+1小时级特征）\n2. 在线学习模块（快速响应趋势突变）\n3. 模型漂移监控自动化（PSI + KL散度监控）\n\n📊 **预期改善：MAPE恢复至10%以下，稳定性指数恢复至0.85+**\n\n✅ **复盘报告已归档，迭代任务已加入项目看板**` },
  ],
  4: [
    { agent: 'business', content: `**业务需求解读与范围确认**\n\n📋 **本次优化需求来源：供应链团队**\n\n> "当前预测模型在大促期间（双十一、618）误差过高，导致备货计划失准，造成约850万元库存损失。需要重点提升大促期间预测精度，同时缩短预测更新频率至每日滚动更新。"\n\n**业务约束条件：**\n| 项目 | 当前状态 | 目标要求 |\n|------|---------|----------|\n| 大促期MAPE | 35.7% | ≤ 20% |\n| 更新频率 | T+7周 | T+1日 |\n| 预测范围 | 30天滚动 | 保持不变 |\n| 上线时间 | — | 6周内 |\n\n**接下来开展针对性数据探索...**` },
    { agent: 'analyst', content: `**大促期间数据专项探索**\n\n📊 **历史大促回顾（2022-2024共6次）：**\n\`\`\`\n大促      预热期涨幅  爆发期涨幅  余震期涨幅  MAPE\n618-22   +45%      +312%      +28%      38.2%\n双11-22  +62%      +445%      +35%      41.7%\n618-23   +38%      +287%      +22%      33.1%\n双11-23  +55%      +398%      +31%      37.4%\n618-24   +41%      +319%      +19%      35.9%\n双11-24  +58%      +421%      +28%      36.8%\n\`\`\`\n\n🔍 **关键发现：**\n1. **爆发期**销量激增 300~450%，现有模型严重低估\n2. **预热期**可作为爆发期的有效早期信号（r=0.82）\n3. **余震期**被模型高估（惯性效应）\n4. 品类间大促弹性差异显著（×3 ~ ×15）\n\n💡 **建模策略：大促分期建模（预热/爆发/余震），引入大促历史弹性特征**` },
    { agent: 'engineer', content: `**大促感知模型实现**\n\n\`\`\`python\nimport pandas as pd\nimport numpy as np\nfrom catboost import CatBoostRegressor\n\ndef create_promo_features(df, events_calendar):\n    df['days_to_promo'] = calc_days_to_event(df.date, events_calendar)\n    df['promo_phase'] = pd.cut(\n        df['days_to_promo'],\n        bins=[-np.inf,-7,-1,0,3,7,np.inf],\n        labels=['normal','preheat','D-1','D0','wave','recovery']\n    )\n    df['hist_elasticity'] = events_calendar.merge(\n        df[['sku_id','category']]\n    )['avg_lift'].fillna(1.0)\n    return df\n\n# 大促专属模型（CatBoost原生支持类别特征）\nmodel = CatBoostRegressor(\n    iterations=2000,\n    learning_rate=0.02,\n    depth=8,\n    cat_features=['promo_phase','category_tier','sku_tier'],\n    eval_metric='MAPE',\n    early_stopping_rounds=100,\n)\nmodel.fit(X_train, y_train, eval_set=(X_val, y_val))\n\`\`\`\n\n⏳ **正在训练大促感知模型（预计3~5分钟）...**` },
    { agent: 'qa', content: `**回测验证报告 — 大促专项**\n\n✅ **6次大促验证集结果：**\n| 大促 | 优化前 | 优化后 | 改善幅度 |\n|------|--------|--------|----------|\n| 618-22  | 38.2% | 21.4% | **-44%** |\n| 双11-22 | 41.7% | 23.1% | **-45%** |\n| 618-23  | 33.1% | 18.7% | **-43%** |\n| 双11-23 | 37.4% | 20.2% | **-46%** |\n| 618-24  | 35.9% | 19.3% | **-46%** |\n| 双11-24 | 36.8% | 20.8% | **-43%** |\n| **均值** | **37.2%** | **20.6%** | **-45%** |\n\n✅ **已达成业务目标（≤20%）**\n\n📊 **全量回测（含非大促期）：**\n- 整体MAPE：9.2% → **8.8%**（略有提升）\n- 稳定性指数：0.83（良好）\n- 更新延迟：已验证T+1日更新可行\n\n💡 **建议：** 可按计划部署，推荐在618前2周完成灰度验证和线上监控配置` },
  ],
  5: [
    { agent: 'business', content: `**业务问题受理与解析**\n\n📋 **问题描述（来自运营团队）：**\n\n> "最近两周模型预测的补货量一直比实际需求低20-30%，导致多个爆款SKU连续缺货，影响销售额约230万元。到底是模型出了问题，还是需求本身发生了变化？请给出明确的分析和解释。"\n\n**分析目标：**\n1. ✅ 判断：是模型问题还是真实需求结构变化\n2. ✅ 量化：影响范围和程度\n3. ✅ 解释：明确原因，给出业务侧可理解的解读\n4. ✅ 建议：短期应对和中期改进方案\n\n**已调取最近30天数据，数据分析师开始诊断...**` },
    { agent: 'analyst', content: `**数据诊断分析**\n\n📊 **最近14天 vs 前30天基准对比：**\n| 指标 | 前30天基准 | 最近14天 | 变化 |\n|------|-----------|---------|------|\n| 日均销售额（万） | 142.3 | 178.6 | **+25.5%** |\n| 订单量（件） | 28,450 | 35,720 | **+25.6%** |\n| 客单量（件/单） | 2.1 | 2.3 | +9.5% |\n| 新客占比 | 18% | 31% | **+72%** ⚠️ |\n| 渠道分布 | 自然流量85% | 投放流量52% | 结构突变 ⚠️ |\n\n🔍 **关键线索：新客占比异常升高（18%→31%），渠道结构发生重大变化！**\n\n**继续深挖渠道和行为维度...**` },
    { agent: 'analyst', content: `**根因定位分析**\n\n🔍 **溯源分析结果（已验证3条证据链）：**\n\n**原因1（主要，贡献度：65%）— 投放渠道策略变化**\n- 4月1日起，抖音/小红书渠道投放预算增加3倍\n- 新渠道用户行为特征与历史用户差异显著\n  - 单次购买量更小（-18%），购买频次更高（+34%）\n  - 品类偏好集中在3C配件、快消品\n- 模型训练数据以老渠道用户为主，无法泛化\n- **证据：** 按渠道分拆后，老渠道用户预测误差仅5.2%，新渠道误差达28.7%\n\n**原因2（次要，贡献度：25%）— 竞品库存短缺溢出**\n- 3月28日主要竞品出现断货（监控到竞品评论骤增 +800%）\n- 用户转移购买，3C配件品类承接 +45% 需求\n\n**原因3（次要，贡献度：10%）— 季节性提前**\n- 今年3月气温较历年均值高 2.3°C\n- 春季品类提前2周入场，与历史季节节奏错位\n\n**结论：这是真实需求结构变化，非模型本身故障**` },
    { agent: 'business', content: `**业务解释与应对方案**\n\n📋 **给运营团队的通俗解释：**\n\n这次补货偏低是因为你们的获客渠道（抖音/小红书）引入了一批行为特征完全不同的新用户。预测模型是按历史老用户规律训练的，对这批新用户的需求估计偏低——这是正常的，不是模型"坏了"，而是市场发生了真实变化。\n\n**立即行动（本周内）：**\n1. 受影响的23个SKU，手动将安全库存系数上调至 1.5\n2. 运营团队：渠道投放计划提前T-3天同步给数据团队\n3. 供应链：针对3C配件、快消品类提高备货缓冲至2倍\n\n**模型改进（下个迭代）：**\n1. 新增渠道来源特征（新/老渠道销量占比）\n2. 投放计划数据接入预测模型作为前瞻特征\n3. 竞品库存监控信号特征化\n\n**预防机制：**\n- 建立需求突变实时预警（连续3天偏差>15%自动触发告警）\n\n📊 **预期效果：同类渠道驱动的预测偏差从25%+降至8%以下**` },
  ],
  6: [
    { agent: 'analyst', content: `**监控大盘指标体系设计**\n\n构建覆盖模型全生命周期的监控指标框架：\n\n📊 **一级指标（核心健康度）：**\n1. **预测精度**：MAPE、MAE、RMSE（整体 + 分品类）\n2. **模型稳定性**：PSI（特征分布漂移）+ 预测值分布漂移\n3. **数据质量健康度**：缺失率、异常值率、时效性\n4. **业务覆盖率**：有效预测SKU占比、新品覆盖率\n\n📊 **二级指标（诊断细项）：**\n- 分品类、分渠道、分时段误差热图\n- 特征重要性稳定性监控\n- 置信区间覆盖率（标定质量）\n- Top N异常SKU实时列表` },
    { agent: 'root_cause', content: `**异常预警阈值设定**\n\n⚠️ **告警规则配置（生产级别）：**\n| 指标 | 正常范围 | 黄色预警 | 红色告警 | 当前值 | 状态 |\n|------|---------|---------|---------|--------|------|\n| 整体MAPE | <10% | 10~15% | >15% | **7.8%** | ✅ |\n| 品类MAPE最大值 | <20% | 20~30% | >30% | **24.1%** | 🟡 |\n| 稳定性指数 | >0.80 | 0.70~0.80 | <0.70 | **0.83** | ✅ |\n| 特征PSI | <0.1 | 0.1~0.2 | >0.2 | **0.07** | ✅ |\n| 数据延迟 | <2h | 2~4h | >4h | **0.5h** | ✅ |\n| 覆盖率 | >95% | 90~95% | <90% | **97.2%** | ✅ |\n\n🔍 **当前异常：健身器材品类MAPE=24.1%，触发黄色预警**\n分析原因中...` },
    { agent: 'analyst', content: `**数据大盘实时快照（2025-04-07）**\n\n📊 **预测覆盖情况：**\n- 有效预测SKU：**12,847 / 13,234**（覆盖率97.2%）\n- 今日新品（无历史数据）：387个SKU\n- 平均预测置信度：0.78\n\n📊 **精度分布：**\n| MAPE区间 | SKU数  | 占比    |\n|---------|--------|--------|\n| <5%     | 4,231  | 32.9%  |\n| 5~10%   | 5,019  | 39.1%  |\n| 10~20%  | 2,874  | 22.4%  |\n| 20~30%  |   589  |  4.6%  |\n| >30%    |   134  |  1.0%  |\n\n📈 **近7天MAPE趋势（持续优化中）：**\n9.1% → 8.5% → 8.2% → 7.9% → 7.8% → 7.8% → **7.8%**\n\n🏆 **本月累计 vs 上月：** -0.8pp（持续改善）\n\n✅ **整体健康度：良好**` },
    { agent: 'root_cause', content: `**异常追踪专报 — 健身器材品类**\n\n🔍 **异常详情：**\n- 受影响SKU：47个（健身器材全品类）\n- 异常开始时间：2025-04-04 14:30\n- 持续时长：约72小时（仍在持续）\n- 预测方向：持续低估（实际>预测约28%）\n\n**根因分析：**\n- 2025-04-04，某健身KOL发布测评视频（播放量1.2亿）\n- 相关SKU关键词搜索量激增 +340%（今日维持+180%）\n- 事件驱动的需求暴涨，模型无法提前感知\n\n**处置措施（已执行）：**\n1. ✅ 受影响47个SKU预测系数临时上调 ×1.4\n2. ✅ 仓储备货通知已发出（优先级高）\n3. ✅ 本次事件录入"社交热点事件库"\n\n**后续改进（纳入迭代计划）：**\n- 接入热搜/话题指数实时监控 API\n- 构建社交热点事件感知特征\n- 建立短期爆发性需求专项模型\n\n📋 **监控大盘报告已生成，自动推送至订阅邮件列表**` },
  ],
};

// ─────────────────────────────────────────────────────────────
// Rate Limiters
// ─────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

// ─────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────

// GET /api/meta — static reference data
app.get('/api/meta', (_req, res) => {
  res.json({ agents: AGENTS, scenarios: SCENARIOS });
});

// GET /api/dashboard — overview stats
app.get('/api/dashboard', (_req, res) => {
  const projectList = Object.values(projects);
  const iterList    = Object.values(iterations);

  const stats = {
    total_projects:    projectList.length,
    active_projects:   projectList.filter(p => p.status === 'active').length,
    total_iterations:  iterList.length,
    scenario_counts: Object.fromEntries(
      Object.keys(SCENARIOS).map(s => [s, iterList.filter(i => i.scenario === Number(s)).length])
    ),
    recent_iterations: iterList
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(i => ({ ...i, project_name: projects[i.project_id]?.name })),
  };
  res.json(stats);
});

// GET /api/projects
app.get('/api/projects', (_req, res) => {
  res.json(Object.values(projects));
});

// POST /api/projects
app.post('/api/projects', (req, res) => {
  const { name, description, type, tags } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = `proj_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  projects[id] = {
    id, name, description: description || '', status: 'active',
    type: type || 'timeseries', tags: tags || [],
    current_version: 'v0.0', created_at: now, updated_at: now,
    best_metrics: null, baseline_metrics: null, improvement: null,
    iteration_count: 0,
  };
  res.status(201).json(projects[id]);
});

// GET /api/projects/:id
app.get('/api/projects/:id', (req, res) => {
  const p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});

// GET /api/projects/:id/iterations
app.get('/api/projects/:id/iterations', (req, res) => {
  const list = Object.values(iterations)
    .filter(i => i.project_id === req.params.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(list);
});

// GET /api/iterations/:id
app.get('/api/iterations/:id', (req, res) => {
  const it = iterations[req.params.id];
  if (!it) return res.status(404).json({ error: 'Iteration not found' });
  res.json(it);
});

// GET /api/projects/:id/metrics-history — for charting
app.get('/api/projects/:id/metrics-history', (req, res) => {
  const list = Object.values(iterations)
    .filter(i => i.project_id === req.params.id && i.status === 'completed')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(list.map(i => ({
    id: i.id, version: i.version, scenario: i.scenario,
    metrics: i.metrics, created_at: i.created_at,
  })));
});

// POST /api/agent/start — create a new streaming session
app.post('/api/agent/start', (req, res) => {
  const { project_id, scenario } = req.body;
  if (!project_id || !scenario) return res.status(400).json({ error: 'project_id and scenario are required' });
  if (!SCENARIOS[scenario]) return res.status(400).json({ error: 'Invalid scenario' });

  const sessionId = uuidv4();
  streamSessions[sessionId] = {
    id: sessionId, project_id, scenario: Number(scenario),
    status: 'pending', created_at: new Date().toISOString(),
  };
  res.json({ sessionId });
});

// GET /api/agent/stream/:sessionId — SSE endpoint
app.get('/api/agent/stream/:sessionId', (req, res) => {
  const session = streamSessions[req.params.sessionId];
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const script = AGENT_SCRIPTS[session.scenario] || [];
  let aborted = false;

  req.on('close', () => { aborted = true; });

  const sendEvent = (data) => {
    if (!aborted) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const runScript = async () => {
    session.status = 'running';
    let totalDelay = 0;

    for (const block of script) {
      if (aborted) break;
      totalDelay += 1200 + Math.random() * 800;

      await new Promise(r => setTimeout(r, totalDelay < 1500 ? 800 : 1200));
      if (aborted) break;

      // Stream the content word-by-word with small delays
      const words = block.content.split(/(\s+)/);
      sendEvent({ type: 'agent_start', agent: AGENTS[block.agent] });
      let accumulated = '';

      for (const word of words) {
        if (aborted) break;
        accumulated += word;
        await new Promise(r => setTimeout(r, 18 + Math.random() * 25));
        sendEvent({ type: 'token', agent: AGENTS[block.agent], token: word, full: accumulated });
      }
      sendEvent({ type: 'agent_end', agent: AGENTS[block.agent], content: block.content });
    }

    if (!aborted) {
      // Save as a completed iteration
      const itId = `iter_${uuidv4().slice(0, 8)}`;
      const proj = projects[session.project_id];
      const scen = SCENARIOS[session.scenario];
      const now  = new Date().toISOString();
      const vNum = (proj.iteration_count || 0) + 1;

      iterations[itId] = {
        id: itId,
        project_id: session.project_id,
        version: `v${vNum}.0`,
        scenario: session.scenario,
        status: 'completed',
        description: `[Agent自动生成] ${scen.name}`,
        created_at: session.created_at,
        completed_at: now,
        agents: scen.agents,
        metrics: { model: `${scen.name} 模型` },
        vs_prev: null,
        conclusion: `${scen.name}场景执行完成，请查看Agent日志获取详细结论。`,
        highlights: [`${scen.name}流程已执行`],
        code_preview: '# 参见Agent输出日志',
        backtest_period: '见分析报告',
      };

      if (proj) {
        proj.iteration_count = (proj.iteration_count || 0) + 1;
        proj.updated_at = now;
      }

      sendEvent({ type: 'complete', iteration_id: itId });
      res.end();
    }
  };

  runScript().catch(() => { if (!aborted) res.end(); });
});

// GET /api/monitoring/:project_id — scenario-6 style monitoring data
app.get('/api/monitoring/:project_id', (req, res) => {
  const pid = req.params.project_id;
  if (!projects[pid]) return res.status(404).json({ error: 'Project not found' });

  // Generate 30-day MAPE trend
  const trend = [];
  const base  = 8.5;
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trend.push({
      date: d.toISOString().slice(0, 10),
      mape: +(base + (Math.random() - 0.5) * 2).toFixed(2),
    });
  }

  // Category breakdown
  const categories = [
    { name: '食品饮料',   mape: 6.2,  sku_count: 3210, status: 'normal'  },
    { name: '家居用品',   mape: 8.1,  sku_count: 2890, status: 'normal'  },
    { name: '电子配件',   mape: 12.7, sku_count: 1890, status: 'warning' },
    { name: '服装鞋帽',   mape: 10.3, sku_count: 3120, status: 'warning' },
    { name: '健身器材',   mape: 24.1, sku_count:  340, status: 'alert'   },
    { name: '美妆个护',   mape: 7.8,  sku_count: 1560, status: 'normal'  },
  ];

  const kpis = {
    overall_mape:      7.8,
    stability_index:   0.83,
    coverage_rate:     97.2,
    data_latency_h:    0.5,
    alert_count:       1,
    warning_count:     2,
    total_sku:         13234,
    covered_sku:       12847,
  };

  res.json({ kpis, trend, categories });
});

// ─────────────────────────────────────────────────────────────
// Catch-all: serve frontend
// ─────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AlgoManager server running at http://localhost:${PORT}`);
});
