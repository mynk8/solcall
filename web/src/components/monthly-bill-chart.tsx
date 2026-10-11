import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart"
import type { Outcome } from "@/lib/api"

const config = {
  bill_now: { label: "Bill now", colors: { light: ["#b1b4b6"], dark: ["#b1b4b6"] } },
  bill_with: { label: "With solar", colors: { light: ["#1d70b8"], dark: ["#1d70b8"] } },
}

/** Apr–Mar monthly bill before and after solar. Net-metering carry-forward shows as summer bills near zero. */
export function MonthlyBillChart({ monthly }: { monthly: Outcome["monthly"] }) {
  const data = monthly.map((m) => ({ month: m.month, bill_now: m.bill_now, bill_with: m.bill_with }))
  return (
    <EvilBarChart config={config} data={data} className="aspect-auto h-56 w-full flex-none" barRadius={3} barGap={2}>
      <EvilBarChart.Grid vertical={false} />
      <EvilBarChart.XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={13} />
      <EvilBarChart.YAxis width={44} tickLine={false} axisLine={false} fontSize={13}
        tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}`} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Legend />
      <EvilBarChart.Bar dataKey="bill_now" />
      <EvilBarChart.Bar dataKey="bill_with" />
    </EvilBarChart>
  )
}
