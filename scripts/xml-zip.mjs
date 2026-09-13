import { inflateRawSync } from 'node:zlib';
export function decodeEntities(s){
 return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity)=>{
  if(entity[0]==='#'){const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return n<=0x10ffff?String.fromCodePoint(n):'';}
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[entity.toLowerCase()];
 });
}
export function parseXml(xml){
 if(/<!ENTITY/i.test(xml))throw Error('XML 엔터티 선언은 지원하지 않습니다.');
 const root={tag:'#document',attrs:{},children:[]},stack=[root];
 let i=0;
 while(i<xml.length){
  if(xml.startsWith('<!--',i)){const e=xml.indexOf('-->',i+4);if(e<0)throw Error('XML 주석 오류');i=e+3;continue;}
  if(xml.startsWith('<![CDATA[',i)){const e=xml.indexOf(']]>',i+9);if(e<0)throw Error('CDATA 오류');stack.at(-1).children.push({tag:'#text',text:xml.slice(i+9,e)});i=e+3;continue;}
  if(xml[i]!=='<'){const e=xml.indexOf('<',i);const end=e<0?xml.length:e;stack.at(-1).children.push({tag:'#text',text:decodeEntities(xml.slice(i,end))});i=end;continue;}
  let quote='',end=i+1;
  for(;end<xml.length;end++){const c=xml[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
  if(end===xml.length)throw Error('XML 태그 종료 누락');
  const body=xml.slice(i+1,end).trim();i=end+1;
  if(body.startsWith('?')||body.startsWith('!'))continue;
  if(body.startsWith('/')){const name=body.slice(1).trim().toLowerCase();if(stack.length===1||stack.at(-1).tag!==name)throw Error('XML 닫기 태그 불일치: '+name);stack.pop();continue;}
  const name=body.match(/^[\w:.-]+/)?.[0]?.toLowerCase();if(!name)throw Error('XML 태그 이름 오류');
  const node={tag:name,attrs:{},children:[]};
  for(const m of body.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))node.attrs[m[1].toLowerCase()]=decodeEntities(m[2]??m[3]);
  stack.at(-1).children.push(node);
  if(!body.endsWith('/'))stack.push(node);
  if(stack.length>150)throw Error('XML 중첩 깊이 제한');
 }
 if(stack.length!==1)throw Error('XML 종료 태그 누락');
 return root;
}
export const nodeText = node => node.tag==='#text'?node.text:(node.children??[]).map(nodeText).join('');
export function findAll(node,tag){const out=[];for(const c of node.children??[]){if(c.tag===tag)out.push(c);out.push(...findAll(c,tag));}return out;}
export const findText=(node,tag)=>nodeText(findAll(node,tag)[0]??{children:[]}).trim();
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** OpenDART ZIP: in-memory read only, no filesystem extraction or path traversal. */
export function readXmlZip(input){
 const b=Buffer.from(input);let eocd=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('유효한 OpenDART ZIP이 아닙니다.');
 const count=b.readUInt16LE(eocd+10);let offset=b.readUInt32LE(eocd+16),total=0;
 if(count>1000||b.readUInt16LE(eocd+4)!==0||b.readUInt16LE(eocd+6)!==0)throw Error('지원하지 않는 ZIP 형식');
 const files=[];
 for(let i=0;i<count;i++){
  if(offset+46>b.length||b.readUInt32LE(offset)!==0x02014b50)throw Error('ZIP 중앙 디렉터리 오류');
  const flags=b.readUInt16LE(offset+8),method=b.readUInt16LE(offset+10),crc=b.readUInt32LE(offset+16),compressed=b.readUInt32LE(offset+20),size=b.readUInt32LE(offset+24),nl=b.readUInt16LE(offset+28),xl=b.readUInt16LE(offset+30),cl=b.readUInt16LE(offset+32),local=b.readUInt32LE(offset+42);
  const name=b.subarray(offset+46,offset+46+nl).toString('utf8');offset+=46+nl+xl+cl;
  if(!/\.xml$/i.test(name))continue;
  if(flags&1||size>100*1024*1024||(total+=size)>120*1024*1024||local+30>b.length)throw Error('ZIP 크기 또는 암호화 제한');
  if(b.readUInt32LE(local)!==0x04034b50)throw Error('ZIP 로컬 헤더 오류');
  const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
  if(start+compressed>b.length)throw Error('ZIP 데이터 범위 오류');
  const content=method===0?b.subarray(start,start+compressed):method===8?inflateRawSync(b.subarray(start,start+compressed),{maxOutputLength:size}):null;
  if(!content||content.length!==size||crc32(content)!==crc)throw Error('ZIP 파일 무결성 검증 실패');
  files.push({name,xml:new TextDecoder('utf-8',{fatal:true}).decode(content)});
 }
 if(!files.length)throw Error('ZIP 내부 XML 없음');
 return files;
}
