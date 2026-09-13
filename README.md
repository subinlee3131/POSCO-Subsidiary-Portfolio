# POSCO 종속기업 관리

주식회사 포스코의 실제 연결감사보고서 정보를 조회하는 내부 업무용 React · TypeScript · Vite · Tailwind CSS 앱입니다. 가상 기업이나 임의 재무금액을 사용하지 않습니다.

## 실행

Node.js 22.12 이상을 설치한 뒤 이 README가 있는 폴더에서 실행합니다.

```sh
npm install
npm run dev
```

터미널에 표시되는 로컬 주소를 엽니다. 기본 포트가 사용 중이면 Vite가 다음 포트를 선택합니다.

```sh
npm test
npm run build
npm run preview
```

화면은 별도 백엔드나 API 키 없이 동작합니다. 브라우저는 `public/data`의 연도별 JSON만 읽습니다.

## 현재 제공 데이터

현재 데이터는 **포스코 공식 홈페이지에 공개된 연결감사보고서 PDF에서 추출한 정적 데이터**입니다. OpenDART API로 수집한 데이터라고 표시하지 않습니다. API 키가 없으므로 실제 corp_code, rcept_no와 API 전체 수집 과정은 아직 검증하지 못했습니다.

| 연도 | 연결 대상 | 요약 재무정보 확인 | 재무 미공시 |
|---|---:|---:|---:|
| 2022 | 19 | 19 | 0 |
| 2023 | 32 | 31 | 1 |
| 2024 | 37 | 36 | 1 |
| 2025 | 41 | 40 | 1 |

2025년 국내 15개, 해외 26개입니다. 2023~2025년 `PT.KRAKATAU POSCO SOCIAL ENTERPRISE SERVICES INDONESIA`는 현황표에는 있지만 요약 재무표에는 없어 금액을 null, Risk를 판정 보류로 표시합니다. 원문의 대시로 공시된 금액 0과 미공시를 구분합니다.

현 주식회사 포스코는 2022년 3월 1일 신설된 법인입니다. 2021년 선택 시 “해당 연도의 연결감사보고서를 찾을 수 없습니다.”를 표시합니다. 포스코홀딩스의 2021년 자료를 섞지 않습니다.

