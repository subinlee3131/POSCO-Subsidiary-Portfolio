import { parseXml,findText,nodeText } from './xml-zip.mjs';
import { createHash } from 'node:crypto';
import { normalizeName, numberCell } from './normalize.mjs';

export function expandTable(table) {
 const trs=[];
 function rows(n){for(const c of n.children??[]){if(c.tag==='table')continue;if(c.tag==='tr')trs.push(c);else rows(c);}}
 rows(table);
 const grid=[];
 trs.forEach((tr,ri)=>{
  grid[ri]??=[];let ci=0;
  for(const cell of tr.children.filter(c=>['td','th','te'].includes(c.tag))){
   while(grid[ri][ci]!==undefined)ci++;
   const rs=Math.max(1,Number(cell.attrs.rowspan??1)),cs=Math.max(1,Number(cell.attrs.colspan??1));
   if(!Number.isInteger(rs)||!Number.isInteger(cs)||rs>100||cs>50)throw Error('표 병합 크기 오류');
   const value=nodeText(cell).replace(/\s+/g,' ').trim();
   for(let r=0;r<rs;r++){grid[ri+r]??=[];for(let c=0;c<cs;c++)grid[ri+r][ci+c]=value;}
   ci+=cs;
  }
 });
 return grid.filter(r=>r.length);
}
export function parseDartDocument(xml,year,meta={}) {
 if(/<!ENTITY/i.test(xml))throw Error('외부 엔터티가 있는 원문은 지원하지 않습니다.');
 const root=parseXml(xml);
 const issuer=findText(root,'company-name');
 if(issuer && normalizeName(issuer)!==normalizeName('주식회사 포스코'))throw Error('원문 발행법인이 주식회사 포스코와 다릅니다.');
 const plain=nodeText(root).replace(/\s+/g,'');
 if(!plain.includes('주식회사포스코')||!plain.includes(year+'년12월31일'))throw Error('원문의 법인명 또는 결산연도 검증 실패');
 const intro=plain.match(/(\d+)개국내법인.{0,180}?(\d+)개해외법인/);
 if(!intro)throw Error('공시된 국내·해외 기업수를 찾지 못했습니다. 원문 검토 필요');
 const raw={year,sourceUrl:meta.sourceUrl??'',sourceSha256:createHash('sha256').update(xml).digest('hex'),declaredDomestic:Number(intro[1]),declaredOverseas:Number(intro[2]),master:[],currentFinance:[],previousFinance:[],additions:[],exclusions:[],noExclusionsConfirmed:/제외된종속기업은없습니다/.test(plain)};
 let context='',mode='',location='국내',tableIndex=0;
 const isNumeric=s=>/^(?:\(?-?[\d,]+(?:\.\d+)?\)?|-)$/.test(String(s).replace(/\s/g,''));
 function walk(node){
  const tag=node.tag;
  if(tag==='table'){
   tableIndex++;
   const rows=expandTable(node);
   const head=rows.slice(0,4).flat().join('').replace(/\s/g,'');
   if(/관계기업|공동기업|비지배지분/.test(head))mode='';
   else if(head.includes('종속기업명')&&head.includes('업종')&&head.includes('지분율'))mode='master';
   else if(head.includes('종속기업명')&&head.includes('자산')&&head.includes('부채')&&head.includes('자본')){
    const period=[...context.slice(-2500).matchAll(/(?:제\s*\d+\s*\(\s*(당|전)\s*\)|([12])\)\s*제)/g)].at(-1);
    mode=period?.[1]==='전'||period?.[2]==='2'?'previousFinance':'currentFinance';
    if(!context.slice(-2500).replace(/\s/g,'').includes('백만원')&&!head.includes('백만원'))throw Error('요약 재무표 금액 단위 미확인');
   } else if(head.includes('편입일자')&&head.includes('사유'))mode='additions';
   else if(head.includes('제외일자'))mode='exclusions';
   for(const row of rows){
    const first=row[0]?.replace(/\s/g,'');
    if(first==='[국내]')location='국내';
    if(first==='[해외]')location='해외';
    if(mode==='master'&&[6,9].includes(row.length)&&row.slice(2,5).every(isNumeric)){
     raw.master.push({cells:row,page:null,tableIndex,domesticOverseas:location});
    } else if(['currentFinance','previousFinance'].includes(mode)&&row.length===6&&row.slice(1).every(isNumeric)){
     row.slice(1).forEach(n=>numberCell(n));raw[mode].push({cells:row,page:null,tableIndex});
    } else if(mode==='additions'&&row.length>=4&&new RegExp(year+'\\s*년').test(row[1]??'')){
     raw.additions.push({name:row[0],date:row[1],reason:row.at(-1),page:null});
    }
   }
   // Unknown exclusion layouts must not fabricate removal records.
   if(mode==='exclusions'&&!raw.noExclusionsConfirmed)throw Error('연결제외 표가 있는 보고서는 원문 대조 후 파서 확장이 필요합니다.');
   context+=nodeText(node)+'\n';
   return;
  }
  if(node.tag==='#text')context+=node.text+'\n';
  else for(const child of node.children??[])walk(child);
 }
 walk(root);
 if(!raw.master.length||!raw.currentFinance.length||(year>2022&&!raw.previousFinance.length))throw Error('종속기업 현황 또는 당기·전기 요약 재무정보 표 추출 실패');
 if(!raw.noExclusionsConfirmed)throw Error('연결제외 여부를 원문에서 확인하지 못했습니다. 검증 없이 반영하지 않습니다.');
 return raw;
}
