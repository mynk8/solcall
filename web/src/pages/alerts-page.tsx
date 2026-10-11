import { useState } from "react"
import { toast } from "sonner"

import { Missing } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp } from "@/lib/app-context"

const TOPICS = ["Surcharge change", "Loan rate change", "Price drop for my size", "Neighbours applying in my division"]
const BANDS = ["≤ 200 units", "201–400 units", "401+ units"]
const KEY = "solcall.subscriptions"

type Sub = { discom: string; size: string; band: string; phone: string; topics: string[] }

// GAP: no subscription store or WhatsApp sender exists yet. Subscriptions are kept in this
// browser only; swap load/save for POST /api/alerts when the backend has one.
const load = (): Sub[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") } catch { return [] } }
const save = (s: Sub[]) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ } }

export function AlertsPage() {
  const { household: h, today, navigate } = useApp()
  const [subs, setSubs] = useState<Sub[]>(load)
  const [discom, setDiscom] = useState<string>(h.disco)
  const [size, setSize] = useState(`${h.size} kW`)
  const [band, setBand] = useState(BANDS[h.units <= 200 ? 0 : h.units <= 400 ? 1 : 2])
  const [topics, setTopics] = useState<string[]>(TOPICS)
  const [phone, setPhone] = useState("")

  const subscribe = () => {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter a 10-digit WhatsApp number.")
    const next = [...subs, { discom, size, band, phone, topics }]
    setSubs(next); save(next); setPhone("")
    toast("Subscribed", { description: "Saved on this device. WhatsApp delivery isn't connected yet." })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">My alerts</h1>
        <p className="text-sm text-muted-foreground">We message you on WhatsApp when something changes for your home.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4 rounded-[2px] border bg-white p-5">
          <h2 className="text-lg font-bold">Subscribe</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="DISCOM"><Pick value={discom} onChange={setDiscom} options={["BRPL", "BYPL", "TPDDL"]} /></Field>
            <Field label="Size"><Pick value={size} onChange={setSize} options={["1 kW", "2 kW", "3 kW", "4 kW", "5 kW"]} /></Field>
            <Field label="Usage band"><Pick value={band} onChange={setBand} options={BANDS} /></Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-1 text-sm text-muted-foreground">Tell me about</legend>
            {TOPICS.map((t) => (
              <Label key={t} className="flex items-center gap-2 font-normal">
                <Checkbox checked={topics.includes(t)} onCheckedChange={(c) => setTopics(c ? [...topics, t] : topics.filter((x) => x !== t))} />{t}
              </Label>
            ))}
          </fieldset>
          <Field label="WhatsApp number"><Input type="tel" inputMode="tel" placeholder="+91 ·····" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <div className="flex items-center gap-2"><Button onClick={subscribe}>Subscribe</Button><span className="text-sm text-muted-foreground">or email (later)</span></div>
        </div>

        <div className="flex flex-col gap-4 rounded-[2px] border bg-white p-5">
          <h2 className="text-lg font-bold">Your subscriptions</h2>
          {subs.length ? subs.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.discom} · {s.size} · {s.band}</span>
              <button className="govuk-link" onClick={() => { const n = subs.filter((_, j) => j !== i); setSubs(n); save(n) }}>Remove</button>
            </div>
          )) : <p className="text-sm text-muted-foreground">None yet. Subscribe on the left.</p>}

          <h2 className="pt-2 text-lg font-bold">Message preview</h2>
          <div className="flex max-w-80 flex-col gap-1.5 rounded-xl rounded-bl-sm bg-emerald-600/15 p-3 text-sm">
            <b>Surcharge now {today?.surcharge_brpl ? `${today.surcharge_brpl.pct}%` : "…"}</b>
            <span>Your bill rises ~<Gap>₹X</Gap>/month; your solar saving rises to <Gap>₹Y</Gap>.</span>
            <button className="self-start govuk-link" onClick={() => navigate("changelog")}>See what changed →</button>
          </div>
          <Missing what="surcharge impact per household">₹X and ₹Y need the bill model to apply the surcharge month by month (today it folds surcharge into one calibration factor).</Missing>
          <Button variant="outline" size="sm" className="self-start" onClick={() => toast("Test alert sent (stub)")}>Send a test alert (demo)</Button>
        </div>
      </div>
    </div>
  )
}

const Gap = ({ children }: { children: string }) => <span className="rounded bg-muted px-1 font-mono text-sm">[{children}]</span>

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><span className="text-sm text-muted-foreground">{label}</span>{children}</div>
}

function Pick({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  )
}
