import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeName,numberCell,assembleReport} from './normalize.mjs';
import {parseXml,nodeText,readXmlZip} from './xml-zip.mjs';
import {parseDartDocument,expandTable} from './dart-parser.mjs';
import {selectPosco,selectFiling,syncYear} from './dart-sync.mjs';
const raw=JSON.parse(await readFile(new URL('../data/source-tables/2025.json',import.meta.url),'utf8'));
const enc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const table=rows=>'<TABLE>'+rows.map(r=>'<TR>'+r.map(c=>'<TD>'+enc(c)+'</TD>').join('')+'</TR>').join('')+'</TABLE>';
// Actual report cells in a constructed XML envelope. This tests formats, not a live OpenDART response.
const xml='<DOCUMENT><COMPANY-NAME>포스코</COMPANY-NAME><P>주식회사 포스코와 그 종속기업 2025년 12월 31일 15개 국내법인과 26개 해외법인</P>'+
table([['종속기업명','업종','지분율(%)','','','','','',''],['[국내]'],...raw.master.filter(r=>r.domesticOverseas==='국내').map(r=>r.cells),['[해외]'],...raw.master.filter(r=>r.domesticOverseas==='해외').map(r=>r.cells)])+
'<P>주요 종속기업 요약 재무정보 1) 제 4(당) 기 (단위: 백만원)</P>'+
table([['종속기업명','자산','부채','자본','매출액','당기손익'],...raw.currentFinance.map(r=>r.cells)])+
'<P>2) 제 3(전) 기 (단위: 백만원)</P>'+
table([['종속기업명','자산','부채','자본','매출액','당기손익'],...raw.previousFinance.map(r=>r.cells)])+
'<P>당기 중 연결재무제표 작성대상에서 제외된 종속기업은 없습니다.</P></DOCUMENT>';
test('한글 법인표기·공백·각주 정규화',()=>assert.equal(normalizeName('㈜포스코 피에스 테크(주4)'),normalizeName('주식회사 포스코피에스테크')));
test('외국회사 괄호지명 보존, 검증된 사명변경 별칭',()=>{assert.notEqual(normalizeName('POSCO(Thailand)'),normalizeName('POSCO(China)'));assert.equal(normalizeName('Port Hedland Green Steel Pty Ltd'),normalizeName('Port Hedland Iron Pty Ltd'));});
test('괄호음수·원문대시·빈값 구분',()=>{assert.equal(numberCell('(5,642)'),-5642);assert.equal(numberCell('-'),0);assert.equal(numberCell(''),null);assert.throws(()=>numberCell('잘못된 값'));});
test('XML 엔터티와 CDATA, > 포함 속성',()=>assert.equal(nodeText(parseXml('<P a="x>y">A &amp; B<![CDATA[<C>]]></P>')),'A & B<C>'));
test('불완전 XML 거부',()=>{assert.throws(()=>parseXml('<A><B></A>'));assert.throws(()=>parseXml('<!ENTITY x SYSTEM "file"><P/>'));});
test('rowspan/colspan 표 확장',()=>{const root=parseXml('<TABLE><TR><TD ROWSPAN="2">A</TD><TD COLSPAN="2">B</TD></TR><TR><TD>C</TD><TD>D</TD></TR></TABLE>');assert.deepEqual(expandTable(root.children[0]),[['A','B','B'],['A','C','D']]);});
test('실제 표 셀의 XML 형식 왕복 파싱',()=>{const parsed=parseDartDocument(xml,2025);const result=assembleReport(parsed);assert.equal(result.validation.masterCount,41);assert.equal(result.validation.financialCount,40);assert.equal(result.records.find(r=>r.year===2025&&r.companyName.includes('스틸리온')).assets,479864e6);});
test('홀딩스 원문과 연도 불일치 거부',()=>{assert.throws(()=>parseDartDocument(xml.replace('<COMPANY-NAME>포스코','<COMPANY-NAME>포스코홀딩스'),2025));assert.throws(()=>parseDartDocument(xml,2024));});
test('본문공시 기업수 불일치 거부',()=>assert.throws(()=>assembleReport({...raw,declaredDomestic:99})));
test('재무표 중복·미매칭 거부',()=>{assert.throws(()=>assembleReport({...raw,currentFinance:[...raw.currentFinance,raw.currentFinance[0]]}));assert.throws(()=>assembleReport({...raw,currentFinance:[...raw.currentFinance,{cells:['미확인 회사','1','1','0','0','0']}]}));});
test('법인코드 후보에서 홀딩스 제외',()=>{const c=selectPosco([{corp_name:'포스코홀딩스',stock_code:'005490',corp_code:'00000001'},{corp_name:'포스코',stock_code:'',corp_code:'00000002'}]);assert.equal(c.corp_code,'00000002');assert.throws(()=>selectPosco([]));});
test('연간 연결감사보고서의 최신 정정본 선택',()=>{const f=selectFiling([{corp_code:'00000002',report_nm:'연결감사보고서 (2025.12)',rcept_no:'20260301000001'},{corp_code:'00000002',report_nm:'[정정]연결감사보고서 (2025.12)',rcept_no:'20260401000001'},{corp_code:'00000002',report_nm:'감사보고서 (2025.12)',rcept_no:'20260501000001'}],2025,'00000002');assert.equal(f.rcept_no,'20260401000001');});
test('키 미설정/형식오류 시 네트워크 호출 없음',async()=>{let called=false;await assert.rejects(syncYear(2025,{apiKey:'invalid',fetcher:()=>{called=true;}}));assert.equal(called,false);});
test('2021년은 신설법인 대상 보고서 없음',async()=>assert.rejects(syncYear(2021,{apiKey:'x'.repeat(40)}),/연결감사보고서를 찾을 수 없습니다/));
test('손상 ZIP 거부',()=>assert.throws(()=>readXmlZip(Buffer.from('not zip'))));

test('표준 ZIP 압축해제 및 UTF-8 XML 읽기',()=>{const files=readXmlZip(Buffer.from('UEsDBBQAAAAIAFuBLV3nRvzuLgAAAD4AAAAMAAAAQ09SUENPREUueG1ssylKLS7NKbGzycksBpLJ+UUF8XmJual2b/vXvOla8mbvFBt9hKCNPkSZPlQXAFBLAQIUABQAAAAIAFuBLV3nRvzuLgAAAD4AAAAMAAAAAAAAAAAAAACAAQAAAABDT1JQQ09ERS54bWxQSwUGAAAAAAEAAQA6AAAAWAAAAAAA','base64'));assert.equal(files[0].name,'CORPCODE.xml');assert.ok(files[0].xml.includes('포스코'));});
