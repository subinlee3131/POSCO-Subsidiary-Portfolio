import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseXml,findAll,findText,readXmlZip } from './xml-zip.mjs';
import { normalizeName,assembleReport } from './normalize.mjs';
import { parseDartDocument } from './dart-parser.mjs';
export const API='https://opendart.fss.or.kr/api/';
export function selectPosco(corporations){
 const matches=corporations.filter(c=>normalizeName(c.corp_name)==='포스코'&&!String(c.stock_code??'').trim());
 if(matches.length!==1)throw Error('주식회사 포스코 법인 후보가 '+matches.length+'개입니다. 포스코홀딩스로 대체하지 않습니다.');
 if(!/^\d{8}$/.test(matches[0].corp_code))throw Error('법인코드 형식 오류');
 return matches[0];
}
export function selectFiling(filings,year,corpCode){
 const matches=filings.filter(f=>f.corp_code===corpCode&&/연결감사보고서/.test(f.report_nm)&&new RegExp('\\('+year+'\\.12\\)').test(f.report_nm));
 return matches.sort((a,b)=>b.rcept_no.localeCompare(a.rcept_no))[0]??null;
}
function unzipXml(bytes){
 if(bytes[0]!==0x50||bytes[1]!==0x4b){
  const message=new TextDecoder().decode(bytes).match(/<status>([^<]+)<\/status>/)?.[1];
  throw Error('OpenDART 원문 다운로드 실패'+(message?' (상태 '+message+')':''));
 }
 return readXmlZip(bytes);
}
export async function syncYear(year,{fetcher=fetch,root=process.cwd(),apiKey}={}){
 if(!Number.isInteger(year)||year<2021||year>new Date().getFullYear())throw Error('수집 연도 오류');
 if(year<2022)throw Error('해당 연도의 연결감사보고서를 찾을 수 없습니다.');
 if(!apiKey){
  try {process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw Error('.env 파일 읽기 실패');}
  apiKey=process.env.DART_API_KEY;
 }
 if(!apiKey||!apiKey.trim()||apiKey.includes('발급'))throw Error('DART_API_KEY가 없습니다. .env.example을 .env로 복사한 후 발급받은 키를 입력하세요.');
 if(!/^[a-zA-Z0-9]{40}$/.test(apiKey))throw Error('OpenDART API 키는 40자리 영문·숫자 값이어야 합니다.');
 const audit={year,startedAt:new Date().toISOString(),steps:[],status:'running'};
 const step=(name,detail)=>{audit.steps.push({name,status:'passed',detail});console.log('확인: '+name);};
 const req=async(endpoint,params={},binary=false)=>{
  const u=new URL(API+endpoint);u.search=new URLSearchParams({crtfc_key:apiKey,...params}).toString();
  let response;try{response=await fetcher(u,{signal:AbortSignal.timeout(30000),redirect:'error'});}catch{throw Error('OpenDART 연결 실패 또는 응답 시간 초과');}
  if(!response.ok)throw Error('OpenDART HTTP 오류 '+response.status);
  if(binary){const body=new Uint8Array(await response.arrayBuffer());if(body.length>50*1024*1024)throw Error('원문 파일 크기 제한 초과');return body;}
  const body=await response.json();if(body.status==='013')return {...body,list:[]};
  if(body.status!=='000')throw Error('OpenDART API 오류 '+String(body.status)+' (인증키·요청한도·서비스 상태를 확인하세요)');
  return body;
 };
 const auditDir=path.join(root,'data','audit');await mkdir(auditDir,{recursive:true});
 try{
  const codeZip=await req('corpCode.xml',{},true);
  const corpXml=unzipXml(codeZip).find(f=>/CORPCODE\.xml$/i.test(f.name));if(!corpXml)throw Error('CORPCODE.xml 없음');
  const corpus=parseXml(corpXml.xml);
  const corps=findAll(corpus,'list').map(el=>({corp_code:findText(el,'corp_code'),corp_name:findText(el,'corp_name'),stock_code:findText(el,'stock_code')}));
  const corp=selectPosco(corps);
  const overview=await req('company.json',{corp_code:corp.corp_code});
  if(normalizeName(overview.corp_name)!=='포스코'||!String(overview.est_dt).startsWith('2022')||String(overview.stock_code??'').trim())throw Error('현 주식회사 포스코(2022년 신설·비상장) 기업개황 확인 실패');
  step('POSCO corp_code',{...corp,established:overview.est_dt});
  const filings=[];let totalPages=1;
  for(let page=1;page<=totalPages;page++){
   const r=await req('list.json',{corp_code:corp.corp_code,bgn_de:(year+1)+'0101',end_de:new Date().toISOString().slice(0,10).replaceAll('-',''),pblntf_detail_ty:'F002',last_reprt_at:'Y',page_no:String(page),page_count:'100',sort:'date',sort_mth:'desc'});
   totalPages=Number(r.total_page??1);if(totalPages>50)throw Error('공시 검색 페이지 수 제한 초과');filings.push(...r.list);
  }
  const filing=selectFiling(filings,year,corp.corp_code);
  if(!filing)throw Error('해당 연도의 연결감사보고서를 찾을 수 없습니다.');
  if(!/^\d{14}$/.test(filing.rcept_no))throw Error('접수번호 형식 오류');
  step('연결감사보고서 검색',filing.report_nm);step('rcept_no',filing.rcept_no);
  const zip=await req('document.xml',{rcept_no:filing.rcept_no},true);
  const files=unzipXml(zip);
  await mkdir(path.join(root,'data/raw'),{recursive:true});
  await writeFile(path.join(root,'data/raw',filing.rcept_no+'.zip'),zip);
  step('공시 원문 다운로드',{files:files.map(f=>f.name),bytes:zip.length});
  const sourceUrl='https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+filing.rcept_no;
  const parsed=[];
  for(const file of files){try{parsed.push({file,raw:parseDartDocument(file.xml,year,{sourceUrl})});}catch{}}
  if(parsed.length!==1)throw Error('검증 가능한 연결감사보고서 XML 후보가 '+parsed.length+'개입니다. data/raw의 원문과 파서 구조를 확인하세요.');
  const {raw,file}=parsed[0];
  step('종속기업 현황 추출',{rows:raw.master.length});
  step('요약 재무정보 추출',{current:raw.currentFinance.length,previous:raw.previousFinance.length});
  const report=assembleReport(raw,{transport:'opendart',corpCode:corp.corp_code,rceptNo:filing.rcept_no,sourceDocument:file.name});
  step('이름 정규화 및 결합',report.validation);
  step('추출 데이터 미리보기',report.validation.preview.slice(0,5));
  const publicDir=path.join(root,'public/data');await mkdir(publicDir,{recursive:true});
  const dest=path.join(publicDir,'posco-'+year+'.json');
  await writeFile(dest+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(dest+'.tmp',dest);
  audit.status='success';await writeFile(path.join(auditDir,year+'.json'),JSON.stringify(audit,null,2));
  return report;
 }catch(error){
  audit.status='failed';audit.error=String(error.message).split(apiKey).join('[REDACTED]');
  await writeFile(path.join(auditDir,year+'.json'),JSON.stringify(audit,null,2));
  throw Error(audit.error);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const i=process.argv.indexOf('--year');const year=Number(i>=0?process.argv[i+1]:NaN);
 syncYear(year).then(r=>console.log('수집 완료: '+r.validation.masterCount+'개 종속기업, 화면을 새로고침하세요.')).catch(e=>{console.error(e.message);process.exitCode=1;});
}
