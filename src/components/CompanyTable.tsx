import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import type { CompanyView } from '../types';
import { ratio } from '../lib/analytics';
import { money, percent, riskClass } from '../lib/format';
export function Badge({level}:{level:string}) { return <span className={'badge '+riskClass(level)}>{level}</span>; }
type Column = {key:string; label:string; value:(v:CompanyView)=>string|number|null; format?:(n:number|null)=>string};
const cols:Column[] = [
 {key:'companyName',label:'종속기업명',value:v=>v.current.companyName},
 {key:'domesticOverseas',label:'국내/해외',value:v=>v.current.domesticOverseas},
 {key:'country',label:'국가',value:v=>v.current.country},
 {key:'businessType',label:'업종',value:v=>v.current.businessType},
 {key:'totalOwnership',label:'총 지분율',value:v=>v.current.totalOwnership,format:percent},
 ...(['assets','liabilities','equity','revenue','netIncome'] as const).map((key,i)=>({key,label:['자산','부채','자본','매출','당기순이익'][i],value:(v:CompanyView)=>v.current[key],format:money})),
 {key:'debtRatio',label:'부채/자산',value:v=>ratio(v.current.liabilities,v.current.assets),format:percent},
 {key:'equityRatio',label:'자기자본비율',value:v=>ratio(v.current.equity,v.current.assets),format:percent},
 {key:'margin',label:'순이익률',value:v=>ratio(v.current.netIncome,v.current.revenue),format:percent},
 {key:'risk',label:'Risk 상태',value:v=>v.risk.level},
];
export default function CompanyTable({views,onSelect,title='조회 결과'}:{views:CompanyView[];onSelect:(v:CompanyView)=>void;title?:string}) {
 const [sort,setSort]=useState({key:'companyName',direction:'asc'});
 const col=cols.find(c=>c.key===sort.key)!;
 const order=['판정 보류','정상','모니터링','주의','위험'];
 const sorted=[...views].sort((a,b)=>{
  let x=col.value(a),y=col.value(b);
  if(x===null) return y===null?0:1; if(y===null)return -1;
  if(sort.key==='risk'){x=order.indexOf(String(x));y=order.indexOf(String(y));}
  const cmp=typeof x==='number' && typeof y==='number'?x-y:String(x).localeCompare(String(y),'ko');
  return cmp*(sort.direction==='asc'?1:-1);
 });
 return <section className="panel results" aria-label={title}>
  <div className="panel-heading"><h2>{title} <span className="count">{views.length}</span></h2><span className="muted">금액: 억원 · 지분 및 비율: %</span></div>
  <div className="table-toolbar"><span>기업명을 선택하면 상세 재무정보를 확인할 수 있습니다.</span><label className="sort-label">정렬<select value={sort.key+':'+sort.direction} onChange={e=>{const [key,direction]=e.target.value.split(':');setSort({key,direction});}}><option value="companyName:asc">기업명 가나다순</option><option value="revenue:desc">매출 높은 순</option><option value="netIncome:asc">당기순이익 낮은 순</option><option value="equity:asc">자본 낮은 순</option><option value="debtRatio:desc">부채/자산 높은 순</option>{!['companyName:asc','revenue:desc','netIncome:asc','equity:asc','debtRatio:desc'].includes(sort.key+':'+sort.direction)&&<option value={sort.key+':'+sort.direction}>{col.label} {sort.direction==='asc'?'오름차순':'내림차순'}</option>}</select></label></div>
  {views.length===0?<div className="empty"><Search size={28}/><strong>조건에 맞는 기업이 없습니다.</strong><p>조회조건을 변경해 다시 조회해 주세요.</p></div>:
  <div className="table-scroll" tabIndex={0} aria-label="종속기업 결과 표, 가로 스크롤 가능"><table className="company-table"><thead><tr>{cols.map(c=><th key={c.key} aria-sort={sort.key===c.key?(sort.direction==='asc'?'ascending':'descending'):'none'}><button onClick={()=>setSort({key:c.key,direction:sort.key===c.key&&sort.direction==='asc'?'desc':'asc'})}>{c.label}{sort.key===c.key?(sort.direction==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>):<ArrowUpDown size={12}/>}</button></th>)}</tr></thead><tbody>{sorted.map(v=><tr key={v.current.companyId}>{cols.map(c=>{
   const value=c.value(v);
   return <td key={c.key} className={(c.format?'numeric ':'')+(typeof value==='number'&&value<0?'negative':'')}>{c.key==='companyName'?<button className="company-link" onClick={()=>onSelect(v)}>{String(value)}{v.current.isNewlyConsolidated&&<span className="new-tag">신규</span>}</button>:c.key==='risk'?<Badge level={v.risk.level}/>:c.format?c.format(value as number|null):value}</td>;
  })}</tr>)}</tbody></table></div>}
  <div className="table-foot">총 {views.length}개 기업 <span>— : 자료 없음 또는 산출 불가</span></div>
 </section>;
}
