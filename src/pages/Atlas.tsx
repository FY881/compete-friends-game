import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Moon, Sun, Radar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { ATLAS_NAME, ATLAS_TAGLINE, ATLAS_VERSION } from "@/lib/atlas-design";
import { CommandEngine, InsightsSection, Loading } from "@/components/atlas/AtlasShared";
import {
  SYSTEM_ICONS,
  ControlSystem, PlayersSystem, MembershipsSystem, ContentSystem,
  RoomsSystem, ReportsSystem, AiSystem, EconomySystem, AnalyticsSystem,
  EmergencySystem,
} from "@/components/atlas/AtlasSystems";

/**
 * أطلس كنترول — لوحة السيطرة الكاملة على حرب العقول.
 * 10 أنظمة كبرى × 8 ميزات = 80 ميزة حقيقية مربوطة بخادم اللعبة نفسه.
 */

type SystemId =
  | "control" | "players" | "memberships" | "content" | "rooms"
  | "reports" | "ai" | "economy" | "analytics" | "emergency";

export default function Atlas() {
  const [active, setActive] = useState<SystemId>("control");
  const { isDark, toggle } = useDarkMode();

  // سجل الأنظمة — يُحمّل من الخادم (مصدر الحقيقة الوحيد)
  const registry = useQuery(api.atlas.getAtlasSystemRegistry, {});

  const systems = registry?.systems ?? [];
  const activeSystem = systems.find((s) => s.id === active);

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: "var(--atlas-bg)" }}>
      {/* ── الترويسة ── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "var(--atlas-header)", borderColor: "rgba(148,163,184,0.12)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/icons/atlas-icon-192.png"
              alt={ATLAS_NAME}
              className="size-11 rounded-xl shadow-lg"
              draggable={false}
            />
            <div className="min-w-0">
              <h1
                className="truncate text-lg font-black leading-tight"
                style={{
                  background: "linear-gradient(120deg, #f0cd6a, #d4af37 45%, #7c6cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {ATLAS_NAME}
              </h1>
              <p className="truncate text-[11px] text-slate-400">
                {ATLAS_TAGLINE} · v{ATLAS_VERSION}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={toggle} className="size-9 text-slate-300" aria-label="تبديل الوضع">
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        {registry === undefined ? (
          <Loading />
        ) : registry === null ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-200">
            أطلس كنترول للمالك الرسمي فقط — أعد الدخول من بوابة أطلس.
          </div>
        ) : (
          <>
            {/* شريط الأنظمة العشرة */}
            <nav className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="أنظمة أطلس">
              {systems.map((s) => {
                const Icon = SYSTEM_ICONS[s.id] ?? Radar;
                const isActive = active === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id as SystemId)}
                    className="relative overflow-hidden rounded-2xl border p-3 text-start transition-all"
                    style={{
                      background: isActive ? `${s.accent}1a` : "var(--atlas-panel)",
                      borderColor: isActive ? s.accent : "rgba(148,163,184,0.12)",
                      boxShadow: isActive ? `0 0 24px ${s.accent}33` : "none",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${s.accent}22`, color: s.accent }}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold" style={{ color: s.accent }}>النظام {s.num}</div>
                        <div className="truncate text-[12px] font-bold text-slate-100">{s.name}</div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[10px] text-slate-500">{s.features.length} ميزات حقيقية</div>
                  </button>
                );
              })}
            </nav>

            {/* سجل ميزات النظام النشط (من أصل 80) */}
            {activeSystem && (
              <div className="mb-5 rounded-2xl border p-4"
                style={{ background: "var(--atlas-panel)", borderColor: "rgba(148,163,184,0.12)" }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    ميزات {activeSystem.name} ({activeSystem.features.length})
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {registry.featureCount} ميزة إجمالاً — كلها حقيقية
                  </Badge>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                  {activeSystem.features.map((f) => (
                    <div key={f.id} className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-2">
                      <div className="flex items-center gap-1.5">
                        {f.kind === "action" && (
                          <Zap className={`size-3 shrink-0 ${f.danger ? "text-rose-400" : "text-amber-400"}`} />
                        )}
                        <span className="truncate text-[11px] font-bold text-slate-200">{f.name}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* الأنظمة الحرة + محرك الأوامر — دائماً في الأعلى */}
            <div className="mb-5 space-y-5">
              <InsightsSection />
              <CommandEngine />
            </div>

            {/* محتوى النظام النشط */}
            {active === "control" && <ControlSystem onOpenPlayer={() => setActive("players")} />}
            {active === "players" && <PlayersSystem />}
            {active === "memberships" && <MembershipsSystem />}
            {active === "content" && <ContentSystem />}
            {active === "rooms" && <RoomsSystem />}
            {active === "reports" && <ReportsSystem />}
            {active === "ai" && <AiSystem />}
            {active === "economy" && <EconomySystem />}
            {active === "analytics" && <AnalyticsSystem />}
            {active === "emergency" && <EmergencySystem />}
          </>
        )}

        {/* التذييل */}
        <footer className="mt-8 border-t border-slate-800/60 pt-4 text-center text-[11px] text-slate-600">
          {ATLAS_NAME} v{ATLAS_VERSION} — سيطرة حقيقية أونلاين على «حرب العقول» · كل أمر يُسجَّل في سجل التدقيق الدائم
        </footer>
      </main>
    </div>
  );
}
