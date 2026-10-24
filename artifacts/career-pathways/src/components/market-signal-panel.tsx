/**
 * 数据来源与更新时间面板（自包含组件，不依赖项目其它模块）
 *
 * 目的：满足比赛 Domain 1「AI 趋势信号层」要求
 *   1) 至少一个「可更新」的数据源（这里用 World Bank 开放数据 API，浏览器可直接访问）
 *   2) 页面上展示数据来源 + 日期
 *   3) 实时源失败时有兜底，页面不白屏
 *
 * 用法：把文件放到 artifacts/career-pathways/src/components/market-signal-panel.tsx
 *      然后在 /skills 页面顶部渲染 <MarketSignalPanel />
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

type Status = 'loading' | 'success' | 'error';

const WB_URL =
  'https://api.worldbank.org/v2/country/WLD/indicator/SL.UEM.TOTL.ZS?format=json&per_page=10';
const WB_PAGE = 'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS';
const ONET_URL = 'https://www.onetonline.org';
const ONET_LABEL = 'O*NET 31.0 Database — USDOL/ETA';
const ONET_RELEASE = '2026-08-25';
const ONET_CHECKED = '2026-10-24';

const isZh = () =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh');

const zh = {
  title: '数据来源与更新时间',
  subtitle: '实时公开数据源与静态导入数据集分别标注，可点击查看原始来源。',
  live: '实时数据源 · World Bank 开放数据',
  metric: '指标：全球失业率（占劳动力百分比）',
  latest: '最新观测年份',
  value: '数值',
  retrieved: '最近检索',
  refresh: '刷新',
  refreshing: '刷新中…',
  sourceLink: '打开原始来源',
  fallback: '实时数据源暂时不可用，显示静态快照说明。',
  static: '静态数据集',
  staticNote: '仓库存量数据（可由导入脚本重新生成）',
  release: '版本发布',
  checked: '来源核查',
  disclaimer:
    '实时指标仅作宏观背景参考，不衡量也不代表职位增长；匹配分数不来自这些指标。',
  examples: '合成示例数据',
  examplesNote: '团队编写，仅用于演示与测试，不代表真实市场',
};

const en = {
  title: 'Data sources & freshness',
  subtitle: 'Live public sources and statically imported datasets are labelled separately.',
  live: 'Live source · World Bank Open Data',
  metric: 'Indicator: global unemployment (% of labour force)',
  latest: 'Latest observation year',
  value: 'Value',
  retrieved: 'Retrieved at',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  sourceLink: 'Open original source',
  fallback: 'Live source is temporarily unavailable; showing cached snapshot notes.',
  static: 'Static dataset',
  staticNote: 'Bundled snapshot (regenerable with the import script)',
  release: 'Release',
  checked: 'Source checked',
  disclaimer:
    'Live indicators provide macro context only; they do not measure or imply job growth, and match scores do not derive from them.',
  examples: 'Synthetic examples',
  examplesNote: 'Team-authored, for demo/testing only — not real market data',
};

export default function MarketSignalPanel() {
  const t = isZh() ? zh : en;
  const [status, setStatus] = useState<Status>('loading');
  const [latest, setLatest] = useState<{ year: string; value: string } | null>(null);
  const [retrievedAt, setRetrievedAt] = useState<string>('');

  const load = useCallback(async () => {
    setStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(WB_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const payload = await response.json();
      const rows: Array<{ date?: string; value?: number | null }> = Array.isArray(payload?.[1])
        ? payload[1]
        : [];
      const usable = rows
        .filter((row) => row && row.value !== null && row.value !== undefined)
        .sort((a, b) => Number(b.date) - Number(a.date));
      if (!usable.length) throw new Error('no data');
      setLatest({ year: String(usable[0].date), value: String(usable[0].value) });
      setRetrievedAt(new Date().toLocaleString());
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const box: CSSProperties = {
    border: '1px solid #e3e6ea',
    borderRadius: 12,
    padding: '14px 16px',
    margin: '0 0 16px',
    background: '#fff',
    fontSize: 13,
    lineHeight: 1.6,
  };
  const row: CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' };
  const label: CSSProperties = { color: '#6b7280', minWidth: 96 };
  const tag: CSSProperties = {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 999,
    fontSize: 11,
    background: '#eef2f7',
    color: '#44506b',
    marginLeft: 6,
  };
  const button: CSSProperties = {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
    padding: '3px 10px',
    fontSize: 12,
    cursor: 'pointer',
  };
  const link: CSSProperties = { color: '#1f4e79' };

  return (
    <section style={box} aria-label={t.title} data-testid="market-signal-panel">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t.title}</h3>
      <p style={{ margin: '0 0 10px', color: '#6b7280' }}>{t.subtitle}</p>

      {/* 实时源 */}
      <div style={{ ...row, marginBottom: 6 }}>
        <strong>{t.live}</strong>
        <span style={tag}>live · {status}</span>
        <a href={WB_PAGE} target="_blank" rel="noreferrer" style={link}>
          {t.sourceLink}
        </a>
        <button type="button" style={button} onClick={() => void load()} disabled={status === 'loading'}>
          {status === 'loading' ? t.refreshing : t.refresh}
        </button>
      </div>
      <div style={row}>
        <span style={label}>{t.metric}</span>
      </div>
      {status === 'success' && latest && (
        <div style={row}>
          <span style={label}>{t.latest}</span>
          <span>{latest.year}</span>
          <span style={label}>{t.value}</span>
          <span>{latest.value}%</span>
          <span style={label}>{t.retrieved}</span>
          <span>{retrievedAt}</span>
        </div>
      )}
      {status === 'error' && <div style={{ color: '#b45309' }}>{t.fallback}</div>}

      {/* 静态数据集 */}
      <div style={{ ...row, marginTop: 10 }}>
        <strong>{t.static}</strong>
        <span style={tag}>{ONET_LABEL}</span>
        <a href={ONET_URL} target="_blank" rel="noreferrer" style={link}>
          {t.sourceLink}
        </a>
      </div>
      <div style={row}>
        <span style={label}>{t.release}</span>
        <span>{ONET_RELEASE}</span>
        <span style={label}>{t.checked}</span>
        <span>{ONET_CHECKED}</span>
        <span style={{ color: '#6b7280' }}>{t.staticNote}</span>
      </div>

      {/* 合成示例 */}
      <div style={{ ...row, marginTop: 6, color: '#6b7280' }}>
        <strong>{t.examples}</strong>
        <span>{t.examplesNote}</span>
      </div>

      <p style={{ margin: '10px 0 0', color: '#6b7280', fontSize: 12 }}>{t.disclaimer}</p>
    </section>
  );
}
