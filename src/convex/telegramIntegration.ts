import { getAuthUserId } from "@convex-dev/auth/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { action, query, mutation } from "./_generated/server";

// ═══════════════════════════════════════════════════════════════════════
// ║ Telegram Bot — إرسال واستقبال فعلي
// ═══════════════════════════════════════════════════════════════════════

const TELEGRAM_API = "https://api.telegram.org";

async function sendTelegramMessage(token: string, chatId: string, text: string, parseMode = "HTML") {
  const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
  return resp.json() as Promise<{ ok: boolean; result?: { message_id: number } }>;
}

// ─── إرسال تنبيه من المالك ─────────────────────────────────────────
export const sendTelegramAlert = action({
  args: {
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, { message, priority }) => {
    const config = await ctx.runQuery(api.telegramIntegration.getTelegramConfig);
    if (!config) throw new Error("لم يتم إعداد بوت تيليجرام — أدخل Token في إعدادات المالك");

    const icons: Record<string, string> = { low: "ℹ️", medium: "⚠️", high: "🚨" };
    const text = `${icons[priority]} <b>تنبيه حرب العقول [${priority.toUpperCase()}]</b>\n\n${message}`;

    const result = await sendTelegramMessage(config.token, config.chatId, text);

    await ctx.runMutation(api.telegramIntegration.logTelegramNotification, {
      message,
      priority,
      telegramResponse: JSON.stringify(result),
    });

    return { success: result.ok === true, messageId: result.result?.message_id };
  },
});

// ─── إذاعة عبر تيليجرام ─────────────────────────────────────
export const broadcastViaTelegram = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const config = await ctx.runQuery(api.telegramIntegration.getTelegramConfig);
    if (!config) throw new Error("تيليجرام غير مُعدّ");

    const text = `📢 <b>إذاعة من إدارة حرب العقول</b>\n\n${message}`;
    const result = await sendTelegramMessage(config.token, config.chatId, text);

    await ctx.runMutation(api.telegramIntegration.logTelegramNotification, {
      message: `إذاعة: ${message}`,
      priority: "medium",
      telegramResponse: JSON.stringify(result),
    });

    return { success: result.ok === true };
  },
});

// ─── إرسال تقرير يومي ───────────────────────────────────────────
export const sendDailyReport = action({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.runQuery(api.telegramIntegration.getTelegramConfig);
    if (!config) throw new Error("تيليجرام غير مُعدّ");

    const stats = await ctx.runQuery(api.telegramIntegration.getDailyStats);

    const text = [
      `📊 <b>تقرير يومي — حرب العقول</b>`,
      `━━━━━━━━━━━━━━`,
      `👥 اللاعبون: ${stats.totalUsers}`,
      `🎮 ألعاب اليوم: ${stats.gamesToday}`,
      `🏆 أبطال اليوم: ${stats.topPlayer ?? "—"}`,
      `⚠️ بلاغات معلقة: ${stats.openReports}`,
      `🐛 أخطاء نشطة: ${stats.activeErrors}`,
      `📈 نشاط اليوم: ${stats.dailyActivity}%`,
      `━━━━━━━━━━━━━━`,
      `⏰ ${new Date().toLocaleDateString("ar-SA")}`,
    ].join("\n");

    const result = await sendTelegramMessage(config.token, config.chatId, text);
    return { success: result.ok === true };
  },
});

