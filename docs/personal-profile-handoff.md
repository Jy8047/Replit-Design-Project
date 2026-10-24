# Personal Profile / Intake Layer 精简交接

日期：2026-10-23。供个人档案模块与职业匹配模块对接。依据当前代码及下列验收记录；**本次仅创建文档，未重跑测试，也未取得接收队友确认**。

## 1. 模块功能与输入

- 页面：`/profile`。支持 **Upload CV** 与 **Fill in Online**，均进入可编辑草稿、预览和明确确认流程。
- **Fresh Graduate**：School、Degree、Major、Key Courses、Internship Experience、Academic Experience、Professional Certificates、Personal Experience、Interests & Hobbies。
- **Career Switcher**：上述字段加 Employment Experience。两个身份使用同一 JSON 结构；应届生通常就业经历为空。已有非空就业经历时切回应届生，必须选择保留相应身份或明确删除，不能静默丢弃后确认。
- **PDF**：仅 PDF，最大 10 MiB；读取真实文件字节，通过后端本地 worker 提取文字。可选规则模拟映射只复制识别到的明确字段，不补造学历、技能或经历；用户需编辑和确认。
- **在线填写**：直接录入相同标准字段。School、Degree、Major 不能为空；除明确的“无”等值外，校验要求至少两个字符。其他事实可以留空。
- 已确认档案保存在本浏览器 localStorage；草稿在同一标签页的 sessionStorage。没有服务端档案数据库、跨设备同步或上传文件持久化。清理浏览器数据会丢失相应状态；刷新不保证恢复文件选择／原始提取面板。

## 2. 标准档案 JSON

以下是**合成、已由虚构用户编辑确认的 PDF 模拟档案示例**，不是实际学生数据或真实 AI 输出。

```json
{
  "profile_type": "career_switcher",
  "input_method": "pdf_upload",
  "education": {
    "school": "Fictional University",
    "degree": "Fictional Bachelor",
    "major": "Education",
    "key_courses": "Learning design; Communication"
  },
  "internship_experience": "",
  "academic_experience": "",
  "professional_certificates": "无",
  "personal_experience": "",
  "interests_and_hobbies": "Reading",
  "employment_experience": "Fictional workshop support experience",
  "other_experience": "",
  "skills": "Communication, Facilitation",
  "name": "",
  "role": "",
  "background": "",
  "confirmed_by_user": true,
  "mapping_provenance": "simulated"
}
```

| 字段 | 类型／含义与空值规则 |
|---|---|
| `profile_type` | `"fresh_graduate" \| "career_switcher"`；身份，不是职业推荐 |
| `input_method` | `"pdf_upload" \| "online_form"`；记录输入来源，不证明使用过 AI |
| `education` | 对象；`school`、`degree`、`major`、`key_courses` 全部为 string，分别是学校、学位、专业、课程 |
| `internship_experience`、`academic_experience` | string；实习／学术经历，缺失为 `""` |
| `professional_certificates`、`personal_experience` | string；证书／个人经历，缺失为 `""` |
| `interests_and_hobbies`、`employment_experience`、`other_experience` | string；兴趣／就业／其他经历，缺失为 `""`；身份切换不得自行丢弃就业信息 |
| `skills` | **string，不是数组**；如 `"Communication, Facilitation"`，没有技能为 `""` |
| `name`、`role`、`background` | string；兼容的姓名／角色／背景字段，未知为 `""`，不能推断补全 |
| `confirmed_by_user` | boolean；只有严格的 `true` 是确认，不接受字符串 `"true"` 等替代值 |
| `mapping_provenance` | 可选字段；档案层当前只识别 `"simulated"`。新建在线档案通常省略，模拟档案经编辑仍可保留；不能写成真实 AI 来源 |

**统一规则：**`normalizeProfile()` 将缺失、null、数字或数组等非字符串文本值归为 `""`，不把课程、证书或技能自动变成数组；文本不自动改写。“无／None／Tiada”等是用户输入的字符串，保留原值，不代表已有证书或技能。无效顶层对象返回 null；无效身份／输入枚举在前端归一化时分别回退 fresh_graduate／online_form，这不是服务端严格校验或授权。

Fresh Graduate 的完整字段集合不变，示例改为 `profile_type: "fresh_graduate"`、`employment_experience: ""`；新建在线输入改为 `input_method: "online_form"`，没有模拟来源时省略 `mapping_provenance`。以上是字段变化说明，不是接收队友验收结果。

