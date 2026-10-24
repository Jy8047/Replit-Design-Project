# 依赖高危告警复扫与最小兼容修复

日期：2026-10-23。基于当前工作区、`pnpm-lock.yaml`、实际安装依赖树及 `docs/intake-security-handoff.md`。

## 1. 实际扫描结果

| 等级 | 本轮修复前复扫 | 本轮修复后复扫 |
|---|---:|---:|
| 严重 | 0 | 0 |
| 高危 | 20 | **1** |
| 中危 | 7 | 3 |
| 低危 | 2 | 1 |
| 合计 | 29 | **5** |

原 20 条高危中 **19 条消除，1 条待处理**。按扫描告警记录计数，不是依赖包数量或已证实可利用的攻击数量。

- 依赖扫描：修改前、后均实际完成。
- 修改后 SAST：`results=[]`，`incomplete=false`。
- 修改后隐私扫描：`vulnerabilities=[]`。
- 不能将零静态结果等同于项目不存在任何漏洞。未对运行中的服务实施 OOM 或破坏性攻击。

## 2. 原 20 项高危逐项交接表

“范围”是扫描返回的当前相关版本分支；不声称覆盖公告的所有历史主版本。`已移除` 指当前锁文件解析依赖树不再保留该包，由父包升级移除旧链，而非给原库打补丁。

| # | 依赖：修复前 → 当前 | 受影响范围 | 公告给出的修复版本 | 公告编号 | 本轮状态 |
|---:|---|---|---|---|---|
| 1 | brace-expansion：5.0.7 → 已移除 | >=4.0.0, <5.0.10 | 5.0.10 | GHSA-6j4f-fj2g-mc7p | 旧链移除 |
| 2 | brace-expansion：5.0.7 → 已移除 | >=4.0.0, <5.0.8 | 5.0.8 | GHSA-mh99-v99m-4gvg | 旧链移除 |
| 3 | brace-expansion：5.0.7 → 已移除 | >=4.0.0, <5.0.11 | 5.0.11 | GHSA-qhr7-859c-m2p7 | 旧链移除 |
| 4 | brace-expansion：5.0.7 → 已移除 | >=4.0.0, <5.0.9 | 5.0.9 | GHSA-rgw5-rvv9-x895 | 旧链移除 |
| 5 | braces：3.0.3 → 3.0.3 | <=3.0.3 | **未提供** | GHSA-vfj7-8cjw-p6xm | **待处理** |
| 6 | browserslist：4.28.4 → 4.28.7 | <4.28.7 | 4.28.7 | GHSA-73wf-gq98-2v4g | 已升级 |
| 7 | browserslist：4.28.4 → 4.28.7 | <4.28.7 | 4.28.7 | GHSA-c83g-rgw3-j3cx | 已升级 |
| 8 | fast-uri：3.1.3 → 3.1.8 | >=3.1.3, <3.1.6 | 3.1.6 | GHSA-5jgf-p345-68v8 | 已升级 |
| 9 | fast-uri：3.1.3 → 3.1.8 | >=3.0.0, <3.1.5 | 3.1.5 | GHSA-7p8r-x3mc-p8w7 | 已升级 |
| 10 | fast-uri：3.1.3 → 3.1.8 | >=3.0.0, <3.1.6 | 3.1.6 | GHSA-f65p-4m7j-42xc | 已升级 |
| 11 | fast-uri：3.1.3 → 3.1.8 | >=3.1.2, <3.1.6 | 3.1.6 | GHSA-fph4-wmhf-6fwf | 已升级 |
| 12 | fast-uri：3.1.3 → 3.1.8 | >=3.0.0, <3.1.6 | 3.1.6 | GHSA-jqff-g426-hqxp | 已升级 |
| 13 | fast-uri：3.1.3 → 3.1.8 | >=3.0.0, <3.1.7 | 3.1.7 | GHSA-qw65-cvwx-89v3 | 已升级 |
| 14 | fast-uri：3.1.3 → 3.1.8 | >=3.0.0, <3.1.4 | 3.1.4 | GHSA-v2hh-gcrm-f6hx | 已升级 |
| 15 | js-yaml：4.2.0 → 4.3.2 | >=4.0.0, <4.3.2 | 4.3.2 | GHSA-2883-xcg3-v3hh | 已升级 |
| 16 | js-yaml：4.2.0 → 4.3.2 | >=4.0.0, <4.3.0 | 4.3.0 | GHSA-52cp-r559-cp3m | 已升级 |
| 17 | js-yaml：4.2.0 → 4.3.2 | >=4.0.0, <4.3.1 | 4.3.1 | GHSA-5p4m-2wfm-xmqj | 已升级 |
| 18 | markdown-it：14.3.0 → 已移除 | >=14.1.0, <14.3.3 | 14.3.3 | GHSA-gfr2-rv44-r23c | 旧链移除 |
| 19 | markdown-it：14.3.0 → 已移除 | <14.3.2 | 14.3.2 | GHSA-r7fv-28h4-cvq7 | 旧链移除 |
| 20 | source-map-js：1.2.1 → 1.2.2 | >=1.0.0, <1.2.2 | 1.2.2 | GHSA-68fv-2mgg-jv7q | 旧副本已升级 |

