import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { assembleReport } from './normalize.mjs';
await mkdir('public/data',{recursive:true});
for(const year of [2022,2023,2024,2025]){
 const raw=JSON.parse(await readFile('data/source-tables/'+year+'.json','utf8'));
 const report=assembleReport(raw);
 await writeFile('public/data/posco-'+year+'.json',JSON.stringify(report,null,2)+'\n');
 console.log(year,report.validation.masterCount,report.validation.financialCount,report.warnings);
}