**不要混淆 API 包装层和档案层：**提取 API 返回 `text`、`pages`、`status`、`profile`、`mapping`、`mapping_provenance`。包装层 provenance 为 `"none" \| "simulated"`；未请求映射或需要 OCR 时 `profile=null`，不是已确认标准档案。规则映射结果是 `mapping="SIMULATED"`、档案确认值 false。包装层的 `"none"` 不应复制为档案的模拟来源。

## 3. 明确确认与草稿隔离

实际实现：`src/components/profile-page.tsx`、`src/lib/profile.ts`、`src/lib/profile-storage.ts` 和 `src/App.tsx`（均位于 `artifacts/career-pathways/`）。

1. 填写／映射／编辑只产生 `confirmed_by_user=false` 的草稿；提交表单只进入 review。
2. `ProfilePage.confirmProfile()` 再次校验，点击 **Confirm Profile** 才构造 true 并调用 `onSave`。
3. `App.saveProfile()` → `persistConfirmedProfile(localStorage, next)`；后者独立拒绝非严格 true。只有写入成功才 `setProfile(next)`；存储失败显示错误，不把失败草稿当成保存成功。
4. 已确认键：`career-pathways-profile`；草稿键：`career-pathways-profile-draft`。`persistProfileDraft()` 强制草稿为 false；恢复草稿要求版本、已确认档案基准快照匹配，避免旧草稿覆盖新的确认记录。
5. `App.readProfile()` 解析并归一化 localStorage，只返回严格确认档案；未确认／损坏数据不进入 App 的已确认 profile 状态。编辑期间匹配继续用旧确认值；从未确认过则传空技能字符串。

确认表示用户看过并接受资料，**不是独立核实经历，也不是身份认证或防篡改签名**；浏览器存储仍可被用户手动更改。

## 4. 匹配模块实际接口

```text
ProfilePage.confirmProfile()
  → App.saveProfile()
  → persistConfirmedProfile() 成功
  → App 的 profile 状态
  → /roles: profileSkills={profile?.skills ?? ''}
  → CareerRolesPage（App 中别名 RolesPage）
  → calculateCareerMatches(profileSkills, dataset.records)
```

- `CareerRolesPage` 位于 `src/components/career-data-pages.tsx`，其 `profileSkills` prop 类型是 **string**。
- `calculateCareerMatches()` 位于 `src/lib/career-data.ts`，按英文／中文逗号拆分字符串，再归一化技能。函数本身虽也支持 string[]，**当前页面交接的不是数组**。
- **匹配模块没有接收完整 Profile JSON**：学校、经历、身份、确认值、来源标记均未通过该 prop 传入，不能声称它们已参与评分。确认过滤在上游 App；匹配分数不是获聘概率。
- 目前没有给队友承诺一个完整档案的 REST 接口。若要扩展传完整 JSON、技能别名或多语言技能识别，双方需另行确认接口和测试，不能自行改变字段类型。

## 5. 运行与合成演示

使用现有工作流，不重复启动服务：