第 18 项公告正文将回归追溯到 14.0，而扫描范围起点为 14.1.0，存在描述口径差异，未擅自扩大“安全版本”结论；本次移除了整条旧依赖链。上述其他风险描述也以扫描返回公告为依据，不伪造利用复现。

## 3. 直接／传递、开发／生产与实际调用范围

原 20 项涉及的 7 个包全部是**传递依赖**，位于工作区的**开发依赖根链**中；并非项目直接声明的 API 生产依赖。这只是分类，不能作为安全结论。React 等其他前端包虽然也声明在 devDependencies，仍可能进入最终浏览器包，因此不能把这个分类推广到所有前端代码。

| 包／调用链 | 实际构建或运行作用与风险 |
|---|---|
| api-spec → **直接开发依赖 Orval** → TypeDoc → minimatch → brace-expansion | 原代码生成安装链中的工具；恶意 glob/brace 模式可栈溢出或 OOM。当前升级已移除 TypeDoc 链，不代表原库本身已修复 |
| api-spec → Orval → TypeDoc → markdown-it | 原工具链中不可信 Markdown 可触发二次复杂度；一项需要 typographer，另一项默认选项也受影响。仓库未把 PDF 当 Markdown 送入该链；升级后整条旧链移除 |
| api-spec → Orval → js-yaml | `pnpm --filter @workspace/api-spec run codegen` 真实解析仓库 OpenAPI；恶意 merge/omap YAML 可耗 CPU。规范当前是固定本地文件，仍不能忽略构建输入／供应链风险，因此升级 |
| api-spec → Orval → Scalar OpenAPI parser/validator → AJV → fast-uri | URI、schema 引用解析与验证。若将其用于不可信 URL／主机策略，解析差异可造成 SSRF/主机混淆；当前并非公开 PDF 的 URL 下载接口。保留该库但升级至 3.1.8 |
| 两个前端 → **直接开发依赖 plugin-react** → Babel → helper-compilation-targets → browserslist | 构建和开发时真实执行；不可信 stats 可导致原型写入／退出，大量不同查询可造成缓存内存增长。当前未开放自定义 stats HTTP 输入，但构建路径实际存在，已修复 |
| 两个前端 → **直接开发依赖 tailwindcss/vite** → tailwindcss/node → source-map-js | 开发预览和构建均处理 CSS/source map；恶意 section offset 可阻塞事件循环。不能因为是 devDependency 排除预览服务器风险，已更新旧副本 |
| mockup-sandbox → **直接开发依赖 fast-glob** → micromatch → braces | 开发服务启动／组件发现实际调用。`mockupPreviewPlugin.ts` 使用固定 `${MOCKUPS_DIR}/**/*.tsx` 与固定 ignore 模式，未发现来自公开 PDF／HTTP 参数的模式输入。深层 brace 模式仍是有效库漏洞；未做破坏性复现，继续待处理 |

