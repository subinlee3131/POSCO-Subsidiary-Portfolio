import type { CompanyYear, CompanyView, RiskResult, ChangeEvent, EventKind, Filters } from '../types';
export const ratio = (n: number | null, d: number | null): number | null => n === null || d === null || d <= 0 ? null : n / d * 100;
/** 음수 기준금액도 방향을 보존하기 위해 |전기|를 분모로 사용. 전기가 0/미공시면 계산 불가. */
export const growth = (current: number | null, previous: number | null | undefined): number | null =>
 current === null || previous == null || previous === 0 ? null : (current - previous) / Math.abs(previous) * 100;
export const decreased30 = (current: number | null, previous: number | null | undefined) => (growth(current, previous) ?? Infinity) <= -30 + 1e-9;
export const ownershipChanged = (c: CompanyYear, p?: CompanyYear) => !!p && p.isConsolidated && (Math.abs(c.parentOwnership - p.parentOwnership) > 1e-6 || Math.abs(c.subsidiaryOwnership - p.subsidiaryOwnership) > 1e-6);
export const turnedLoss = (c: CompanyYear, p?: CompanyYear) => c.netIncome !== null && c.netIncome < 0 && p?.netIncome != null && p.netIncome > 0;
export function calculateRisk(c: CompanyYear, p?: CompanyYear): RiskResult {
 if (!c.isConsolidated) return {level: '정상', reasons: []};
 const danger: string[] = [], caution: string[] = [], monitor: string[] = [];
 if (c.equity !== null && c.equity < 0) danger.push('자본 음수');
 if (c.liabilities !== null && c.assets !== null && c.liabilities > c.assets) danger.push('부채가 자산을 초과');
 if ((ratio(c.liabilities, c.assets) ?? -Infinity) >= 90) caution.push('부채/자산 90% 이상');
 if (c.netIncome !== null && c.netIncome < 0) caution.push('당기순손실');
 if (decreased30(c.equity, p?.equity)) caution.push('전년 대비 자본 30% 이상 감소');
 if (turnedLoss(c,p)) caution.push('흑자에서 적자로 전환');
 if (decreased30(c.revenue, p?.revenue)) monitor.push('전년 대비 매출 30% 이상 감소');
 const incomplete = [c.assets,c.liabilities,c.equity,c.revenue,c.netIncome].some(v=>v===null);
 return {level: danger.length ? '위험' : caution.length ? '주의' : monitor.length ? '모니터링' : incomplete ? '판정 보류' : '정상', reasons: [...danger,...caution,...monitor,...(incomplete?['요약 재무정보 미공시 또는 일부 누락 — 확인된 항목에 한해 판단']:[])]};
}
export function buildViews(data: CompanyYear[], year: number): CompanyView[] {
 const previous = new Map(data.filter(c => c.year === year - 1 && c.isConsolidated).map(c => [c.companyId,c]));
 return data.filter(c => c.year === year && c.isConsolidated).map(current => {
  const p = previous.get(current.companyId);
  return {current,previous:p,risk:calculateRisk(current,p)};
 });
}
export const eventKinds: EventKind[] = ['신규편입','연결제외','지분율변경','적자전환','자본 30% 이상 감소','매출 30% 이상 감소','자본 음수','부채/자산 90% 이상'];
export function buildEvents(data: CompanyYear[], year: number): ChangeEvent[] {
 const views = buildViews(data,year);
 const events: ChangeEvent[] = [];
 for (const company of views) {
  const {current:c,previous:p,risk} = company;
  const add = (kind:EventKind, previous:number|null, current:number|null, unit:ChangeEvent['unit']='money', status:ChangeEvent['status']=risk.level) => events.push({kind,company,previous,current,unit,status});
  if(c.isNewlyConsolidated) add('신규편입',0,1,'status','편입');
  if(ownershipChanged(c,p)) add('지분율변경',p!.totalOwnership,c.totalOwnership,'percent','변경');
  if(turnedLoss(c,p)) add('적자전환',p!.netIncome,c.netIncome);
  if(c.netIncome !== null && c.netIncome < 0) add('당기순손실',p?.netIncome ?? null,c.netIncome);
  if(c.liabilities !== null && c.assets !== null && c.liabilities > c.assets) add('부채 초과',p?.liabilities != null && p.assets != null ? p.liabilities-p.assets : null,c.liabilities-c.assets);
  if(decreased30(c.equity,p?.equity)) add('자본 30% 이상 감소',p!.equity,c.equity);
  if(decreased30(c.revenue,p?.revenue)) add('매출 30% 이상 감소',p!.revenue,c.revenue);
  if(c.equity !== null && c.equity < 0) add('자본 음수',p?.equity ?? null,c.equity);
  if((ratio(c.liabilities,c.assets) ?? -Infinity) >= 90) add('부채/자산 90% 이상',p ? ratio(p.liabilities,p.assets) : null,ratio(c.liabilities,c.assets),'percent');
 }
 const currentMap = new Map(data.filter(c=>c.year===year).map(c=>[c.companyId,c]));
 for(const p of data.filter(c=>c.year===year-1 && c.isConsolidated)) {
  const c=currentMap.get(p.companyId);
  // 단순 자료 누락을 연결제외로 오인하지 않도록 명시적 제외 상태만 사용.
  if(c && !c.isConsolidated) events.push({kind:'연결제외',company:{current:c,previous:p,risk:calculateRisk(c,p)},previous:1,current:0,unit:'status',status:'제외'});
 }
 return events;
}
export const emptyFilters: Filters = {name:'',location:'',country:'',business:'',profit:'',risk:'',newly:'',ownership:''};
export function filterCompanies(views:CompanyView[], f:Filters):CompanyView[] {
 return views.filter(({current:c,previous:p,risk}) =>
 (!f.name || c.companyName.toLocaleLowerCase().includes(f.name.trim().toLocaleLowerCase())) &&
 (!f.location || c.domesticOverseas===f.location) && (!f.country || c.country===f.country) &&
 (!f.business || c.businessType===f.business) && (!f.risk || risk.level===f.risk) &&
 (!f.profit || (c.netIncome!==null && (f.profit==='흑자' ? c.netIncome>0 : f.profit==='적자' ? c.netIncome<0 : c.netIncome===0))) &&
 (!f.newly || c.isNewlyConsolidated===(f.newly==='예')) &&
 (!f.ownership || ownershipChanged(c,p)===(f.ownership==='예')));
}
export function groupCount(views:CompanyView[], key:'country'|'businessType') {
 const map = new Map<string,number>();
 views.forEach(v=>map.set(v.current[key],(map.get(v.current[key])??0)+1));
 return [...map].sort((a,b)=>b[1]-a[1]);
}