| 工作流 | 当前命令 |
|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/career-pathways: web` | `pnpm --filter @workspace/career-pathways run dev` |

工作区根目录使用 pnpm；按锁文件安装可用 `pnpm install --frozen-lockfile`。端口及 BASE_PATH 由现有工作流提供，预览进入 `/profile`。当前本地演示不需要真实模型密钥，不启用在线模型。

**在线演示：**
1. Fill in Online → Fresh Graduate；填合成学校、学位、专业，技能填 `Communication, Facilitation`，其他未知值留空或明确填“无”。
2. 进入预览但不确认，前往 `/roles`：不能使用新草稿；已有确认时仍用旧技能。
3. 点击 Confirm Profile，再查看 `/roles`，刷新确认资料仍在；随后编辑技能为 `Learning design, Content planning, Learning evaluation`，重复“未确认隔离 → 确认后更新”的检查，不预先指定应推荐哪个职业。
4. Career Switcher 重复一遍，填合成就业经历；切回应届时验证显式保留／删除选择，确认及刷新后检查就业字段。

**PDF 演示：**用不含真实个人信息的文字型 PDF，写入明确行：`School: Fictional University`、`Degree: Fictional Bachelor`、`Major: Education`、`Skills: Communication, Facilitation`，转行档案再写 `Employment Experience: Fictional workshop support`。上传、选择身份并同意本地提取；检查提取文字，可选规则模拟，编辑补全后预览／确认。扫描或空白 PDF 应提示需要 OCR，不应生成虚构档案；DOCX/JPG 应被拒绝。既有 `tests/cv-fixtures.ts` 和浏览器脚本使用合成 PDF。

## 6. 已有实测证据与复测命令

最新已记录结果来自 [依赖安全复核](dependency-security-review.md)：**88 项自动化测试通过，0 失败／取消／跳过；另有 4 条完整浏览器旅程通过**。这是上一轮实际执行记录，不是本次文档任务新跑的结果，更不是队友已确认。

```bash
pnpm --filter @workspace/api-server run test:cv       # 已记录 41/41
pnpm --filter @workspace/api-server run test:ocr      # 已记录 14/14，仅离线适配器
pnpm --filter @workspace/career-pathways test         # 已记录 33/33
pnpm run typecheck
pnpm --filter @workspace/api-server run build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/career-pathways run build
pnpm --filter @workspace/career-pathways exec node --experimental-strip-types tests/profile-handoff.e2e.mjs
```

浏览器脚本需现有工作流运行及工作区 Chromium。已有实测：PDF／在线 × 应届／转行、编辑确认隔离、刷新、真实本地 PDF 提取和匹配接收；4 次本地 API 上传、0 RunPod 请求、0 运行时异常，无伪造成功响应。全工作区 TS、后端及两个前端构建已通过；既有 tooltip.tsx source-map 警告未消失但不阻塞构建。

## 7. 未完成能力与安全边界

- **本项目不使用 GPU、RunPod 或 GLM-5.3**。先前未接线的客户端与离线 OCR fixture 已移除；PDF 技能映射仅按明确字段标签做规则模拟，必须标为 simulated，不得描述为 AI 成功。
- **真实 OCR 尚未实现**。只支持文字型 PDF；OCR_REQUIRED 是明确限制。扫描版 PDF 不会由 OCR 处理。
- PDF API 仍匿名；同意头、CORS 和限流都不是认证。已有应用入口约 30 秒绝对截止、10 MiB 声明及实际字节限制、禁压缩、解析取消和并发回收，见 [PDF 上传防护](pdf-upload-protection.md)。
- 计时不覆盖完整请求头到达应用之前的慢连接／代理缓冲；单进程全局名额可被一人耗尽，JS 堆限制不是整体 RSS 硬上限。平台访问保护、公网抗压和恶意 PDF 内存峰值未验证；界面 Private workspace 文案不能证明私有访问。
- 最新依赖记录：**严重 0、高危 1、中危 3、低危 1**。剩余高危为 sandbox 的 braces 3.0.3（GHSA-vfj7-8cjw-p6xm，无已知修复版）；中危为 fast-copy 4.0.3、postcss-selector-parser 6.0.10、ts-deepmerge 7.0.3，低危为 esbuild 0.27.3。ts-deepmerge 是生产传递依赖，不能把剩余项一概说成开发风险。详细修复版本、路径和理由见依赖安全复核；旧交接报告的 20 高危计数是历史值。

## 8. 接收队友检查与交接完成标准

**以下均待接收人亲自验证／勾选，不预先签署：**

- [ ] 两输入 × 两身份均能编辑、预览、明确确认；就业信息不静默丢失。
- [ ] 空值、中文“无”、技能 string、`input_method` 和模拟来源在保存／刷新后保持约定。
- [ ] 草稿与未确认存储不替换已确认档案；存储失败不伪报成功。
- [ ] 实际观察 `/roles` 只接收确认后的 skills 字符串，确认前后更新符合预期；未假定完整 JSON 已参与匹配。
- [ ] 在接收环境复跑命令，保存真实数量／失败记录；不把本文历史测试当作本人的新测试。
- [ ] 双方确认只交付本地文字提取／规则模拟，接受尚无 OCR／在线 GLM，以及剩余依赖和匿名接口风险。

**完成标准：**上述检查由接收人执行，双方记录接口约定、测试证据和风险接受结论后，方可写“内部交接完成”。目前只能判为**具备有条件内部交接材料，队友验收待进行**；若要求零高危、真实 OCR／GLM 或公网安全认证，则尚不满足。不得自动推送 GitHub。

参考：[原功能验收](personal-profile-final-acceptance.md) · [原安全交接](intake-security-handoff.md) · [PDF 防护验收](pdf-upload-protection.md) · [最新依赖复核](dependency-security-review.md)
