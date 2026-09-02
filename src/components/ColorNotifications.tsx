/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔔 COLOR-CODED NOTIFICATIONS BELL — نظام الإشعارات الملون
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Shows a bell icon with a color-coded badge:
 * - 🟢 Green: info / normal
 * - 🔵 Blue: system / update
 * - 🟠 Orange: warning
 * - 🔴 Red: ban / critical
 * - 🟣 Purple: needs review (owner reports)
 *
 * The bell pulses when there are unread notifications.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, AlertTriangle, Shield, Info, Ban, Settings } from "lucide-react";

// Color mapping for notification types
const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  info:    { bg: "bg-emerald-500",  text: "text-emerald-600",  dot: "bg-emerald-500",  label: "معلومة" },
  warning: { bg: "bg-orange-500",   text: "text-orange-600",   dot: "bg-orange-500",   label: "تحذير" },
  ban:     { bg: "bg-red-500",      text: "text-red-600",      dot: "bg-red-500",      label: "حظر" },
  update:  { bg: "bg-blue-500",     text: "text-blue-600",     dot: "bg-blue-500",     label: "تحديث" },
  system:  { bg: "bg-violet-500",   text: "text-violet-600",   dot: "bg-violet-500",   label: "نظام" },
};

// Owner-specific: also shows reports needing review in purple
const SEVERITY_COLORS: Record<string, string> = {
  low: "border-l-emerald-400",
  medium: "border-l-orange-400",
  high: "border-l-red-400",
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  info: Info,
  warning: AlertTriangle,
  ban: Ban,
  update: Settings,
  system: Shield,
};

interface ColorNotificationsProps {
  /** When true, show owner-specific purple indicators for reports */
  isOwner?: boolean;
}

export function ColorNotificationsBell({ isOwner = false }: ColorNotificationsProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const markRead = useMutation(api.playerControl.markNotificationRead);

  // Player notifications
  const notifications = useQuery(api.playerControl.getMyNotifications);

  // Owner: pending reports count (shown in purple)
  const reportStats = useQuery(
    api.lawEnforcement.getReportStats,
    isOwner ? {} : "skip"
  );

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;
  const pendingReports = reportStats?.open ?? 0;
  const totalBadge = unreadCount + (isOwner ? pendingReports : 0);

  // Determine the dominant color for the badge
  const getDominantColor = () => {
    if (!notifications) return TYPE_COLORS.info;
    const unread = notifications.filter((n) => !n.read);
    // Priority: ban > warning > update > system > info
    if (unread.some((n) => n.type === "ban")) return TYPE_COLORS.ban;
    if (unread.some((n) => n.type === "warning")) return TYPE_COLORS.warning;
    if (unread.some((n) => n.type === "update")) return TYPE_COLORS.update;
    if (unread.some((n) => n.type === "system")) return TYPE_COLORS.system;
    return TYPE_COLORS.info;
  };

  const dominantColor = getDominantColor();

  const handleMarkAllRead = async () => {
    if (!user) return;
    const unread = notifications?.filter((n) => !n.read) ?? [];
    for (const n of unread) {
      await markRead({ notificationId: n._id });
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-xl p-2.5 transition-all hover:bg-muted/80 active:scale-95"
        aria-label="الإشعارات"
      >
        <Bell className={`size-5 ${totalBadge > 0 ? dominantColor.text : "text-muted-foreground"}`} />

        {/* Badge */}
        {totalBadge > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg ${dominantColor.bg} ${
              totalBadge > 9 ? "min-w-[20px] px-1" : ""
            }`}
            style={{
              animation: "notificationPulse 2s ease-in-out infinite",
            }}
          >
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}

        {/* Owner indicator: purple dot for pending reports */}
        {isOwner && pendingReports > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-violet-500 border-2 border-background" />
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute left-0 top-full z-50 mt-2 w-80 max-h-96 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className={`size-4 ${dominantColor.text}`} />
                <span className="text-sm font-bold">الإشعارات</span>
                {totalBadge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${dominantColor.bg}`}>
                    {totalBadge}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Check className="size-3" />
                  قراءة الكل
                </button>
              )}
            </div>

            {/* Owner: Pending Reports Alert */}
            {isOwner && pendingReports > 0 && (
              <div className="mx-3 mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-violet-600" />
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                    {pendingReports} بلاغ بانتظار المراجعة
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-violet-600/80 dark:text-violet-400/80">
                  الذكاء الاصطناعي يحتاج مراجعتك للبلاغات عالية الخطورة
                </p>
              </div>
            )}

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-72">
              {(!notifications || notifications.length === 0) ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 size-8 opacity-30" />
                  لا توجد إشعارات
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const color = TYPE_COLORS[n.type] || TYPE_COLORS.info;
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  const borderColor = SEVERITY_COLORS[n.type === "ban" ? "high" : n.type === "warning" ? "medium" : "low"];

                  return (
                    <div
                      key={n._id}
                      className={`flex items-start gap-3 border-b border-border/20 px-4 py-3 transition-colors hover:bg-muted/40 ${
                        !n.read ? "bg-muted/20" : ""
                      } border-r-2 ${borderColor}`}
                    >
                      {/* Icon with color */}
                      <div className={`mt-0.5 rounded-lg p-1.5 ${color.bg}/15`}>
                        <Icon className={`size-3.5 ${color.text}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold truncate">{n.title}</p>
                          {!n.read && (
                            <span className={`size-1.5 rounded-full ${color.dot} shrink-0`} />
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {new Date(n.createdAt).toLocaleDateString("ar-SA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* Mark as read */}
                      {!n.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead({ notificationId: n._id });
                          }}
                          className="mt-1 rounded p-1 text-muted-foreground/40 hover:text-foreground/60 transition-colors"
                          title="تحديد كمقروء"
                        >
                          <Check className="size-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Legend */}
            <div className="border-t border-border/40 px-4 py-2">
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_COLORS).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className={`size-1.5 rounded-full ${val.dot}`} />
                    <span className="text-[10px] text-muted-foreground">{val.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pulse Animation */}
      <style>{`
        @keyframes notificationPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
