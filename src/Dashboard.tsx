import { useMemo, useState } from 'react';
import { Building2, LayoutDashboard, Search, ShieldAlert, ChevronRight, Globe2, Factory, ArrowRight, CalendarDays, RotateCcw, Info, SlidersHorizontal, FolderSearch, CircleHelp } from 'lucide-react';
import type { CompanyView, Filters, EventKind, ChangeEvent } from './types';
import { availableYears } from './types';
import type { ReportData } from './types';
import SourcePanel from './components/SourcePanel';
import { buildViews, buildEvents, groupCount, emptyFilters, filterCompanies, eventKinds, ownershipChanged, decreased30, turnedLoss } from './lib/analytics';
import { money, percent, signed } from './lib/format';
import CompanyTable, { Badge } from './components/CompanyTable';
import DetailDrawer from './components/DetailDrawer';
type Page='overview'|'search'|'risk';
const nav=[{id:'overview' as const,label:'전체현황',icon:LayoutDashboard},{id:'search' as const,label:'종속기업 조회',icon:Search},{id:'risk' as const,label:'변동·Risk',icon:ShieldAlert}];
function EventValue({value,event}:{value:number|null;event:ChangeEvent}) {return <>{event.unit==='status'?(value?'연결':'미연결'):event.unit==='percent'?percent(value):money(value)}</>;}
export default function Dashboard({report,year,onYearChange}:{report:ReportData;year:number;onYearChange:(year:number)=>void}){
 const [page,setPage]=useState<Page>('overview');
 const data=report.records;
 const [selected,setSelected]=useState<CompanyView|null>(null);
 const [draft,setDraft]=useState<Filters>({...emptyFilters});
 const [applied,setApplied]=useState<Filters|null>(null);
 const [drill,setDrill]=useState<{label:string;test:(v:CompanyView)=>boolean}|null>(null);
 const [eventFilter,setEventFilter]=useState<EventKind|null>(null);
 const [rules,setRules]=useState(false);
 const views=useMemo(()=>buildViews(data,year),[data,year]);
 const previous=useMemo(()=>buildViews(data,year-1),[data,year]);
 const events=useMemo(()=>buildEvents(data,year),[data,year]);
 const countries=groupCount(views,'country'), businesses=groupCount(views,'businessType');
 const title=nav.find(n=>n.id===page)!.label;
 const count=(test:(v:CompanyView)=>boolean)=>views.filter(test).length;
 const summary=[
  {label:'전체 종속기업',value:views.length,sub:(previous.length?'전기 대비 '+signed(views.length-previous.length,'개'):'전기 비교자료 없음'),tone:''},
  {label:'국내 종속기업',value:count(v=>v.current.domesticOverseas==='국내'),sub:'대한민국 소재',tone:''},
  {label:'해외 종속기업',value:count(v=>v.current.domesticOverseas==='해외'),sub:(countries.length-1)+'개 국가',tone:''},
  {label:'당기순손실 기업',value:count(v=>(v.current.netIncome??0)<0),sub:'당기순이익 < 0',tone:'caution'},
  {label:'신규편입 기업',value:count(v=>v.current.isNewlyConsolidated===true),sub:'당기 연결범위 추가',tone:'info'},
  {label:'Risk 위험',value:count(v=>v.risk.level==='위험'),sub:'우선 검토 대상',tone:'danger'},
  {label:'Risk 주의',value:count(v=>v.risk.level==='주의'),sub:'재무현황 확인 필요',tone:'caution'},
 ];
 const signals:{label:string;test:(v:CompanyView)=>boolean;tone:string}[]=[
  {label:'적자기업',test:v=>(v.current.netIncome??0)<0,tone:'caution'},
  {label:'적자전환',test:v=>turnedLoss(v.current,v.previous),tone:'caution'},
  {label:'자본 음수',test:v=>(v.current.equity??0)<0,tone:'danger'},
  {label:'자본 30% 이상 감소',test:v=>decreased30(v.current.equity,v.previous?.equity),tone:'caution'},
  {label:'신규편입',test:v=>v.current.isNewlyConsolidated===true,tone:'info'},
  {label:'지분율 변동',test:v=>ownershipChanged(v.current,v.previous),tone:'info'},
 ];
 const selectDrill=(label:string,test:(v:CompanyView)=>boolean)=>setDrill({label,test});
 const navigate=(next:Page)=>{setPage(next);setDrill(null);if(next==='search'){setApplied(null);setDraft({...emptyFilters});}};
 const update=(key:keyof Filters,value:string)=>setDraft(f=>({...f,[key]:value,...(key==='location'?{country:''}:{})}));
 const filterOptions:{key:keyof Filters;label:string;options:string[]}[]=[
  {key:'location',label:'국내 / 해외',options:['국내','해외']},
  {key:'country',label:'국가',options:[...new Set(views.filter(v=>!draft.location||v.current.domesticOverseas===draft.location).map(v=>v.current.country))]},
  {key:'business',label:'업종',options:businesses.map(b=>b[0])},
  {key:'profit',label:'손익 구분',options:['흑자','적자','손익 0']},
  {key:'risk',label:'Risk 상태',options:['위험','주의','모니터링','정상','판정 보류']},
  {key:'newly',label:'신규편입 여부',options:['예','아니오']},
  {key:'ownership',label:'지분율 변동 여부',options:['예','아니오']},
 ];
 const filteredEvents=events.filter(e=>!eventFilter||e.kind===eventFilter);
 return <div className="app-shell">
  <aside className="sidebar"><div className="brand"><div className="brand-symbol"><Building2 size={24}/></div><div>POSCO<small>SUBSIDIARY MANAGEMENT</small></div></div><div className="workspace-label">주식회사 포스코 · 종속기업 관리</div><nav aria-label="주 메뉴">{nav.map(n=><button key={n.id} className={page===n.id?'nav-item active':'nav-item'} aria-current={page===n.id?'page':undefined} onClick={()=>navigate(n.id)}><n.icon size={19}/>{n.label}{page===n.id&&<ChevronRight size={15} className="ml-auto"/>}</button>)}</nav><div className="sidebar-foot"><div className="sample-label">OFFICIAL DISCLOSURE</div><p>포스코 연결감사보고서</p><small>내부 경영관리용</small></div></aside>
  <div className="main-shell"><header className="topbar"><div>종속기업 관리 <ChevronRight size={14}/> <strong>{title}</strong></div><span className="environment"><span/>공식 보고서 데이터</span></header>
  <main><div className="page-heading"><div><div className="eyebrow">SUBSIDIARY MANAGEMENT</div><h1>{title}</h1><p>{page==='overview'?'연결 대상 기업의 구성과 주요 재무 변화를 확인합니다.':page==='search'?'조건을 설정하고 필요한 종속기업을 조회합니다.':'연결범위 변화와 재무 이상징후를 함께 확인합니다.'}</p></div><div className="year-picker"><CalendarDays size={18}/><label>기준연도<select aria-label="기준연도" value={year} onChange={e=>{onYearChange(Number(e.target.value));setDraft({...emptyFilters});setSelected(null);setDrill(null);setApplied(null);setEventFilter(null);}}>{availableYears.map(y=><option key={y} value={y}>{y}년</option>)}</select></label><span>비교연도 <b>{year-1}년</b></span></div></div>
  <SourcePanel report={report}/>{page==='overview'&&<>
   <div className="summary-grid">{summary.map((s,i)=><section className={'summary-card '+(i===0?'primary-summary':'')} key={s.label}><span>{s.label}</span><div className={'summary-number '+s.tone}>{s.value}<small>개</small></div><p>{s.sub}</p></section>)}</div>
   <div className="classification-grid">
    <section className="panel"><div className="panel-heading"><h2><Globe2 size={19}/>지역별 현황</h2><span className="muted">{countries.length}개 국가</span></div><p className="panel-description">지역을 선택하여 소속 기업을 확인하세요.</p><div className="region-grid">{countries.map(([country,n])=><button key={country} className={'region-item '+(drill?.label===(country==='대한민국'?'국내':country)?'selected':'')} onClick={()=>selectDrill(country==='대한민국'?'국내':country,v=>v.current.country===country)}><span className="region-code"><Globe2 size={14}/></span><span>{country==='대한민국'?'국내':country}</span><strong>{n}<small>개</small></strong><ChevronRight size={14}/></button>)}</div><div className="panel-note"><Info size={14}/>보고서 소재지를 기준으로 국가별 집계</div></section>
    <section className="panel"><div className="panel-heading"><h2><Factory size={19}/>업종별 현황</h2><span className="muted">{businesses.length}개 업종</span></div><p className="panel-description">업종별 연결 대상 기업 구성</p><div className="industry-list">{businesses.map(([business,n])=><button key={business} className={'industry-item '+(drill?.label===business?'selected':'')} onClick={()=>selectDrill(business,v=>v.current.businessType===business)}><div><span>{business}</span><strong>{n}<small>개</small></strong></div><div className="bar-track"><span style={{width:n/views.length*100+'%'}}/></div></button>)}</div></section>
   </div>
   <section className="signals-section"><div className="section-title"><h2><ShieldAlert size={20}/>주요 변화 및 이상징후</h2><button className="text-button" onClick={()=>navigate('risk')}>변동·Risk 전체 보기 <ArrowRight size={15}/></button></div><div className="signals-grid">{signals.map(s=><button key={s.label} className={'signal-card '+(drill?.label===s.label?'selected':'')} onClick={()=>selectDrill(s.label,s.test)}><span className={'signal-mark '+s.tone}/><span>{s.label}</span><strong className={s.tone}>{count(s.test)}<small>개</small></strong><ChevronRight size={15}/></button>)}</div><p className="muted signals-note">한 기업이 여러 항목에 포함될 수 있습니다. 각 항목을 선택하면 해당 기업만 표시됩니다.</p></section>
   {drill&&<div className="drill-results"><div className="selection-line"><span>선택한 분류 <b>{drill.label}</b></span><button className="text-button" onClick={()=>setDrill(null)}>선택 해제</button></div><CompanyTable views={views.filter(drill.test)} onSelect={setSelected} title={drill.label+' 기업'}/></div>}
  </>}
  {page==='search'&&<>
   <section className="panel filter-panel"><div className="panel-heading"><h2><SlidersHorizontal size={18}/>조회조건</h2><span className="muted">여러 조건을 함께 적용할 수 있습니다.</span></div><form onSubmit={e=>{e.preventDefault();setApplied({...draft});}}><div className="filter-grid"><label>회사명<div className="input-icon"><Search size={16}/><input placeholder="회사명을 입력하세요" value={draft.name} onChange={e=>update('name',e.target.value)}/></div></label>{filterOptions.map(f=><label key={f.key}>{f.label}<select value={draft[f.key]} onChange={e=>update(f.key,e.target.value)}><option value="">전체</option>{f.options.map(o=><option key={o}>{o}</option>)}</select></label>)}</div><div className="filter-actions"><span>조회 범위: {year}년 연결 대상 기업</span><button type="button" className="secondary-button" onClick={()=>{setDraft({...emptyFilters});setApplied(null);}}><RotateCcw size={15}/>초기화</button><button className="primary-button" type="submit"><Search size={16}/>조회</button></div></form></section>
   {applied?<><div className="query-caption" role="status">{year}년 · {filterCompanies(views,applied).length}개 기업 조회{JSON.stringify(draft)!==JSON.stringify(applied)&&<span>조건이 변경되었습니다. 조회 버튼을 눌러 적용하세요.</span>}</div><CompanyTable views={filterCompanies(views,applied)} onSelect={setSelected}/></>:<section className="panel empty initial-empty"><div className="empty-icon"><FolderSearch size={30}/></div><h2>조회조건을 설정해 주세요.</h2><p>조건을 선택한 뒤 <strong>조회</strong> 버튼을 누르면 기업 목록이 표시됩니다.</p><span>조건 없이 조회하면 전체 연결 대상 기업을 확인할 수 있습니다.</span></section>}
  </>}
  {page==='risk'&&<>
   <div className="risk-cards">{eventKinds.map((kind,i)=><button key={kind} className={'risk-card '+(eventFilter===kind?'selected':'')} aria-pressed={eventFilter===kind} onClick={()=>setEventFilter(eventFilter===kind?null:kind)}><span>{kind}</span><strong className={i>=6?'danger':i>=3?'caution':'info'}>{events.filter(e=>e.kind===kind).length}<small>개</small></strong><ChevronRight size={15}/></button>)}</div>
   <div className="section-title event-heading"><h2>{eventFilter||'전체 변동 및 이상징후'} <span className="count">{filteredEvents.length}</span></h2><div className="flex items-center gap-4">{eventFilter&&<button className="text-button" onClick={()=>setEventFilter(null)}>전체 보기</button>}<button className="text-button" onClick={()=>setRules(!rules)} aria-expanded={rules}><CircleHelp size={16}/>Risk 판정 기준</button></div></div>
   {rules&&<div className="rules-panel"><p><Badge level="위험"/>자본 &lt; 0 또는 부채 &gt; 자산</p><p><Badge level="주의"/>부채/자산 ≥ 90%, 당기순손실, 자본 30% 이상 감소, 적자전환</p><p><Badge level="모니터링"/>매출 30% 이상 감소</p><p>여러 조건 충족 시 가장 높은 등급 적용 · 그 외 정상 · AI 미사용</p></div>}
   <section className="panel"><div className="table-toolbar"><span>기업별 복수 항목 표시 · {new Set(filteredEvents.map(e=>e.company.current.companyId)).size}개 기업</span><span>금액: 억원 · 비율: % · 비율 증감: %p</span></div><div className="table-scroll"><table className="event-table"><thead><tr>{['구분','회사명','국가','전기 '+(year-1),'당기 '+year,'증감','상태'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filteredEvents.map(e=><tr key={e.kind+e.company.current.companyId}><td><span className="event-kind" title={e.kind==="부채 초과"?"부채 − 자산 (억원)":undefined}>{e.kind}</span></td><td><button className="company-link" onClick={()=>setSelected(e.company)}>{e.company.current.companyName}</button></td><td>{e.company.current.country}</td><td className="numeric"><EventValue value={e.previous} event={e}/></td><td className="numeric"><EventValue value={e.current} event={e}/></td><td className={'numeric '+(e.current!==null&&e.previous!==null&&e.current<e.previous?'negative':'')}>{e.unit==='status'?'—':e.current===null||e.previous===null?'—':e.unit==='percent'?signed(e.current-e.previous,'%p'):(e.current-e.previous>0?'+':'')+money(e.current-e.previous)}</td><td><Badge level={e.status}/></td></tr>)}</tbody></table></div>{!filteredEvents.length&&<div className="empty"><ShieldAlert size={28}/><strong>해당 변동·이상징후가 없습니다.</strong></div>}<div className="table-foot">총 {filteredEvents.length}건 <span>재무 미공시 기업은 판정 보류 · 부채 초과 값은 부채−자산</span></div></section>
  </>}
  <footer className="page-footer"><span><Info size={14}/>포스코 공식 연결감사보고서 기준 · 출처와 비교기간을 확인해 주세요.</span><span>기준: {year}.12.31 · 연결재무정보</span></footer>
  </main></div>{selected&&<DetailDrawer view={selected} onClose={()=>setSelected(null)}/>}
 </div>;
}



