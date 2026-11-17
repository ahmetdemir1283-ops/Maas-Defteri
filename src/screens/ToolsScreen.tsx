import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { DEFAULT_LEGAL } from '../defaults';
import {
  calculateNotice,
  calculateSeverance,
  calculateShortWork,
  calculateUnemployment,
} from '../lib/legal';
import { grossToNet, netToGross } from '../lib/payroll';
import { formatNumber, money } from '../lib/format';
import { toKey, todayKey } from '../lib/date';
import {
  Button,
  Card,
  NumInput,
  PageTop,
  Row,
  SelectField,
  TextField,
  Toggle,
} from '../components/ui';
import type { LegalParams, PayrollResult, TaxBracket } from '../types';

type ToolId =
  | 'severance'
  | 'notice'
  | 'grossNet'
  | 'netGross'
  | 'unemployment'
  | 'shortWork'
  | 'legal';

const TOOLS: { id: ToolId; label: string }[] = [
  { id: 'severance', label: 'Kıdem' },
  { id: 'notice', label: 'İhbar' },
  { id: 'grossNet', label: 'Brüt → Net' },
  { id: 'netGross', label: 'Net → Brüt' },
  { id: 'unemployment', label: 'İşsizlik' },
  { id: 'shortWork', label: 'Kısa çalışma' },
  { id: 'legal', label: 'Mevzuat' },
];

