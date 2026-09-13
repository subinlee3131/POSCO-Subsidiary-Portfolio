export type RiskLevel = '위험' | '주의' | '모니터링' | '정상' | '판정 보류';
export interface CompanyYear {
  companyId: string;
  companyName: string;
  year: number;
  domesticOverseas: '국내' | '해외';
  country: string;
  businessType: string;
  /** 지분율은 0~100, 금액은 KRW 원. 미공시 재무값은 null. */
  parentOwnership: number;
  subsidiaryOwnership: number;
  totalOwnership: number;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  revenue: number | null;
  netIncome: number | null;
  isConsolidated: boolean;
  isNewlyConsolidated: boolean | null;
  dataStatus?: "reported" | "not-disclosed";
  periodNote?: string;
  entryDate?: string | null;
  source: { type: 'report'; label: string; currency: 'KRW'; provider: string; url: string; reportYear: number; masterPage: number | null; financialPage: number | null; financialName?: string | null; corpCode?: string | null; rceptNo?: string | null };
}
export type FinancialKey = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'netIncome';
export type EventKind = '신규편입' | '연결제외' | '지분율변경' | '적자전환' | '자본 30% 이상 감소' | '매출 30% 이상 감소' | '자본 음수' | '부채/자산 90% 이상' | '당기순손실' | '부채 초과';
export interface RiskResult { level: RiskLevel; reasons: string[] }
export interface CompanyView { current: CompanyYear; previous?: CompanyYear; risk: RiskResult }
export interface ChangeEvent { kind: EventKind; company: CompanyView; previous: number | null; current: number | null; unit: 'money' | 'percent' | 'status'; status: RiskLevel | '편입' | '제외' | '변경' }
export interface Filters { name: string; location: string; country: string; business: string; profit: string; risk: string; newly: string; ownership: string }


export interface ReportData {
 schemaVersion: 1; year: number; records: CompanyYear[];
 entity: {name: string; established: string; corpCode: string | null; rceptNo: string | null};
 source: {provider: string;label:string;url:string;sha256:string;corpCode:string|null;rceptNo:string|null};
 comparisonBasis: string; noExclusionsConfirmed: boolean; warnings: string[];
 validation: {masterCount:number;financialCount:number;declaredDomestic:number;declaredOverseas:number;missingFinancialCompanies:string[];orphanFinancialCompanies:string[];equationChecked:boolean;ownershipChecked:boolean;preview:{companyName:string;matched:boolean;masterPage:number|null;financialPage:number|null;assetsMillion:number|null}[]};
}
export const availableYears = [2025, 2024, 2023, 2022, 2021];