实际安装树由 `pnpm -r list --depth Infinity --json` 和 `pnpm why` 核对，而非只读 package.json。修复后的 fast-uri 路径包括 Scalar openapi-parser 0.29.15 → validator/json-schema-validator 0.1.13 → AJV 8.20.0 → fast-uri 3.1.8。

## 4. 最小变更、兼容性与实际生成差异

修改前已在对话中说明升级范围和影响，未要求用户新增服务、运行库或密钥。

1. **Orval 8.22.0 → 8.44.0**：同 8.x，当前 Node 24.22.1 满足其 >=22.18.0 要求。更新 YAML/Scalar 链并移除旧 TypeDoc 依赖。没有为了消除告警升级 Zod 或 React Query 运行库。
2. **显式指定生成目标**：catalog 版本未被新版自动正确识别，首次 codegen 出现 Zod v4 API 与当前 v3 不兼容、Headers.entries 类型缺失，且提示 React Query 回退 v4。已修复为 query.version=5、zod.version=3，并仅为客户端 TS 添加 dom.iterable。随后 codegen 和全工作区 TS 均通过。
3. **Tailwind 4.3.2 → 4.3.3**：插件与 core 对齐同一补丁版；两个前端构建并重启，source-map-js 旧副本实际变为 1.2.2。
4. **两条限定父包的 override**：`@babel/helper-compilation-targets>browserslist: 4.28.7`、`ajv>fast-uri: 3.1.8`。React 插件已为当前最新 5.x（5.2.0），AJV 已为当前最新 8.20.0，升级直接父工具仍保留旧叶子。因此不跨主版本替换工具，限定叶子版本；已核对它们分别满足父包声明的 `^4.24.0`、`^3.0.1`。不是把 fast-uri 强升到 4.x，也没有抑制扫描规则。

生成差异不是“只有注释”：

- 标准 JSON 类型、字段名、路径、查询参数和 mutation key 保持兼容。
- `Headers`、键值对数组、普通对象均可合并请求头；新增测试验证 consent、PDF MIME、Blob body 不丢失。
- React Query v5 生成类型／重载、mutation 变量别名与 key helper 有增加；请求选项按 customFetch 参数类型推导。全工作区 TS 通过。
- 响应 `pages` 从 `zod.number()` 收紧为 `zod.number().int()`，符合原 OpenAPI 的 integer 定义。正常提取原本返回整数；新增测试验证整数接受、浮点／字符串拒绝。未改变请求档案字段或自动确认行为。
- 生成注释格式更新；OpenAPI 规范未改。没有手工篡改生成代码来让测试通过。

## 5. 当前仍待处理的 5 条告警

| 等级／公告 | 当前 → 修复版本 | 分类、实际风险与未处理理由 |
|---|---|---|
| 高危 GHSA-vfj7-8cjw-p6xm | braces 3.0.3 → 未知 | sandbox 传递开发依赖。注册表最新版仍为 3.0.3，扫描无修复版本；fast-glob 3.3.3、micromatch 4.0.8 也仍保留该链。固定模式限制了当前暴露，但不认定安全；不未经验证替换文件发现库或伪造本地修复 |
| 中危 GHSA-jggr-w7fw-pc2j | fast-copy 4.0.3 → 4.1.0 | API 的开发依赖 pino-pretty → fast-copy；当前开发日志确实会运行，生产配置不启用 pretty transport。深层对象复制可栈耗尽，当前请求日志只保留有限字段。明确有兼容候选，不声称无法升级；本轮集中处理原 20 高危，低优先级待后续验证修复 |
| 中危 GHSA-rj75-hqrm-r3gf | postcss-selector-parser 6.0.10 → 7.1.6 | 主前端开发依赖 tailwindcss/typography → parser。恶意平坦选择器可能耗 CPU；实际 CSS 构建路径存在，当前输入为可信仓库。跨主版本，需要 typography／样式回归，未擅自强制替换 |
| 中危 GHSA-87mf-gv2c-c62c | ts-deepmerge 7.0.3 → 8.0.0 | **历史扫描路径，已移除**：当时 API → runpod-sdk → xior → ts-deepmerge 为生产传递依赖，但 SDK 只用于未接线的离线 fixture 类型。本轮移除该 SDK 和 fixture 后重新安装锁文件；当前依赖路径需以最新扫描结果为准，不把旧扫描结果视为当前状态 |
| 低危 GHSA-g7r4-m6w7-qqqr | esbuild 0.27.3 → 0.28.1 | API 直接开发依赖，亦为 Vite、Orval、Drizzle/tsx 等传递依赖，现有共享 override 固定 0.27.3。此告警针对 Windows serve 模式；当前 Linux 用于打包，未发现应用调用其 serve API。跨 0.x minor 涉及共享工具链，暂保留，不声称包已修复 |

