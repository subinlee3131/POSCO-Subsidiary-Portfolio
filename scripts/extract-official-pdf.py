from pathlib import Path
import json,re,pdfplumber,hashlib
ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT.parents[1]/'work'/'posco-reports'
def clean(s): return re.sub(r'\s+',' ',s or '').strip()
def coordinate_rows(page, mode):
    words=page.extract_words()
    bounds=[72,217,339,378,416,454,506] if mode=='master' else [72,235,290,344,397,451,506]
    miny=545 if mode=='master' else 122
    anchors=[w for w in words if bounds[2 if mode=='master' else 1]<=w['x0']<bounds[3 if mode=='master' else 2] and miny<w['top']<(770 if mode=='master' else 470) and re.fullmatch(r'\(?[\d,]+(?:\.\d+)?\)?|-',w['text'])]
    rows=[]
    for i,a in enumerate(anchors):
        y=a['top']; lo=(anchors[i-1]['top']+y)/2+2 if i else y-8
        hi=(y+anchors[i+1]['top'])/2+2 if i+1<len(anchors) else y+17
        cols=[]
        for left,right in zip(bounds,bounds[1:]):
            selected=[w for w in words if left<=w['x0']<right and lo<=w['top']<hi and not w['text'].startswith('[')]
            selected.sort(key=lambda w:(round(w['top']/3),w['x0']))
            cols.append(clean(' '.join(w['text'] for w in selected)))
        rows.append(cols)
    return rows
for year in [2022,2023,2024,2025]:
    src=REPORTS/f'{year}.pdf'
    tables=json.loads((REPORTS/f'{year}-tables.json').read_text(encoding='utf-8'))
    mp={2022:[15,16],2023:[13,14],2024:[13,14],2025:[13,14]}[year]
    cp={2022:[17],2023:[15],2024:[16,17],2025:[16,17]}[year]
    pp={2022:[],2023:[16],2024:[18],2025:[18,19]}[year]
    additions_page={2022:20,2023:19,2024:21,2025:23}[year]
    result={'year':year,'sourceUrl':f'https://posco.com/docs/kor7/jsp/resources/file/ir/POSCO_consolidated_FY{str(year)[-2:]}.'+('PDF' if year==2023 else 'pdf'),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'master':[],'currentFinance':[],'previousFinance':[],'additions':[],'exclusions':[]}
    location='국내'
    with pdfplumber.open(src) as pdf:
        intro=pdf.pages[mp[0]-1].extract_text()
        compact=re.sub(r'\s+','',intro)
        result['declaredDomestic']=int(re.search(r'(\d+)개국내법인',compact)[1])
        result['declaredOverseas']=int(re.search(r'(\d+)개해외법인',compact)[1])
        for pn in mp:
            tlist=[t for obj in tables if obj['page']==pn for t in obj['tables']]
            if year==2022 and pn==15:tlist=[coordinate_rows(pdf.pages[pn-1],'master')]
            for t in tlist:
                for r in t:
                    if clean(r[0])=='[국내]':location='국내'
                    if clean(r[0])=='[해외]':location='해외'
                    if len(r)!=(6 if year==2022 else 9) or not re.fullmatch(r'\d+(?:\.\d+)?|-',clean(r[2])):continue
                    if year==2022 and pn==15:location='해외' if re.match(r'[A-Za-z]',r[0]) else '국내'
                    result['master'].append({'cells':[clean(c) for c in r],'page':pn,'domesticOverseas':location})
        for key,pages in [('currentFinance',cp),('previousFinance',pp)]:
            for pn in pages:
                tlist=[t for obj in tables if obj['page']==pn for t in obj['tables']]
                if year==2022:tlist=[coordinate_rows(pdf.pages[pn-1],'finance')]
                for t in tlist:
                    for r in t:
                        if len(r)!=6 or not re.fullmatch(r'\(?[\d,]+\)?|-',clean(r[1])):continue
                        result[key].append({'cells':[clean(c) for c in r],'page':pn})
        at='\n'.join(pdf.pages[i].extract_text() or '' for i in range(additions_page-1,additions_page+1))
        result['noExclusionsConfirmed']=bool(re.search(r'제외된\s*종속기업은\s*없습니다',at))
        for obj in tables:
            if obj['page'] not in [additions_page,additions_page+1]:continue
            for t in obj['tables']:
                for r in t:
                    if len(r)>=4 and re.search(str(year)+r'\s*년',r[1] or ''):
                        result['additions'].append({'name':clean(r[0]),'date':clean(r[1]),'reason':clean(r[-1]),'page':additions_page})
    dest=ROOT/'data/source-tables'/f'{year}.json'
    dest.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(year,'master',len(result['master']),'finance',len(result['currentFinance']),len(result['previousFinance']),'adds',len(result['additions']))


