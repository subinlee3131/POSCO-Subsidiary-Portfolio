import { ExternalLink, FileCheck2, Info } from 'lucide-react';
import type { ReportData } from '../types';
export default function SourcePanel({report}:{report:ReportData}){
 const {validation:v,source:s}=report;
 return <section className="source-panel">
 <div className="source-summary"><FileCheck2 size={19}/><div><strong>{s.label}</strong><span>{s.provider==='opendart'?'OpenDART 수집본':'포스코 공식 홈페이지 PDF 추출본 · OpenDART 미연결'}</span></div><a href={s.url} target="_blank" rel="noreferrer">원문 보기 <ExternalLink size={14}/></a></div>
 <div className="source-coverage"><span>연결 대상 <b>{v.masterCount}개</b></span><span>재무정보 확인 <b>{v.financialCount}개</b></span><span>재무 미공시 <b>{v.missingFinancialCompanies.length}개</b></span><span>{report.comparisonBasis}</span></div>
 {report.warnings.map(w=><p className="source-warning" key={w}><Info size={14}/>{w}</p>)}
 <details><summary>출처 및 추출 검증 확인</summary><div className="source-details"><p>대상 법인: {report.entity.name} (2022.03.01 신설)</p><p>OpenDART 법인코드: {s.corpCode||'API 키 등록 후 공식 고유번호 목록에서 확인'}</p><p>접수번호: {s.rceptNo||'공식 PDF 추출본에는 미설정 · OpenDART 수집 시 기록'}</p><p>검증: 본문 공시 기업수 일치 · 중복 이름 없음 · 재무표 미매칭 없음 · 지분 합계 및 재무등식 확인</p><p>원본에 ‘-’로 공시된 금액은 0, 요약 재무표에 없는 기업은 자료 없음으로 구분합니다. 표는 연결조정 전 요약 재무정보이며 합계가 그룹 연결재무제표 총액과 일치하는 자료가 아닙니다.</p><p>OpenDART 키 발급 후 프로젝트의 .env에 DART_API_KEY를 설정하고 npm run dart:sync -- --year {report.year} 명령으로 수집합니다. API 키는 브라우저에 전달되지 않습니다.</p><div className="table-scroll"><table className="source-table"><thead><tr><th>종속기업</th><th>현황 PDF 페이지</th><th>재무 PDF 페이지</th><th>결합 결과</th></tr></thead><tbody>{v.preview.map(p=><tr key={p.companyName}><td>{p.companyName}</td><td>{p.masterPage??'원문 표'}</td><td>{p.financialPage??'—'}</td><td>{p.matched?'확인':'재무 미공시'}</td></tr>)}</tbody></table></div></div></details>
 </section>;
}
