import { useEffect, useState } from 'react';
import { Building2, FileSearch, RefreshCw } from 'lucide-react';
import Dashboard from './Dashboard';
import { availableYears } from './types';
import type { ReportData } from './types';
export default function App(){
 const [year,setYear]=useState(2025);
 const [reload,setReload]=useState(0);
 const [state,setState]=useState<{year:number;report:ReportData|null;loading:boolean;error:string}>({year:2025,report:null,loading:true,error:''});
 useEffect(()=>{
  const abort=new AbortController();
  setState({year,report:null,loading:true,error:''});
  if(year===2021){setState({year,report:null,loading:false,error:'해당 연도의 연결감사보고서를 찾을 수 없습니다.'});return()=>abort.abort();}
  fetch(import.meta.env.BASE_URL+'data/posco-'+year+'.json',{signal:abort.signal,cache:'no-cache'})
   .then(async r=>{if(r.status===404)throw Error('해당 연도의 연결감사보고서를 찾을 수 없습니다.');if(!r.ok)throw Error('보고서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');return r.json();})
   .then((report:ReportData)=>{
    if(report.schemaVersion!==1||report.year!==year||report.entity?.name!=='주식회사 포스코'||!Array.isArray(report.records)||report.records.some(c=>c.source?.type!=='report'))throw Error('보고서 데이터 형식을 확인해 주세요. 임의 데이터로 대체하지 않습니다.');
    if(!abort.signal.aborted)setState({year,report,loading:false,error:''});
   }).catch((error:Error)=>{if(!abort.signal.aborted)setState({year,report:null,loading:false,error:error.message});});
  return()=>abort.abort();
 },[year,reload]);
 if(state.report&&state.year===year)return <Dashboard key={year} report={state.report} year={year} onYearChange={setYear}/>;
 return <div className="report-state-shell"><header><Building2/><strong>POSCO 종속기업 관리</strong><span>주식회사 포스코</span></header><main><div className="page-heading"><div><h1>연결감사보고서 조회</h1><p>선택한 연도의 실제 공시자료를 불러옵니다.</p></div><label className="year-picker">기준연도<select aria-label="기준연도" value={year} onChange={e=>setYear(Number(e.target.value))}>{availableYears.map(y=><option value={y} key={y}>{y}년</option>)}</select></label></div><section className="panel empty" role={state.loading||state.year!==year?'status':'alert'}><FileSearch size={38}/><h2>{state.loading||state.year!==year?'보고서를 불러오고 있습니다.':state.error}</h2><p>{year===2021?'현 주식회사 포스코는 2022년 3월 1일 신설되었습니다. 2021년 포스코홀딩스 자료를 대신 표시하지 않습니다.':'수집된 보고서 자료만 사용하며, 가상 기업이나 임의 수치로 대체하지 않습니다.'}</p>{!state.loading&&year!==2021&&<button className="secondary-button" onClick={()=>setReload(v=>v+1)}><RefreshCw size={16}/>다시 시도</button>}</section></main></div>;
}
