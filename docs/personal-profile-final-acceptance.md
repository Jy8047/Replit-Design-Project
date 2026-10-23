# Personal Profile / Intake Layer 最终验收

验收日期：2026-10-23。合成数据，真实本地 PDF/API 与浏览器流程。
未调用真实 RunPod/GLM，未读取或打印 API Key，未部署、推送或公开仓库。

后续安全核查与依赖修复见 [交付前安全告警核查](intake-security-handoff.md)。
下文是当时验收记录；最新依赖计数、回归结果与有条件内部交接结论以上述后续报告为准。

## 交付判定

**修复后交付。** 输入层功能与现有匹配接口通过，可内部移交代码和接口；
全项目依赖扫描仍有严重/高危告警，不能签署“安全验收全部通过”或公开上线结论。
依赖告警需团队核实可利用性并协调修复，本轮未越权升级共享工具链。

## 任务单

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 文字型 PDF 上传及实际提取 | 通过 | 浏览器对两份合成 PDF 发送真实请求，核对实际文字及字段 |
| 拒绝非 PDF、空文件、超限及假 PDF | 通过 | 浏览器覆盖 DOCX/JPG/空/超过10MiB/错误文件头；API测试覆盖类型、损坏、截断、加密、页数、文字长度 |
| 扫描/空白 PDF | 通过（正确拒绝解析） | API返回 OCR_REQUIRED、空文字、无档案；不表示已实现 OCR |
| 在线填写 | 通过 | 两种身份均实际填写、预览、确认和进入匹配 |
| Fresh Graduate 字段 | 通过 | 学校、学位、专业、课程、实习、学术、证书、个人经历、兴趣均实际填写；就业字段不显示 |
| Career Switcher 字段 | 通过 | 以上字段加就业经历；确认及刷新后保留 |
| 身份切换 | 通过 | 有就业信息时不能直接隐藏并保存为应届生；保留/明确删除两分支实测 |
| 统一 JSON | 通过 | 两输入方式均经过 normalizeProfile 核对；基础字段相同，来源元数据可选 |
| 编辑、预览、明确确认 | 通过 | 编辑后预览仍不修改确认档案，点击确认才更新 |
| 未确认隔离 | 通过 | 保存函数拒绝 false/缺失/字符串等确认值；编辑期间匹配仍用旧确认；未确认存储不进入匹配 |
| 空字段、不编造 | 通过（已测范围） | 未标注事实留空，未知叙述不推断；null/数组/数值文本变空字符串；None/无/Tiada保留 |
| input_method / mapping_provenance | 通过 | PDF保留pdf_upload，在线为online_form；simulated经编辑、草稿恢复、确认、刷新保留 |
| 刷新后保持 | 通过 | 四条路径均覆盖草稿整页重载；确认后重载实际匹配页 |
| 匹配兼容 | 通过（现有skills接口） | 比较真实页面全部排序和分数与现有函数结果；确认新技能后结果变化 |
| 真实 GLM 能力 | 未验证 | 按要求禁止真实调用 |
| 扫描版 OCR 能力 | 未通过（未实现；文字型演示范围外） | 仅提供正确的不可提取提示，不伪造OCR结果 |
| 本地资源保护 | 通过（有限范围） | 两槽并发、释放后恢复、第11次请求429测试；大小/页数/文字上限测试 |
| 公网压力及平台Private Preview保护 | 未验证 | 未进行外部压力测试或验证平台权限；页面文案不是鉴权证据 |
| 依赖安全最终签收 | 未通过 | 扫描器报告12严重、23高危、14中危、4低危告警，未完成核实整改 |
| GitHub远端秘密扫描/权限 | 未验证 | 没有访问远端设置、警报或远端独有历史，没有推送 |

## 实际执行结果

- 前端 `node:test`：33项通过，0失败。
- 后端 PDF/API/规则映射/GLM mock/资源保护：21项通过，0失败。
- 原离线适配器：14项通过，0失败。
- 合计68项单元/接口测试；不把4条浏览器旅程重复计入该数量。
- 浏览器：PDF×两身份、在线×两身份，共4条完整旅程通过。
  另覆盖5类上传错误、身份切换保留/删除、未确认档案隔离及网络断言。
- 浏览器4次真实本地API上传，0次RunPod请求，0运行时异常，无伪造成功响应。
  资源计数单测使用显式受控本地提取桩，不冒充真实AI或PDF提取验收。
- 前后端TypeScript检查、构建均通过。前端有原有tooltip源映射警告，不阻断构建。
- SAST完整扫描：0条结果；隐私数据流扫描：0条结果。这不保证不存在漏洞。

## JSON及匹配接口

定义：`src/lib/profile.ts` 的 Profile / normalizeProfile。

- `profile_type`: `"fresh_graduate" | "career_switcher"`。
- `input_method`: `"pdf_upload" | "online_form"`，是档案来源，不因编辑PDF草稿改成在线。
- `education`: 对象，school、degree、major、key_courses全为字符串。
- 下列均为字符串：internship_experience、academic_experience、
  professional_certificates、personal_experience、interests_and_hobbies、
  employment_experience、other_experience、skills、name、role、background。