원문: [포스코 감사보고서 목록](https://posco.com/homepage/docs/kor7/jsp/ir/s91b6000010l.jsp), [2025](https://posco.com/docs/kor7/jsp/resources/file/ir/POSCO_consolidated_FY25.pdf), [2024](https://posco.com/docs/kor7/jsp/resources/file/ir/POSCO_consolidated_FY24.pdf), [2023](https://posco.com/docs/kor7/jsp/resources/file/ir/POSCO_consolidated_FY23.PDF), [2022](https://posco.com/docs/kor7/jsp/resources/file/ir/POSCO_consolidated_FY22.pdf).

## 화면

- 전체현황: 연도별 집계, 지역·업종별 분류, 주요 변화. 분류를 클릭한 후에만 해당 기업 목록을 표시합니다.
- 종속기업 조회: 8개 조건, 조회 버튼 적용, 컬럼 및 주요 재무값 정렬. 조회 전에는 목록을 숨깁니다.
- 변동·Risk: 신규편입·연결제외·지분율 변경 및 재무 이상징후별 필터. 동일 기업에 여러 사유가 있으면 각각 표시하므로 건수 합계는 고유 기업수와 다를 수 있습니다.
- 상세 Drawer: 지분율, 전기/당기 재무금액, 증감률, 주요 재무비율, Risk 근거, 원문과 PDF 페이지.
- 출처 패널: 보고서 출처, 자료 범위, 누락 정보, 이름 결합 검증 미리보기.

## 비교·계산 기준

선택 연도 보고서에 함께 공시된 당기·전기 표를 비교합니다. 전년도에 발행된 별도 PDF의 숫자를 끌어오지 않으므로 재작성·재분류된 비교공시를 따릅니다. 2023년은 당기 12개월/전기 10개월 비교이며, 신규편입 기업 손익은 편입일부터의 금액일 수 있습니다. 해당 안내를 화면에도 표시합니다.

원문 단위 백만원을 원 단위로 저장하고 화면에서 억원(원 ÷ 100,000,000)으로 표시합니다. 증감률은 `(당기 - 전기) ÷ |전기| × 100`; 전기 0·자료 없음은 계산하지 않습니다. 비율의 분모가 0 이하이면 산출 불가입니다. 이름의 법인표기·공백·각주를 정규화하되 국가 등의 의미 있는 문자열은 유지합니다. Port Hedland 사명 변경은 [호주 정부 공식 자료](https://www.nzea.gov.au/port-hedland-iron-project)에 근거한 별칭으로 결합합니다.

Risk 우선순위는 위험 > 주의 > 모니터링 > 정상입니다.

- 위험: 자본 음수 또는 부채 > 자산.
- 주의: 부채/자산 ≥ 90%, 당기순손실, 자본 30% 이상 감소, 전기 흑자 → 당기 적자.
- 모니터링: 매출 30% 이상 감소.
- 자료가 누락된 기업은 확인 가능한 조건만 적용하고, 확인된 위험 조건이 없으면 판정 보류.

## OpenDART 키 발급 후

`.env.example`을 `.env`로 복사하고 발급받은 키를 직접 입력합니다.

```dotenv
DART_API_KEY=발급받은40자리키
```

```sh
npm run dart:sync -- --year 2025
```

이 명령은 브라우저가 아닌 로컬 Node.js에서 실행됩니다. `VITE_` 환경변수를 쓰지 않으며 키를 프론트엔드 번들에 넣지 않습니다. `.env`는 Git에서 제외됩니다.

수집 순서: 공식 고유번호 ZIP → 정확한 비상장 포스코 후보 선택 → 기업개황의 2022년 신설 확인 → F002 연간 연결감사보고서 최신 정정본 검색 → 접수번호 확인 → 원문 XML ZIP → 종속기업 현황·당기/전기 재무표 추출 → 이름 결합·수치 검증 → JSON 교체. 단계별 기록은 `data/audit`, 원문 ZIP은 `data/raw`에 저장합니다.

**API 키 발급 후 실제 OpenDART 응답으로 추가 검증이 필요합니다.** XML 파서는 현재 공식 보고서 표 구조를 기준으로 작성했고 구성한 XML 테스트로 검증했습니다. 실제 DART 원문이 다른 표 구조이거나 연결제외 표를 포함하는 경우, 잘못 반영하지 않도록 수집을 중단합니다. 오류 시 기존 조회 JSON을 유지하므로 원문을 대조한 후 파서를 보완할 수 있습니다. 현재 2022~2025년 공식 PDF에는 연결제외가 없다고 명시되어 있습니다.

공식 API 문서: [공시 검색](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001), [원문파일](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019003), [고유번호](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018).

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/App.tsx` | 연도별 JSON 로딩, 요청 취소, 자료 없음 처리 |
| `src/Dashboard.tsx` | 전체현황·조회·변동 Risk 화면 |
| `src/types.ts` | 기업 연도별 모델, null 허용 재무정보, 보고서 출처·검증 모델 |
| `src/lib/analytics.ts` | UI와 독립적인 Risk, 증감률, 필터, 지역 집계 |
| `src/components/CompanyTable.tsx` | 조회 결과 및 정렬 |
| `src/components/DetailDrawer.tsx` | 기업 상세와 전년 비교 |
| `src/components/SourcePanel.tsx` | 출처·누락·추출 검증 표시 |
| `public/data/posco-YYYY.json` | 화면이 사용하는 실제 기업·재무 데이터 |
| `data/source-tables/` | 공식 PDF에서 추출한 원문 셀과 PDF 해시·페이지 기록 |
| `scripts/normalize.mjs` | 이름 정규화, 단위 변환, 중복·미매칭·재무등식 검증 |
| `scripts/build-snapshots.mjs` | 원문 셀에서 정적 JSON 재생성 (`npm run data:build`) |
| `scripts/dart-sync.mjs` | 로컬 OpenDART 수집 및 검증 후 교체 |
| `scripts/dart-parser.mjs` | DART XML 표 파싱 |
| `scripts/xml-zip.mjs` | XML과 ZIP 읽기·압축해제·CRC 검증 |
| `scripts/extract-official-pdf.py` | 공식 PDF 표 재추출용 개발 스크립트 (Python/pdfplumber 별도 필요) |

PDF 재추출 스크립트는 프로젝트 기준 `../../work/posco-reports/2022.pdf`~`2025.pdf` 원본을 읽습니다. 원본 PDF와 Python은 앱 실행에 필요하지 않습니다. 배포본의 원문 셀 JSON만으로 `npm run data:build`를 실행할 수 있습니다.
