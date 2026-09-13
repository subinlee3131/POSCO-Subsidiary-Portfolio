import {describe,it,expect} from 'vitest';
import fy25 from '../../public/data/posco-2025.json';
import fy24 from '../../public/data/posco-2024.json';
import fy23 from '../../public/data/posco-2023.json';
import fy22 from '../../public/data/posco-2022.json';
import type {ReportData,CompanyYear} from '../types';
import {buildViews,buildEvents,calculateRisk,emptyFilters,filterCompanies,groupCount,ratio,growth,ownershipChanged} from './analytics';
const report=fy25 as unknown as ReportData;
const views=buildViews(report.records,2025);
const base:CompanyYear={...views[0].current,assets:100,liabilities:50,equity:50,revenue:100,netIncome:10};
describe('공식 보고서 데이터 검증',()=>{
 for(const [r,count,financial] of [[fy22,19,19],[fy23,32,31],[fy24,37,36],[fy25,41,40]] as const){
  it(r.year+'년 본문 기업수·재무 결합',()=>{expect(r.validation.masterCount).toBe(count);expect(r.validation.financialCount).toBe(financial);expect(r.validation.orphanFinancialCompanies).toEqual([]);expect(r.noExclusionsConfirmed).toBe(true);});
 }
 it('2025년 국내15·해외26 및 분류합계41',()=>{expect(views.filter(v=>v.current.domesticOverseas==='국내')).toHaveLength(15);expect(groupCount(views,'country').reduce((sum,[,n])=>sum+n,0)).toBe(41);expect(groupCount(views,'businessType').reduce((sum,[,n])=>sum+n,0)).toBe(41);});
 it('포스코스틸리온 실제 수치와 원 단위 변환',()=>{const c=views.find(v=>v.current.companyName.includes('스틸리온'))!;expect(c.current.assets).toBe(479864*1e6);expect(c.current.netIncome).toBe(14436*1e6);expect(c.previous!.assets).toBe(530860*1e6);});
 it('2025년 신규4·지분변동1·연결제외0',()=>{const e=buildEvents(report.records,2025);expect(e.filter(x=>x.kind==='신규편입')).toHaveLength(4);expect(e.filter(x=>x.kind==='지분율변경')).toHaveLength(1);expect(e.filter(x=>x.kind==='연결제외')).toHaveLength(0);});
 it('재무 미공시 기업도 연결대상에 포함하고 판정 보류',()=>{const c=views.find(v=>v.current.companyName.includes('SOCIAL'))!;expect(c.current.assets).toBeNull();expect(c.risk.level).toBe('판정 보류');});
 it('사명변경 Port Hedland 전기 연결, 신규/제외 오인 없음',()=>{const c=views.find(v=>v.current.companyName.startsWith('Port Hedland'))!;expect(c.previous?.assets).toBe(5773*1e6);expect(c.current.isNewlyConsolidated).toBe(false);});
 it('국가 + 위험 복합 조회',()=>{const found=filterCompanies(views,{...emptyFilters,country:'브라질',risk:'위험'});expect(found).toHaveLength(1);expect(found[0].current.companyName).toBe('POSCO BRAZIL LTDA');});
 it('없는 이름과 국가의 결과는 0',()=>expect(filterCompanies(views,{...emptyFilters,name:'한울',country:'대한민국'})).toHaveLength(0));
 it('2022년은 2021년 비교자료 없음',()=>expect(buildViews((fy22 as unknown as ReportData).records,2022).every(v=>!v.previous)).toBe(true));
 it('모든 실데이터 지분·재무 등식',()=>{for(const r of [fy22,fy23,fy24,fy25])for(const c of r.records){expect(Math.abs(c.parentOwnership+c.subsidiaryOwnership-c.totalOwnership)).toBeLessThan(.02);if(c.assets!==null)expect(Math.abs(c.assets-c.liabilities!-c.equity!)).toBeLessThanOrEqual(1e6);}});
});
describe('규칙 경계값 (테스트 내 수치 변형)',()=>{
 it('자본 음수는 위험',()=>expect(calculateRisk({...base,equity:-1}).level).toBe('위험'));
 it('부채 초과는 위험',()=>expect(calculateRisk({...base,liabilities:101}).level).toBe('위험'));
 it('부채90%는 주의, 미만은 정상',()=>{expect(calculateRisk({...base,liabilities:90}).level).toBe('주의');expect(calculateRisk({...base,liabilities:89.99}).level).toBe('정상');});
 it('적자전환과 순손실은 주의',()=>expect(calculateRisk({...base,netIncome:-1},base).level).toBe('주의'));
 it('자본30% 감소는 주의',()=>expect(calculateRisk({...base,equity:35},base).level).toBe('주의'));
 it('매출30% 감소는 모니터링',()=>expect(calculateRisk({...base,revenue:70},base).level).toBe('모니터링'));
 it('중복시 최고등급, 판정사유 보존',()=>{const r=calculateRisk({...base,liabilities:101,equity:-1,revenue:50,netIncome:-1},base);expect(r.level).toBe('위험');expect(r.reasons).toHaveLength(7);});
 it('누락항목이 있어도 확인된 위험을 낮추지 않음',()=>expect(calculateRisk({...base,equity:-1,revenue:null}).level).toBe('위험'));
 it('분모0/누락값은 계산불가',()=>{expect(ratio(10,0)).toBeNull();expect(ratio(null,10)).toBeNull();expect(growth(10,0)).toBeNull();expect(growth(null,10)).toBeNull();});
 it('음수전기 방향보존',()=>expect(growth(-150,-100)).toBe(-50));
 it('지분합 동일해도 보유주체 변경 감지',()=>expect(ownershipChanged({...base,parentOwnership:base.parentOwnership-1,subsidiaryOwnership:base.subsidiaryOwnership+1},base)).toBe(true));
 it('조회조건의 판정 보류 필터',()=>expect(filterCompanies(views,{...emptyFilters,risk:'판정 보류'})).toHaveLength(1));
});
