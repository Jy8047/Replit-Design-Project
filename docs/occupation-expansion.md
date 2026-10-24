# 职业库扩充交接

## 范围和数据

- 原有 `public/data/skills-occupations.csv` 完全保留：4 个职业、20 条 synthetic 记录，无核验来源。
- 新增 `public/data/official-occupations.csv`：48 个 O*NET 分类、473 条已核验的职业—能力关联。
- 应用同时加载两个 CSV，总计 52 个职业、493 条记录。新文件仍使用原来的八字段 CSV schema。
- 新增 `src/data/occupation-catalog.json`：唯一 ID、O*NET 编号、三语职业名称及类别、英文原始工作描述、
  Job Zone、教育/经验准备原文与资料日期、来源、原始能力名称/类型/元素编号、条件性 SDG 理由。
- 八个方向各 6 个新增职业：软件与 AI、数据与金融、工程制造、医疗健康、环境可持续、教育人才、设计传媒、运营与供应链。
- `career-matching.ts`、P1 Profile 契约、PDF/确认/保存代码及六个 P3 标准文件均未修改。

## 官方来源核查

采用 **O*NET® 31.0 Database（美国职业资料）**，不代表马来西亚、中国或其他地区的岗位需求或执业要求。

- 数据库：https://www.onetcenter.org/database.html
- 版本档案：https://www.onetcenter.org/db_releases.html
- 发布公告：https://www.onetcenter.org/whatsnew.html#2026082500
- 官方 RSS：https://www.onetcenter.org/rss/whatsnew.xml
- 来源许可证：https://www.onetcenter.org/license_db.html
- CC BY 4.0：https://creativecommons.org/licenses/by/4.0/

RSS 明确记录发布日期 **2026-08-25**；本次实际核查日期 **2026-10-24**，不是用访问日期充当发布日期。
底层条目的调查/评级日期可能更早，保留在元数据 `dataDate` / `entryDataDate` 中。

实际读取并核对了以下公开 CSV（共同目录
`https://www.onetcenter.org/dl_files/database/db_31_0_csv/`）：

| 文件 | 本次用途 |
|---|---|
| `occupation_data.csv` | 官方编号、名称、工作描述 |
| `essential_skills.csv` | 按重要性选取前 2 项基本技能 |
| `transferable_skills.csv` | 按重要性选取前 2 项可迁移技能 |
| `knowledge.csv` | 按重要性选取前 4 项知识领域 |
| `software_skills.csv` | 最多 2 个确实关联该职业的软件示例 |
| `job_zones.csv` | 该职业的准备程度及资料日期 |
| `job_zone_reference.csv` | 准备程度对应的教育/经验说明 |

仅选取非抑制、非不相关的重要性评级；重名技能/知识项去重。
技能、知识、软件示例分别保留类型，不声称它们都是每家雇主的强制要求。
软件名称只做两项明确标准化：Microsoft Excel → Excel、Structured query language SQL → SQL。
**来源的重要性评级没有被导入为 P2 匹配权重。**
7 个原始下载文件的 SHA-256 保存于元数据 sources 中。
48 个官方职业详情链接本次实际 HTTP 检查全部返回 200，且页面包含对应职业编号。

采用 CC BY 4.0，页面显示 USDOL/ETA 署名、许可证及项目改动说明；不声称官方认可。
本轮没有声称已核验 ESCO 或 ILO 数据；它们没有被混入本次记录。

## 候选名称的核验调整

采用源文件中的正式分类名，而不是将宽泛职位名伪装成官方分类：

- Frontend → Web Developers；AI 研究方向 → Computer and Information Research Scientists；
  Cloud → Computer Network Architects；数据方向使用 Data Scientists / Database Architects / Business Intelligence Analysts。
- Renewable energy → Solar Energy Systems Engineers；UX → Web and Digital Interface Designers；
  Digital marketing → Search Marketing Strategists；供应链分析 → Logistics Analysts。
- Financial and Investment Analysts、Health Information Technologists and Medical Registrars 在此版本中有分类名，
  但缺少所需技能评级。没有借用其他职业技能；分别改用有数据的 Financial Examiners、Medical Records Specialists。
- 仓储管理方向采用 First-Line Supervisors of Helpers, Laborers, and Material Movers, Hand；
  分类范围比“仓库主管”广，页面使用正式名称，不声称精确等同。
- 完整的 48 项名称与编号可直接查看元数据文件，不另维护易失配的名称副本。

## 匹配和趋势边界

真实调用链：

