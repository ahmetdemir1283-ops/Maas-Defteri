export function weekLabel(days: number): string {
  if (days >= 7) return 'Hafta tatili yok';
  if (days === 6) return 'Pazar tatil';
  if (days === 5) return 'Cumartesi ve Pazar tatil';
  return `Haftada ${days} gün çalışma`;
}

export function basisLabel(basis: 'net' | 'gross'): string {
  return basis === 'gross' ? 'Brüt' : 'Net';
}

export function salaryModeLabel(mode: 'monthly' | 'hourly'): string {
  return mode === 'hourly' ? 'Saatlik ücret' : 'Aylık maaş';
}
