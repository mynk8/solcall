import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { AppProvider, useApp } from "@/lib/app-context"
import { AlertsPage } from "@/pages/alerts-page"
import { ChangelogPage } from "@/pages/changelog-page"
import { CheckPage } from "@/pages/check-page"
import { DataPage } from "@/pages/data-page"
import { DealPage } from "@/pages/deal-page"
import { GuidePage } from "@/pages/guide-page"
import { MapPage } from "@/pages/map-page"
import { RecordsPage } from "@/pages/records-page"
import { ReferencePage } from "@/pages/reference-page"

const PAGES = {
  home: ReferencePage,
  map: MapPage,
  check: CheckPage,
  deal: DealPage,
  alerts: AlertsPage,
  records: RecordsPage,
  changelog: ChangelogPage,
  guide: GuidePage,
  data: DataPage,
}

function Routed() {
  const { route } = useApp()
  const Page = PAGES[route]
  return <Page />
}

export default function App() {
  return (
    <AppProvider>
      <AppShell>
        <Routed />
      </AppShell>
      <Toaster position="top-center" />
    </AppProvider>
  )
}