待处理不等于忽略。若内部交付要求零高危，本次仍不满足；若接受固定可信构建输入和已知剩余风险，可有条件内部交接，不能签署公网安全保证。

## 6. 实际验证证据

| 检查 | 结果 |
|---|---|
| Orval codegen + 公共库 TS | 初次暴露兼容错误，显式目标配置后通过 |
| `pnpm --filter @workspace/api-server run test:cv` | **41/41 通过**，含新增 4 项生成客户端／schema 回归 |
| `pnpm --filter @workspace/api-server run test:ocr` | **14/14 通过**；仅离线适配器 |
| `pnpm --filter @workspace/career-pathways test` | **33/33 通过** |
| 自动化合计 | **88 通过，0 失败／取消／跳过** |
| `pnpm run typecheck` | 公共库、API、主前端、sandbox、scripts 全部通过 |
| API 构建 | 通过 |
| 主前端构建：`PORT=5173 BASE_PATH=/ ... run build` | 通过；既有 tooltip.tsx source-map 警告仍在 |
| sandbox 构建：`PORT=5174 BASE_PATH=/ ... run build` | 通过 |
| 现有三个工作流重启及启动日志 | 均正常；未新增工作流或服务 |
| 浏览器 `profile-handoff.e2e.mjs` | **4 条旅程通过**：PDF／在线 × 应届／转行，包含确认隔离、编辑、匹配接收及刷新保持；4 次真实本地 API 上传、0 RunPod 请求、0 运行时异常，无伪造成功响应 |
| `/profile` 截图 | 页面正常显示 |

新增 4 项测试覆盖：查询字段／false 参数与 mutation key、三种 HeadersInit 与 Blob/consent、Zod v3 响应与整数约束、后端 415 不变成成功。mock 仅为显式协议测试夹具，不宣称真实 AI/OCR 成功。现有真实 PDF 和 30 秒上传防护测试也包含在 41 项中。

## 7. 修改文件与未执行事项

- `lib/api-spec/package.json`：Orval 版本下限。
- `pnpm-workspace.yaml`：Tailwind 下限与两条限定父包的安全叶子版本 override；其他平台排除配置保留。
- `pnpm-lock.yaml`：通过 pnpm 生成的实际解析变更。
- `lib/api-spec/orval.config.ts`：显式匹配已有运行库的生成目标。
- `lib/api-client-react/tsconfig.json`：添加 dom.iterable 类型库。
- `lib/api-client-react/src/generated/*`、`lib/api-zod/src/generated/*`：实际重新生成，差异见上文。
- `artifacts/api-server/tests/cv-generated-client.test.ts`：4 项新回归。
- 本报告及原安全交接报告的最新结果链接。

没有修改匹配／路线／SDG／情景算法或 PDF 防护业务源代码，没有升级运行时认证／数据库，也没有新增外部服务。未调用真实 RunPod/GLM，未读取或打印 API Key，未部署、推送或公开发布。平台预览访问保护、公网压力与代理级防护不在本次验证范围。