// ─── استقبال أوامر من تيليجرام (webhook) ─────────────────────────
export const telegramWebhook = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const message = body.message;
    if (!message || !message.text) {
      return new Response("ok");
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const senderName = message.from?.first_name ?? "مجهول";

    // Validate chat
    const config = await ctx.runQuery(api.telegramIntegration.getTelegramConfig);
    if (config && chatId !== config.chatId) {
      return new Response("ok");
    }

    let reply = "";
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const command = parts[0].toLowerCase();
      const params = parts.slice(1).join(" ");

      switch (command) {
        case "/start":
          reply = "🎮 مرحباً بك في بوت حرب العقول!\n\nالأوامر:\n/stats — إحصائيات\n/players — اللاعبون\n/games — الألعاب\n/broadcast <رسالة> — إذاعة\n/ban <id> — حظر\n/unban <id> — رفع حظر\n/cleanrooms — تنظيف\n/help — المساعدة";
          break;
        case "/help":
          reply = "🎮 أوامر البوت:\n/stats\n/players\n/games\n/broadcast\n/ban\n/unban\n/cleanrooms\n/report";
          break;
        case "/stats": {
          const s = await ctx.runQuery(api.telegramIntegration.getDailyStats);
          reply = `📊 إحصائيات:\n👥 اللاعبون: ${s.totalUsers}\n🎮 اليوم: ${s.gamesToday}\n📈 النشاط: ${s.dailyActivity}%\n⚠️ بلاغات: ${s.openReports}`;
          break;
        }
        case "/players": {
          const s = await ctx.runQuery(api.telegramIntegration.getDailyStats);
          reply = `👥 اللاعبون: ${s.totalUsers}`;
          break;
        }
        case "/games": {
          const s = await ctx.runQuery(api.telegramIntegration.getDailyStats);
          reply = `🎮 ألعاب اليوم: ${s.gamesToday}`;
          break;
        }
        case "/broadcast": {
          if (!params) { reply = "❌ اكتب الرسالة\nمثال: /broadcast مرحباً!"; break; }
          await ctx.runMutation(api.telegramIntegration.logTelegramNotification, {
            message: `إذاعة (${senderName}): ${params}`,
            priority: "medium",
            telegramResponse: "from_telegram",
          });
          reply = `✅ تم: ${params}`;
          break;
        }
        case "/ban": {
          if (!params) { reply = "❌ أدخل معرف المستخدم"; break; }
          try {
            await ctx.runMutation(api.telegramIntegration.executeTelegramCommand, {
              command: "ban", targetUserId: params.trim(),
            });
            reply = `✅ تم حظر ${params}`;
          } catch (e: unknown) {
            reply = `❌ ${e instanceof Error ? e.message : "خطأ"}`;
          }
          break;
        }
        case "/unban": {
          if (!params) { reply = "❌ أدخل معرف المستخدم"; break; }
          try {
            await ctx.runMutation(api.telegramIntegration.executeTelegramCommand, {
              command: "unban", targetUserId: params.trim(),
            });
            reply = `✅ تم رفع الحظر عن ${params}`;
          } catch (e: unknown) {
            reply = `❌ ${e instanceof Error ? e.message : "خطأ"}`;
          }
          break;
        }
        case "/cleanrooms": {
          try {
            const r = await ctx.runMutation(api.telegramIntegration.executeTelegramCommand, {
              command: "clean_stale_rooms",
            });
            reply = `✅ ${r}`;
          } catch (e: unknown) {
            reply = `❌ ${e instanceof Error ? e.message : "خطأ"}`;
          }
          break;
        }
        case "/report": {
          try {
            await ctx.runAction(api.telegramIntegration.sendDailyReport, {});
            reply = "✅ تم إرسال التقرير";
          } catch (e: unknown) {
            reply = `❌ ${e instanceof Error ? e.message : "خطأ"}`;
          }
          break;
        }
        default:
          reply = `❓ أمر غير معروف\nاكتب /help`;
      }

      if (config) {
        await sendTelegramMessage(config.token, chatId, reply);
      }
    }

    return new Response("ok");
  } catch {
    return new Response("ok");
  }
});

// ─── أوامر من المالك عبر الويب ──────────────────────────────────
export const executeTelegramCommandFromWeb = action({
  args: {
    command: v.string(),
    targetUserId: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { command, message }) => {
    switch (command) {
      case "send_report":
        await ctx.runAction(api.telegramIntegration.sendDailyReport, {});
        return { success: true, message: "تم إرسال التقرير" };
      case "broadcast":
        if (!message) throw new Error("يجب كتابة رسالة");
        await ctx.runAction(api.telegramIntegration.broadcastViaTelegram, { message });
        return { success: true, message: "تم الإذاعة" };
      case "alert":
        if (!message) throw new Error("يجب كتابة تنبيه");
        await ctx.runAction(api.telegramIntegration.sendTelegramAlert, { message, priority: "high" });
        return { success: true, message: "تم التنبيه" };
      default:
        throw new Error(`أمر غير معروف: ${command}`);
    }
  },
});