`App.tsx → 并行获取两个 CSV → combineCareerDatasets → calculateCareerMatches / explainCareerMatches
→ 现有 matchCareers → /roles；同一已确认 skills 字符串也供 roadmap/scenarios 使用。`

- 已确认 Profile 的 `skills` 仍是 string，Profile 保存与确认机制不变。
- 新增保守的中文/马来文能力名称翻译适配，不推断用户未输入的能力，不回写 Profile。
- 原有职业保留 P2 权重；新增职业没有自造“官方权重”，使用引擎默认等权。
- 修正适配层的 camelCase → snake_case 趋势字段传递；不修改引擎算法。
- 推荐理由与分数使用同一权重配置，避免页面用空配置重新计算不同的缺口优先级。
- **48 个新增职业的需求趋势全部 unknown。** CSV 的 stable 仅为原 enum 的兼容占位；
  evidence 明确说明，元数据另存 unknown。雷达/岗位/情景页面不能把这个占位值解释成稳定需求。
- 新增职业不产生趋势事实理由，情景权重中性；两种情景结果不变不是市场稳定的证据。
- 不导入工资、就业增长率或 2026–2030 市场预测。原有情景曲线仍是 synthetic，未改变数值。
- SDG 标签和三语关联理由由项目编写，关联到具体能力，均为条件性预期贡献，不是测量成效或 UN 认可。
- 官方能力来源核验不代表学习课程已核验。未匹配到已核验资源时，学习路径继续显示资源未核验状态。
- P2 的 confidence 是程序启发式指标，不是录用概率、来源真实性评分或统计置信区间。

## 数据质量与已知限制

- 无重复 ID、职业名称、职业—规范技能对或完全相同的职业能力集合。
- 两对相近分类的能力集合交并比约 0.82：
  Accountants and Auditors / Financial Examiners；
  普通中学教师 / 中学职业技术教师。来源确实共享较多能力，不以改名伪造差异。
  页面提供不同的原始工作描述、分类编号和准备资料；不得把技能分数当作专业资格判断。
- 资格、学历与经验准备按美国参考资料展示；地区执照/注册要求没有独立核验。
- 职业标题、类别、控件、提示及 SDG 理由支持三语；官方工作描述和详细教育/经验原文保留英文，
  页面明确标注“英文原始资料”，未声称这些段落已人工完成三语专业翻译。
- 若来源 CSV 有不匹配记录，会显示数据问题；若某职业缺少元数据中的任一能力，整项职业不进入推荐，
  防止残缺数据悄悄缩小分母。原有 synthetic 记录仍保留。
- 来源核查是本次静态核验，不是运行时实时复核或持续同步。

## 测试与复现

```sh
pnpm --filter @workspace/career-pathways typecheck
pnpm --filter @workspace/career-pathways test
BASE_PATH=/ pnpm --filter @workspace/career-pathways build
```

`BASE_PATH` 是项目现有 Vite 配置的必需构建参数；不传时构建报错。本轮未改 Vite 配置或 Secrets。

新增 `occupation-catalog.test.ts`，覆盖分类/数量、来源/日期、可匹配性、去重、三语、旧分数、
合成资料切换、未知趋势中性、字段适配、SDG 理由、无效和不完整数据。
最终实际执行结果见本轮交付报告；单元测试不等于浏览器点击验收。

本轮最终检查：60 项前端测试全部通过（新增 13 项）、TypeScript 通过、带 `BASE_PATH=/` 的构建通过。
构建仍报告 tooltip 源映射提示和大于 500 kB 的 chunk 警告，未把警告描述为已修复。

手工演示：

1. 在 My Profile 填入虚拟教育资料及 `Programming, Python, Computers and Electronics`，预览后明确确认。
2. 到 `/roles` 查看新增职业、类别、来源、准备程度、技能缺口和“市场趋势未知”；展开工作描述与 SDG 理由。
3. 将技能改为 `Biology, Chemistry, Medicine and Dentistry` 并再次明确确认，比较排名变化。
4. 切换中英马三语；例如中文可填 `编程，计算机与电子学，数学`，马来文可填
   `pengaturcaraan; komputer dan elektronik; matematik`，应与对应英文技能得到相同分数。
5. 选择新增职业进入 `/impact`；切换 `/scenarios` 两种情景，新增职业维持中性结果，
   原有示例仍按原先合成假设计算。

维护者可执行 `python scripts/import-onet-occupations.py` 重建两个新增数据文件。
此命令只访问公开 O*NET 下载/RSS，下载缓存放 `/tmp`，不调用模型、不读取 API Key。
重建后需审查数据差异并重跑检查；不要自动将后续版本或别的职业标为已核验。
