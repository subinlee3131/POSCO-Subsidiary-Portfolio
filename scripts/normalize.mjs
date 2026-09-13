import { createHash } from 'node:crypto';
export const cleanName = value => String(value ?? '').normalize('NFKC').replace(/\(주\s*\d+(?:\s*[,，]\s*\d+)*\)/g,'').replace(/\(구\s*[,，].*?\)/g,'').replace(/\s+/g,' ').trim();
const basicKey = value => cleanName(value).replace(/주식회사|\(주\)/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const alias = new Map([[basicKey('Port Hedland Green Steel Pty Ltd'),basicKey('Port Hedland Iron Pty Ltd')]]);
export const normalizeName = value => alias.get(basicKey(value)) ?? basicKey(value);
export const nameAliasEvidence = [{from:'Port Hedland Green Steel Pty Ltd',to:'Port Hedland Iron Pty Ltd',source:'https://www.nzea.gov.au/port-hedland-iron-project'}];
export function numberCell(raw,{dashZero=true}={}) {
 const s=String(raw??'').replace(/[\s,%₩]/g,'');
 if(!s || s==='—' || s==='N/A') return null;
 if(s==='-') return dashZero?0:null;
 if(!/^(?:-?\d+(?:\.\d+)?|\(\d+(?:\.\d+)?\))$/.test(s)) throw new Error('숫자 셀 형식 확인 필요: '+raw);
 return s.startsWith('(')?-Number(s.slice(1,-1)):Number(s);
}
function indexUnique(rows,label) {
 const map=new Map();
 for(const row of rows){const key=normalizeName(row.cells[0]);if(!key || map.has(key))throw Error(label+' 이름 중복: '+row.cells[0]);map.set(key,row);}
 return map;
}
export function assembleReport(raw, {transport='posco-official-pdf',corpCode=null,rceptNo=null,sourceDocument=null}={}) {
 const {year}=raw;
 if(!Number.isInteger(year)||year<2022||year>2099)throw Error('주식회사 포스코 대상 연도 오류');
 const masters=indexUnique(raw.master,'종속기업 현황'), current=indexUnique(raw.currentFinance,'당기 재무'), previous=indexUnique(raw.previousFinance,'전기 재무');
 const orphan=[...current,...previous].filter(([key])=>!masters.has(key)).map(([,r])=>r.cells[0]);
 if(orphan.length)throw Error('재무표 미매칭: '+[...new Set(orphan)].join(', '));
 const additions=new Map((raw.additions??[]).map(a=>[normalizeName(a.name),a]));
 const warnings=[],records=[],preview=[];
 const source={type:'report',provider:transport,label:year+'년 주식회사 포스코 연결감사보고서',currency:'KRW',originalUnit:'백만원',url:raw.sourceUrl,sha256:raw.sourceSha256,reportYear:year,corpCode,rceptNo,sourceDocument};
 for(const [key,master] of masters){
  const r=master.cells;
  if(![6,9].includes(r.length))throw Error('지분표 열 수 확인 필요');
  const now=r.slice(2,5).map(v=>numberCell(v));
  const before=r.length===9?r.slice(5,8).map(v=>numberCell(v)):null;
  const country=master.domesticOverseas==='국내'?'대한민국':r.at(-1)==='터키'?'튀르키예':r.at(-1);
  for(const [index,ownership,financial] of [[0,now,current.get(key)],[1,before,previous.get(key)]]){
   if(!ownership)continue;
   const consolidated=(ownership[2]??0)>0;
   if(index===1&&!consolidated)continue;
   const dataYear=year-index;
   if(ownership.some(x=>x===null||x<0||x>100)||Math.abs(ownership[0]+ownership[1]-ownership[2])>.02)throw Error('지분 합계 오류: '+r[0]);
   const values=financial?financial.cells.slice(1).map(v=>numberCell(v)):Array(5).fill(null);
   if(values.length!==5)throw Error('재무표 열 수 오류: '+r[0]);
   if(values.slice(0,3).every(v=>v!==null)&&Math.abs(values[0]-values[1]-values[2])>1)throw Error('자산=부채+자본 검증 실패: '+r[0]);
   const added=index===0?(additions.has(key)||(!!before&&before[2]===0)):null;
   const note=added?'신규편입 기업의 매출·손익은 편입일 이후 금액입니다.':(dataYear===2022?'2022년은 포스코 설립 이후 10개월 보고기간이며 일부 기업은 편입일 이후 손익입니다.':'');
   const record={
    companyId:'POSCO-'+createHash('sha256').update(key).digest('hex').slice(0,14),
    companyName:cleanName(r[0]),normalizedName:key,year:dataYear,domesticOverseas:master.domesticOverseas,
    country,businessType:r[1],parentOwnership:ownership[0],subsidiaryOwnership:ownership[1],totalOwnership:ownership[2],
    assets:values[0]===null?null:values[0]*1e6,liabilities:values[1]===null?null:values[1]*1e6,equity:values[2]===null?null:values[2]*1e6,revenue:values[3]===null?null:values[3]*1e6,netIncome:values[4]===null?null:values[4]*1e6,
    isConsolidated:consolidated,isNewlyConsolidated:added,
    dataStatus:financial?'reported':'not-disclosed',periodNote:note,
    entryDate:index===0?additions.get(key)?.date??null:null,
    source:{...source,masterPage:master.page,financialPage:financial?.page??null,financialName:financial?.cells[0]??null}
   };
   records.push(record);
   if(index===0)preview.push({companyName:record.companyName,matched:!!financial,masterPage:master.page,financialPage:financial?.page??null,assetsMillion:values[0]});
  }
 }
 const active=records.filter(r=>r.year===year&&r.isConsolidated);
 const domestic=active.filter(r=>r.domesticOverseas==='국내').length;
 const overseas=active.length-domestic;
 if(domestic!==raw.declaredDomestic||overseas!==raw.declaredOverseas)throw Error('본문 공시 기업수와 추출 결과 불일치');
 const missing=active.filter(r=>r.dataStatus==='not-disclosed').map(r=>r.companyName);
 if(missing.length)warnings.push('요약 재무정보 미공시 '+missing.length+'개: '+missing.join(', '));
 if(!raw.noExclusionsConfirmed)warnings.push('연결제외 주석의 별도 확인이 필요합니다.');
 if(year===2023)warnings.push('2023년 12개월과 전기 2022년 10개월의 손익 비교입니다. 신규편입 영향에도 유의하세요.');
 if(year===2022)warnings.push('현 주식회사 포스코는 2022년 3월 1일 설립되어 2021년 비교자료가 없습니다.');
 const validation={declaredDomestic:raw.declaredDomestic,declaredOverseas:raw.declaredOverseas,masterCount:active.length,financialCount:active.length-missing.length,missingFinancialCompanies:missing,orphanFinancialCompanies:[],duplicateNames:[],equationChecked:true,ownershipChecked:true,preview,nameAliases:nameAliasEvidence};
 return {schemaVersion:1,entity:{name:'주식회사 포스코',established:'2022-03-01',corpCode,rceptNo},year,source,comparisonBasis:'선택한 연도 보고서에 공시된 당기·전기 금액',noExclusionsConfirmed:raw.noExclusionsConfirmed,warnings,validation,records};
}
