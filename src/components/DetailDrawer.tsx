import { useEffect, useRef } from 'react';
import { X, Building2, Info, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { CompanyView, FinancialKey } from '../types';
import { growth, ratio } from '../lib/analytics';
import { money, percent, signed } from '../lib/format';
import { Badge } from './CompanyTable';
export default function DetailDrawer({view,onClose}:{view:CompanyView;onClose:()=>void}) {
 const {current:c,previous:p,risk}=view;
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current!;const prior=document.activeElement as HTMLElement|null;el.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;prior?.focus();};},[]);
 const fields:[FinancialKey,string][]=[['assets','자산'],['liabilities','부채'],['equity','자본'],['revenue','매출'],['netIncome','당기순이익']];
 const metrics=[
  ['부채/자산',ratio(c.liabilities,c.assets),p?ratio(p.liabilities,p.assets):null],
  ['자기자본비율',ratio(c.equity,c.assets),p?ratio(p.equity,p.assets):null],
  ['순이익률',ratio(c.netIncome,c.revenue),p?ratio(p.netIncome,p.revenue):null],
 ] as const;
 return <dialog ref={dialog} className="drawer" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right)onClose();}}} aria-labelledby="detail-title">
 <header className="drawer-head"><span>종속기업 상세</span><button className="icon-button" aria-label="상세 닫기" onClick={onClose}><X size={21}/></button></header>
 <div className="drawer-body">
 <div className="detail-company"><div className="company-icon"><Building2 size={26}/></div><div><span className="eyebrow">{c.companyId} · {c.year}년</span><h2 id="detail-title">{c.companyName}</h2></div><Badge level={c.isConsolidated?risk.level:'제외'}/></div>
 <div className="detail-meta">{c.country}<span>·</span>{c.businessType}<span>·</span>{c.domesticOverseas}</div>
 <h3>지분 현황</h3><div className="ownership-grid">{[['지배기업 보유',c.parentOwnership,p?.parentOwnership],['종속기업 보유',c.subsidiaryOwnership,p?.subsidiaryOwnership],['총 지분율',c.totalOwnership,p?.totalOwnership]].map(([label,value,prev])=><div key={label as string}><span>{label}</span><strong>{percent(value as number)}</strong><small>전기 {percent(prev as number|undefined)}{prev!==undefined&&value!==prev?' · '+signed((value as number)-(prev as number),'%p'):''}</small></div>)}</div>
 <div className="section-title"><h3>재무현황 비교</h3><span className="muted">단위: 억원</span></div>
 {!c.isConsolidated&&<p className="notice">당기 연결제외 기업입니다. 당기 재무정보와 Risk는 산출하지 않습니다.</p>}
 {!p&&<p className="notice">전기 연결 재무자료가 없어 증감률을 산출하지 않습니다.</p>}
 {c.dataStatus==='not-disclosed'&&<p className="notice">연결 대상 기업이지만 요약 재무정보 표에는 포함되지 않습니다. 금액을 0으로 추정하지 않으며 Risk 판정을 보류합니다.</p>}
 {c.periodNote&&<p className="notice">{c.periodNote}</p>}
 {c.year===2023&&<p className="notice">당기 12개월 / 전기 10개월 보고기간 비교입니다. 편입 시점 차이도 고려해 주세요.</p>}
 <div className="table-scroll"><table className="detail-table"><thead><tr><th>항목</th><th>전기 {c.year-1}</th><th>당기 {c.year}</th><th>증감률</th></tr></thead><tbody>{fields.map(([key,label])=>{
 const g=growth(c[key],p?.[key]);return <tr key={key}><th>{label}</th><td>{money(p?.[key])}</td><td className={(c[key]??0)<0?'negative':''}>{money(c[key])}</td><td className={g!==null&&g<0?'negative':g!==null&&g>0?'positive':''}><span className="delta">{g!==null&&g!==0&&(g<0?<ArrowDownRight size={14}/>:<ArrowUpRight size={14}/>)}{signed(g)}</span></td></tr>;
 })}</tbody></table></div>
 <h3>주요 재무비율</h3><div className="ratio-grid">{metrics.map(([label,value,prev])=><div key={label}><span>{label}</span><strong>{percent(value)}</strong><small>전기 {percent(prev)}</small></div>)}</div>
 <div className="growth-strip"><span>매출증감률 <b>{signed(growth(c.revenue,p?.revenue))}</b></span><span>자산증감률 <b>{signed(growth(c.assets,p?.assets))}</b></span><span>자본증감률 <b>{signed(growth(c.equity,p?.equity))}</b></span></div>
 <h3>Risk 판정 근거</h3><div className="risk-reasons"><Info size={18}/><div>{!c.isConsolidated?<p>연결제외 · 판정 대상 아님</p>:risk.reasons.length?risk.reasons.map(r=><p key={r}>{r}</p>):<p>현재 적용된 Risk 조건이 없습니다.</p>}</div></div>
 <div className="method-note">증감률 = (당기 − 전기) ÷ |전기| × 100<br/>전기 0 또는 자료 없음: — · 비율의 분모가 0 이하인 경우: —<br/>증감 색상은 증가·감소 방향을 나타냅니다.<br/>출처: <a className="source-link" href={c.source.url+(c.source.masterPage?'#page='+c.source.masterPage:'')} target="_blank" rel="noreferrer">{c.source.label}</a> · 통화: KRW<br/>현황: {c.source.masterPage?'PDF '+c.source.masterPage+'쪽':'DART 원문 표'} · 재무: {c.source.financialPage?'PDF '+c.source.financialPage+'쪽':c.dataStatus==='reported'?'DART 원문 표':'미공시'}<br/>금액 원문 단위: 백만원 → 화면: 억원<br/>당기·전기는 {c.source.reportYear}년 보고서의 비교공시 기준입니다.</div>
 </div></dialog>;
}
