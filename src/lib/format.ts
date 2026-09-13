const decimals = (value:number) => ({maximumFractionDigits:Math.abs(value)>0&&Math.abs(value)<1?2:1});
export const money = (value: number | null | undefined) => value == null ? '—' : (value / 100_000_000).toLocaleString('ko-KR', decimals(value / 100_000_000));
export const percent = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('ko-KR',{maximumFractionDigits:1}) + '%';
export const signed = (value: number | null | undefined, suffix = '%') => value == null ? '—' : (value > 0 ? '+' : '') + value.toLocaleString('ko-KR',decimals(value)) + suffix;
export const riskClass = (level:string) => ({'판정 보류':'neutral','위험':'danger','주의':'caution','모니터링':'monitor','정상':'normal','편입':'info','제외':'neutral','변경':'info'}[level] ?? 'neutral');