export default function ToolsScreen() {
  const { data, navigate, updateLegal } = useApp();
  const [tool, setTool] = useState<ToolId>('severance');
  const legal = data.legal;
  const currentMonth = new Date().getMonth() + 1;

  const defaultGross = useMemo(() => {
    const base =
      data.settings.salaryMode === 'hourly'
        ? data.settings.hourlyRate * data.settings.monthlyHourDivisor
        : data.settings.monthlySalary;
    if (base <= 0) return legal.minWageGross;
    if (data.settings.salaryBasis === 'gross') return Math.round(base * 100) / 100;
    return Math.round(netToGross(base, legal, { monthIndex: currentMonth }).gross * 100) / 100;
  }, [data.settings, legal, currentMonth]);

  const defaultStart = useMemo(() => {
    if (data.profile.startDate) return data.profile.startDate;
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return toKey(date);
  }, [data.profile.startDate]);

  return (
    <>
      <PageTop title="Hesaplama araçları" onBack={() => navigate('home')} />
      <div className="pill-row no-print">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            className={`pill ${tool === item.id ? 'on' : ''}`}
            onClick={() => setTool(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tool === 'severance' && (
        <SeveranceTool
          legal={legal}
          defaultGross={defaultGross}
          defaultStart={defaultStart}
        />
      )}
      {tool === 'notice' && (
        <NoticeTool legal={legal} defaultGross={defaultGross} defaultStart={defaultStart} />
      )}
      {tool === 'grossNet' && (
        <GrossToNetTool
          legal={legal}
          defaultAmount={data.settings.salaryMode === 'hourly' ? defaultGross : defaultGross}
        />
      )}
      {tool === 'netGross' && (
        <NetToGrossTool legal={legal} defaultAmount={legal.minWageNet} />
      )}
      {tool === 'unemployment' && <UnemploymentTool legal={legal} />}
      {tool === 'shortWork' && <ShortWorkTool legal={legal} />}

      {tool === 'legal' && (
        <>
          <Card title="Maaş ve mesai ayarları">
            <div className="rows">
              <Row label="Profil, maaş, izin ve bildirim ayarları" value="Ayarlar ›" />
            </div>
            <Button small variant="ghost" block onClick={() => navigate('settings')}>
              Ayarları aç
            </Button>
          </Card>
          <LegislationPanel legal={legal} updateLegal={updateLegal} />
        </>
      )}

      <div className="disclaimer">
        Hesaplamalar bilgilendirme amaçlı tahmini sonuç üretir. Kıdem tazminatı tavanı, asgari
        ücret, vergi dilimleri ve prim oranları dönem dönem değişir; varsayılan değerler{' '}
        {legal.year} dönemine aittir (son kontrol {legal.verifiedAt}). Resmî tutarlar için
        İŞKUR, SGK ve GİB kaynaklarını veya işyerinizin bordro birimini kontrol edin. 2027
        parametreleri açıklandığında bu bölümden güncelleyebilirsiniz.
      </div>
    </>
  );
}

function SeveranceTool({
  legal,
  defaultGross,
  defaultStart,
}: {
  legal: LegalParams;
  defaultGross: number;
  defaultStart: string;
}) {
  const [gross, setGross] = useState(defaultGross);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(todayKey());
  const [ceilingIndex, setCeilingIndex] = useState(0);
  const [ceiling, setCeiling] = useState(
    legal.severanceCeilings[0]?.value ?? legal.severanceCeiling,
  );
  const [stamp, setStamp] = useState(true);

  const result = calculateSeverance({ grossMonthly: gross, start, end, legal, ceiling, stamp });

  return (
    <>
      <Card title="Kıdem tazminatı">
        <NumInput label="Giydirilmiş aylık brüt ücret" value={gross} onChange={setGross} suffix="₺" />
        <div className="two">
          <TextField label="İşe giriş" type="date" value={start} onChange={setStart} />
          <TextField label="İşten çıkış" type="date" value={end} onChange={setEnd} />
        </div>
        <SelectField
          label="Kıdem tavanı dönemi"
          value={String(ceilingIndex)}
          onChange={(value) => {
            const index = Number(value);
            setCeilingIndex(index);
            setCeiling(legal.severanceCeilings[index]?.value ?? legal.severanceCeiling);
          }}
          options={legal.severanceCeilings.map((item, index) => ({
            value: String(index),
            label: `${item.label} · ${money(item.value)}`,
          }))}
        />
        <NumInput
          label="Uygulanacak tavan"
          value={ceiling}
          onChange={setCeiling}
          suffix="₺"
          hint="Tavan, yıllık kıdem tutarının üst sınırıdır. Tarih aralığına göre seçin."
        />
        <Toggle
          label="Damga vergisi düşülsün"
          description={`Kıdem tazminatından yalnızca %${formatNumber(legal.stampTax, 3)} damga vergisi kesilir.`}
          checked={stamp}
          onChange={setStamp}
        />

        <div className="result-box">
          <div className="cap">Tahmini net kıdem tazminatı</div>
          <div className="big">{money(result.net)}</div>
          <div className="rows" style={{ marginTop: 8 }}>
            <Row
              label="Hizmet süresi"
              value={`${result.service.years} yıl ${result.service.months} ay ${result.service.days} gün`}
            />
            <Row
              label="Esas alınan aylık ücret"
              value={money(result.cappedMonthly)}
              sub={result.capped ? 'Tavan uygulandı' : 'Tavanın altında'}
            />
            <Row label="Brüt kıdem tazminatı" value={money(result.gross)} />
            {stamp && <Row label="Damga vergisi" value={`− ${money(result.stampTax)}`} tone="neg" />}
          </div>
        </div>
        {!result.eligible && (
          <div className="note warn">
            Kıdem tazminatı için en az 1 yıl (12 ay) hizmet gerekir. Girilen süre 1 yıldan kısa.
          </div>
        )}
        <div className="note">
          Her tam yıl için 30 günlük brüt ücret esas alınır; artan aylar ve günler oransal eklenir.
          İşverenin kıdem tazminatı ödeme yükümlülüğü, iş sözleşmesinin sona erme şekline göre
          değişebilir.
        </div>
      </Card>
    </>
  );
}

function NoticeTool({
  legal,
  defaultGross,
  defaultStart,
}: {
  legal: LegalParams;
  defaultGross: number;
  defaultStart: string;
}) {
  const [gross, setGross] = useState(defaultGross);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(todayKey());
  const [stamp, setStamp] = useState(true);
  const result = calculateNotice({ grossMonthly: gross, start, end, legal, stamp });

  return (
    <Card title="İhbar tazminatı">
      <NumInput label="Aylık brüt ücret" value={gross} onChange={setGross} suffix="₺" />
      <div className="two">
        <TextField label="İşe giriş" type="date" value={start} onChange={setStart} />
        <TextField label="İşten çıkış" type="date" value={end} onChange={setEnd} />
      </div>
      <Toggle
        label="Damga vergisi düşülsün"
        checked={stamp}
        onChange={setStamp}
        description="İhbar tazminatı damga vergisine tabidir."
      />
      <div className="result-box">
        <div className="cap">Tahmini net ihbar tazminatı</div>
        <div className="big">{money(result.net)}</div>
        <div className="rows" style={{ marginTop: 8 }}>
          <Row label="Bildirim süresi" value={`${result.weeks} hafta (${result.days} gün)`} />
          <Row label="Brüt ihbar tazminatı" value={money(result.gross)} />
          {stamp && <Row label="Damga vergisi" value={`− ${money(result.stampTax)}`} tone="neg" />}
        </div>
      </div>
      <div className="note">
        0–6 ay arası 2 hafta, 6 ay–1,5 yıl 4 hafta, 1,5–3 yıl 6 hafta, 3 yıldan fazla hizmette 8
        hafta brüt ücret esas alınır. İşveren ihbar süresi kullandırırsa tazminat yerine süre
        kullandırılabilir.
      </div>
    </Card>
  );
}

function PayrollBreakdown({ result }: { result: PayrollResult }) {
  return (
    <div className="rows" style={{ marginTop: 8 }}>
      <Row label="Brüt kazanç" value={money(result.gross)} />
      <Row label="SGK işçi payı" value={`− ${money(result.sgk)}`} tone="neg" />
      <Row label="İşsizlik sigortası işçi payı" value={`− ${money(result.unemployment)}`} tone="neg" />
      <Row
        label="Gelir vergisi"
        value={`− ${money(result.incomeTax)}`}
        tone="neg"
        sub={
          result.incomeTaxExemption > 0
            ? `Asgari ücret istisnası: ${money(result.incomeTaxExemption)}`
            : undefined
        }
      />
      <Row
        label="Damga vergisi"
        value={`− ${money(result.stampTax)}`}
        tone="neg"
        sub={result.stampExemption > 0 ? `İstisna: ${money(result.stampExemption)}` : undefined}
      />
      <Row label="Net kazanç" value={money(result.net)} total />
    </div>
  );
}

function GrossToNetTool({ legal, defaultAmount }: { legal: LegalParams; defaultAmount: number }) {
  const [gross, setGross] = useState(defaultAmount);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [cumulative, setCumulative] = useState(true);
  const [exemption, setExemption] = useState(true);
  const result = grossToNet(gross, legal, {
    monthIndex: Number(month),
    cumulative,
    exemption,
  });

  return (
    <Card title="Brüt maaştan net maaşa">
      <NumInput label="Aylık brüt ücret" value={gross} onChange={setGross} suffix="₺" />
      <SelectField
        label="Yılın kaçıncı ayı"
        value={month}
        onChange={setMonth}
        options={Array.from({ length: 12 }, (_, index) => ({
          value: String(index + 1),
          label: `${index + 1}. ay`,
        }))}
        hint="Kümülatif vergi dilimi yıl içinde yükselir."
      />
      <Toggle
        label="Kümülatif vergi uygula"
        description="Kapatılırsa her ay ilk dilimden başlanır."
        checked={cumulative}
        onChange={setCumulative}
      />
      <Toggle
        label="Asgari ücret istisnası"
        description="Asgari ücret düzeyindeki gelir vergisi ve damga vergisi istisnası."
        checked={exemption}
        onChange={setExemption}
      />
      <div className="result-box">
        <div className="cap">Tahmini net maaş</div>
        <div className="big">{money(result.net)}</div>
        <PayrollBreakdown result={result} />
      </div>
    </Card>
  );
}

function NetToGrossTool({ legal, defaultAmount }: { legal: LegalParams; defaultAmount: number }) {
  const [net, setNet] = useState(defaultAmount);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [exemption, setExemption] = useState(true);
  const result = netToGross(net, legal, {
    monthIndex: Number(month),
    cumulative: true,
    exemption,
  });

  return (
    <Card title="Net maaştan brüt maaşa">
      <NumInput label="Aylık net ücret" value={net} onChange={setNet} suffix="₺" />
      <SelectField
        label="Yılın kaçıncı ayı"
        value={month}
        onChange={setMonth}
        options={Array.from({ length: 12 }, (_, index) => ({
          value: String(index + 1),
          label: `${index + 1}. ay`,
        }))}
      />
      <Toggle
        label="Asgari ücret istisnası"
        checked={exemption}
        onChange={setExemption}
      />
      <div className="result-box">
        <div className="cap">Tahmini brüt maaş</div>
        <div className="big">{money(result.gross)}</div>
        <PayrollBreakdown result={result} />
      </div>
      <div className="note">
        Brüt tutar, aynı bordro modeliyle net hedefe ulaşacak şekilde çözülür; sonuç kuruş
        yuvarlaması nedeniyle birkaç kuruş farklı olabilir.
      </div>
    </Card>
  );
}

function UnemploymentTool({ legal }: { legal: LegalParams }) {
  const [wages, setWages] = useState<[number, number, number, number]>([
    legal.minWageGross,
    legal.minWageGross,
    legal.minWageGross,
    legal.minWageGross,
  ]);
  const [premiumDays, setPremiumDays] = useState('1080');
  const result = calculateUnemployment({
    wages,
    premiumDays: Number(premiumDays),
    legal,
  });

  return (
    <Card title="İşsizlik maaşı">
      <div className="two">
        {wages.map((wage, index) => (
          <NumInput
            key={index}
            label={`${index + 1}. ay brüt kazanç`}
            value={wage}
            onChange={(value) =>
              setWages((current) => {
                const next = [...current] as [number, number, number, number];
                next[index] = value;
                return next;
              })
            }
            suffix="₺"
          />
        ))}
      </div>
      <SelectField
        label="Son 3 yıldaki prim günü"
        value={premiumDays}
        onChange={setPremiumDays}
        options={[
          { value: '599', label: '600 günden az — hak doğmaz' },
          { value: '600', label: '600 – 899 gün — 6 ay' },
          { value: '900', label: '900 – 1079 gün — 8 ay' },
          { value: '1080', label: '1080 gün ve üzeri — 10 ay' },
        ]}
      />
      <div className="result-box">
        <div className="cap">Aylık tahmini net işsizlik ödeneği</div>
        <div className="big">{money(result.net)}</div>
        <div className="rows" style={{ marginTop: 8 }}>
          <Row label="Son 4 ay ortalaması" value={money(result.averageGross)} />
          <Row label="Hesaplanan ödenek" value={money(result.rawBenefit)} />
          <Row label="Üst sınır" value={money(result.cap)} />
          <Row label="Brüt ödenek" value={money(result.gross)} />
          <Row label="Damga vergisi" value={`− ${money(result.stampTax)}`} tone="neg" />
          <Row
            label="Ödeme süresi"
            value={result.eligible ? `${result.durationMonths} ay` : 'Hak yok'}
            total
          />
        </div>
      </div>
      {!result.eligible && (
        <div className="note warn">
          Son 3 yılda en az 600 prim günü ve son 120 günde işsizlik sigortası primi ödenmiş
          olması gerekir. Bu hesaplama yalnızca prim gününe göre süre tahmini yapar.
        </div>
      )}
      <div className="note">
        Günlük ödenek, son 4 aylık prime esas kazancın günlük ortalamasının %40’ıdır; aylık tutar
        brüt asgari ücretin %{legal.unemploymentCapRate}’ini aşamaz. Yalnızca damga vergisi
        kesilir. İşten çıkış tarihinden itibaren 30 gün içinde İŞKUR’a başvurulmalıdır.
      </div>
    </Card>
  );
}

function ShortWorkTool({ legal }: { legal: LegalParams }) {
  const [average, setAverage] = useState(legal.minWageGross);
  const [months, setMonths] = useState(3);
  const [stamp, setStamp] = useState(true);
  const result = calculateShortWork({ averageGross: average, months, legal, stamp });

  return (
    <Card title="Kısa çalışma ödeneği">
      <NumInput
        label="Son 12 ay ortalama aylık brüt kazanç"
        value={average}
        onChange={setAverage}
        suffix="₺"
      />
      <NumInput
        label="Ödenek süresi"
        value={months}
        onChange={setMonths}
        suffix="ay"
        integer
        min={1}
        max={6}
      />
      <Toggle
        label="Damga vergisi düşülsün"
        checked={stamp}
        onChange={setStamp}
        description="Ödenekten damga vergisi kesintisi uygulanır."
      />
      <div className="result-box">
        <div className="cap">Aylık tahmini net ödenek</div>
        <div className="big">{money(result.net)}</div>
        <div className="rows" style={{ marginTop: 8 }}>
          <Row label="Hesaplanan ödenek" value={money(result.rawBenefit)} />
          <Row label="Üst sınır" value={money(result.cap)} />
          <Row label="Brüt ödenek" value={money(result.gross)} />
          {stamp && <Row label="Damga vergisi" value={`− ${money(result.stampTax)}`} tone="neg" />}
          <Row label={`${result.months} aylık toplam`} value={money(result.total)} total />
        </div>
      </div>
      <div className="note">
        Kısa çalışma ödeneği, son 12 aylık prime esas kazancın %{legal.shortWorkRate}’i oranında
        hesaplanır ve brüt asgari ücretin %{legal.shortWorkCapRate}’ini aşamaz. Kural olarak 3 ayı
        geçmemek üzere ödenir; süre uzatımları ayrıca değerlendirilir. İşyeri başvurusu ve
        uygunluk şartları İŞKUR tarafından belirlenir.
      </div>
    </Card>
  );
}

function LegislationPanel({
  legal,
  updateLegal,
}: {
  legal: LegalParams;
  updateLegal: (patch: Partial<LegalParams>) => void;
}) {
  const setBracket = (index: number, patch: Partial<TaxBracket>) => {
    updateLegal({
      incomeTaxBrackets: legal.incomeTaxBrackets.map((bracket, position) =>
        position === index ? { ...bracket, ...patch } : bracket,
      ),
    });
  };

  const reset = () => {
    updateLegal({
      ...DEFAULT_LEGAL,
      incomeTaxBrackets: DEFAULT_LEGAL.incomeTaxBrackets.map((item) => ({ ...item })),
      severanceCeilings: DEFAULT_LEGAL.severanceCeilings.map((item) => ({ ...item })),
    });
  };

  return (
    <Card title={`Mevzuat parametreleri (${legal.year})`}>
      <div className="two">
        <NumInput
          label="Brüt asgari ücret"
          value={legal.minWageGross}
          onChange={(value) => updateLegal({ minWageGross: value })}
          suffix="₺"
        />
        <NumInput
          label="Net asgari ücret"
          value={legal.minWageNet}
          onChange={(value) => updateLegal({ minWageNet: value })}
          suffix="₺"
        />
      </div>
      <div className="two">
        <NumInput
          label="SGK işçi payı"
          value={legal.sgkEmployee}
          onChange={(value) => updateLegal({ sgkEmployee: value })}
          suffix="%"
        />
        <NumInput
          label="İşsizlik işçi payı"
          value={legal.unemploymentEmployee}
          onChange={(value) => updateLegal({ unemploymentEmployee: value })}
          suffix="%"
        />
      </div>
      <div className="two">
        <NumInput
          label="Damga vergisi"
          value={legal.stampTax}
          onChange={(value) => updateLegal({ stampTax: value })}
          suffix="%"
        />
        <NumInput
          label="SGK prim tavanı"
          value={legal.sgkCeiling}
          onChange={(value) => updateLegal({ sgkCeiling: value })}
          suffix="₺"
        />
      </div>
      <Toggle
        label="Asgari ücret istisnası"
        description="Asgari ücret düzeyinde gelir ve damga vergisi istisnası uygulanır."
        checked={legal.applyMinWageExemption}
        onChange={(checked) => updateLegal({ applyMinWageExemption: checked })}
      />

      <div className="section-title">
        <h2 style={{ fontFamily: 'inherit', fontSize: 12 }}>Gelir vergisi dilimleri</h2>
      </div>
      {legal.incomeTaxBrackets.map((bracket, index) => (
        <div className="two" key={index}>
          <NumInput
            label={
              bracket.limit == null ? `${index + 1}. dilim (üzeri)` : `${index + 1}. dilim üst sınırı`
            }
            value={bracket.limit ?? 0}
            onChange={(value) => setBracket(index, { limit: Math.max(1, value) })}
            suffix="₺"
            disabled={bracket.limit == null}
          />
          <NumInput
            label="Oran"
            value={bracket.rate}
            onChange={(value) => setBracket(index, { rate: value })}
            suffix="%"
          />
        </div>
      ))}

      <div className="section-title">
        <h2 style={{ fontFamily: 'inherit', fontSize: 12 }}>Kıdem tavanı</h2>
      </div>
      {legal.severanceCeilings.map((ceiling, index) => (
        <div className="two" key={index}>
          <TextField
            label={index === 0 ? 'Dönem 1' : `Dönem ${index + 1}`}
            value={ceiling.label}
            onChange={(value) =>
              updateLegal({
                severanceCeilings: legal.severanceCeilings.map((item, position) =>
                  position === index ? { ...item, label: value } : item,
                ),
              })
            }
          />
          <NumInput
            label="Tutar"
            value={ceiling.value}
            onChange={(value) =>
              updateLegal({
                severanceCeilings: legal.severanceCeilings.map((item, position) =>
                  position === index ? { ...item, value } : item,
                ),
              })
            }
            suffix="₺"
          />
        </div>
      ))}
      <NumInput
        label="Varsayılan kıdem tavanı"
        value={legal.severanceCeiling}
        onChange={(value) => updateLegal({ severanceCeiling: value })}
        suffix="₺"
      />

      <div className="section-title">
        <h2 style={{ fontFamily: 'inherit', fontSize: 12 }}>Ödenek oranları</h2>
      </div>
      <div className="two">
        <NumInput
          label="İşsizlik oranı"
          value={legal.unemploymentRate}
          onChange={(value) => updateLegal({ unemploymentRate: value })}
          suffix="%"
        />
        <NumInput
          label="İşsizlik tavanı"
          value={legal.unemploymentCapRate}
          onChange={(value) => updateLegal({ unemploymentCapRate: value })}
          suffix="%"
        />
      </div>
      <div className="two">
        <NumInput
          label="Kısa çalışma oranı"
          value={legal.shortWorkRate}
          onChange={(value) => updateLegal({ shortWorkRate: value })}
          suffix="%"
        />
        <NumInput
          label="Kısa çalışma tavanı"
          value={legal.shortWorkCapRate}
          onChange={(value) => updateLegal({ shortWorkCapRate: value })}
          suffix="%"
        />
      </div>
      <div className="two">
        <NumInput
          label="Parametre yılı"
          value={legal.year}
          onChange={(value) => updateLegal({ year: Math.round(value) })}
          integer
        />
        <TextField
          label="Son kontrol"
          value={legal.verifiedAt}
          onChange={(value) => updateLegal({ verifiedAt: value })}
        />
      </div>

      <div className="btn-row">
        <Button small variant="ghost" onClick={reset}>
          Varsayılanlara dön
        </Button>
      </div>
      <div className="note warn">
        Değerler yalnızca bu cihazda saklanır ve tüm araçlarda kullanılır. Güncel mevzuatı
        doğrulamadan resmî işlemlerde kullanmayın.
      </div>
    </Card>
  );
}