// ─── queries ──────────────────────────────────────────────────────
export const getTelegramConfig = query({
  args: {},
  handler: async (ctx) => {
    const tokenRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "telegramBotToken"))
      .first();
    const chatRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "telegramChatId"))
      .first();
    if (!tokenRow || !chatRow) return null;
    const token = JSON.parse(tokenRow.value) as string;
    const chatId = JSON.parse(chatRow.value) as string;
    if (!token || !chatId) return null;
    return { token, chatId };
  },
});

export const getDailyStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayMs = dayStart.getTime();

    const users = await ctx.db.query("users").collect();
    const games = await ctx.db.query("games").collect();
    const todayGames = games.filter((g) => g.createdAt > todayMs);

    const openReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const errors = await ctx.db.query("clientErrors").collect();
    const recentErrors = errors.filter((e) => e.lastSeen > now - 24 * 60 * 60 * 1000);

    const totalPlayers = users.length;
    const activeCount = new Set(
      (await ctx.db.query("gameHistory").collect())
        .filter((h) => h.playedAt > now - 7 * 24 * 60 * 60 * 1000)
        .map((h) => h.userId),
    ).size;
    const dailyActivity = totalPlayers > 0
      ? Math.min(100, Math.round((todayGames.length / Math.max(1, totalPlayers)) * 100))
      : 0;

    return {
      totalUsers: users.length,
      gamesToday: todayGames.length,
      topPlayer: todayGames.length > 0 ? `${todayGames.length} جولة اليوم` : null,
      openReports: openReports.length,
      activeErrors: recentErrors.length,
      dailyActivity,
    };
  },
});

export const getTelegramChatId = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "telegramChatId"))
      .first();
    if (!row) return null;
    return JSON.parse(row.value) as string;
  },
});

// ─── mutations ──────────────────────────────────────────────────
export const logTelegramNotification = mutation({
  args: {
    message: v.string(),
    priority: v.string(),
    telegramResponse: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("settings", {
      key: `tg_log_${Date.now()}`,
      value: JSON.stringify({ ...args, sentAt: Date.now() }),
    });
  },
});

export const executeTelegramCommand = mutation({
  args: {
    command: v.string(),
    targetUserId: v.optional(v.string()),
  },
  handler: async (ctx, { command, targetUserId }) => {
    const now = Date.now();

    if (command === "ban" && targetUserId) {
      const user = await ctx.db.get(targetUserId as any) as any;
      if (!user) throw new Error("المستخدم غير موجود");
      await ctx.db.patch(targetUserId as any, { bannedPermanent: true, banReason: "أمر من تيليجرام" });
      return `تم حظر ${user.name ?? "المستخدم"}`;
    }

    if (command === "unban" && targetUserId) {
      const user = await ctx.db.get(targetUserId as any) as any;
      if (!user) throw new Error("المستخدم غير موجود");
      await ctx.db.patch(targetUserId as any, { bannedPermanent: false, banReason: undefined });
      return `تم رفع الحظر عن ${user.name ?? "المستخدم"}`;
    }

    if (command === "clean_stale_rooms") {
      const games = await ctx.db.query("games").collect();
      let cleaned = 0;
      for (const g of games) {
        if (g.status === "waiting" && now - g.createdAt > 3 * 60 * 60 * 1000) {
          await ctx.db.delete(g._id);
          cleaned++;
        }
      }
      return `تم تنظيف ${cleaned} غرفة قديمة`;
    }

    throw new Error(`أمر غير معروف: ${command}`);
  },
});