- `confirmed_by_user`: 布尔值，只有严格true才能写入确认档案。
- `mapping_provenance`: 可选，目前只支持`"simulated"`。普通在线档案不必包含。
  非法值不会变成“真实AI”来源；这是本地描述性元数据，不是防篡改签名。
- 缺失/非字符串文本标准化成`""`；不支持技能数组。
  显式“无”等保留。学校/学位/专业仍需输入有效文本或显式None。

实测合成PDF应届生编辑确认后的字段示例：

```json
{
  "profile_type": "fresh_graduate",
  "input_method": "pdf_upload",
  "education": {
    "school": "Edited Fictional University",
    "degree": "Bachelor",
    "major": "Computing",
    "key_courses": ""
  },
  "internship_experience": "",
  "academic_experience": "",
  "professional_certificates": "None",
  "personal_experience": "",
  "interests_and_hobbies": "",
  "employment_experience": "",
  "other_experience": "",
  "skills": "Learning design, Content planning, Learning evaluation",
  "name": "Fictional Student",
  "role": "",
  "background": "",
  "confirmed_by_user": true,
  "mapping_provenance": "simulated"
}
```

实际链路：
`extractCvPdf → PdfExtractionPanel → ProfilePage(onUseDraft/edit/confirmProfile)
→ Router.saveProfile → persistConfirmedProfile → Router.profile`
以及刷新时`readProfile → normalizeProfile → confirmed_by_user检查`。

匹配入口是`App.tsx`的
`CareerRolesPage(profileSkills={profile?.skills ?? ''})`，
组件调用`calculateCareerMatches(profileSkills, dataset.records)`。
当前**只传skills字符串**，不是完整JSON；教育/经历/来源标记仍在上游Profile中，
不参与当前算法。本轮不改变队友算法或扩展其业务契约。

## API安全及资源风险

- 无应用身份认证，匿名本地提取仍可用。同意头、CORS、跨站检查、限流不算鉴权。
- 公开路由不连接真实模型；map_profile=true在解析前返回403/LIVE_MAPPING_BLOCKED。
  serverGlmSettings固定disabled且不读取凭据，改环境开关不能恢复公开付费调用。
- 开发和生产环境RUNPOD_LIVE_ENABLED均未设置，保持默认关闭；没有改动开关。
- 文件10MiB、30页、60000字符、worker15秒、两并发、每进程每分钟10次。
  worker空环境、关闭嵌入JS执行、不转发解析日志；不持久化PDF或原始正文。
- 256MiB是JS老生代堆上限，不是完整RSS上限；worker不是操作系统沙箱。
- 无登录意味着匿名者仍可消耗应用CPU/内存。限流是每进程计数，重启会重置，
  不覆盖多实例/分布式滥用，不是货币预算。慢上传/持续压力未验证。
- 本地确认/来源标记可被设备使用者修改，不代表身份认证或独立事实核验。

## 依赖扫描与GitHub秘密信息检查

依赖扫描是全工作区告警，**不是已证明的可利用漏洞数量**：
53条：12严重、23高危、14中危、4低危。
其中orval@8.20.0为codegen开发依赖，报告11严重及1高危；
proxy-addr@2.0.7由API的express@5.2.1引入，报告1严重。
扫描建议修复版本分别包括orval8.22.0及proxy-addr2.0.8。
还涉及Vite、fast-uri、js-yaml等共享依赖。未作整项目升级或公开安全签收。

本地Git检查仅输出路径/行号/规则/计数，不输出匹配值，不读取Replit密钥。
检查当前候选文件及35个本地可达提交的326个blob，0疑似秘密；
15次命中为精确白名单中的合成测试凭据，未发现候选.env秘密文件。
无二进制/超大/符号链接跳过项。启发式规则不是完整泄露证明。
新增.gitignore和.replitignore的.env/.env.*排除，保留示例模板。
GitHub远端权限、Secret Scanning、Push Protection、远端独有分支/历史均未验证。
未fetch、push、改远端或公开仓库。

## 本轮变更与交付建议

本轮未修改输入业务代码、匹配算法、学习路线、SDG或情景逻辑。
仅增加.env忽略保护、本地值脱敏检查脚本、扩展浏览器验收和API资源保护测试。
上轮确认保存边界和PDF来源显示的修复已复验。

交付团队：当前代码、此报告、标准JSON和skills接口、复现命令。
公开服务前：团队核实/修复依赖告警，核实GitHub及平台访问设置，评估资源滥用。
真实GLM需另行批准、可靠授权或隔离操作员入口及费用控制；不能只打开开关。

```sh
pnpm --filter @workspace/career-pathways test
pnpm --filter @workspace/api-server run test:cv
pnpm --filter @workspace/api-server run test:ocr
pnpm --filter @workspace/career-pathways exec node --experimental-strip-types tests/profile-handoff.e2e.mjs
pnpm --filter @workspace/career-pathways run typecheck
pnpm --filter @workspace/api-server run typecheck
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/career-pathways run build
pnpm --filter @workspace/api-server run build
python3 artifacts/career-pathways/tests/intake-secret-check.py
```

浏览器测试需要现有web/API工作流及本地Chromium；无需新服务或模型调用。
