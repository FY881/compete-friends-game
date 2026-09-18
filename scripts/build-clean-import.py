#!/usr/bin/env python3
# يبني حزمة استيراد "المهم فقط" من تصدير Convex الكامل
# كل جدول غير موجود في قائمة الحفظ يُحذف نهائياً عند الاستيراد بـ --replace-all
import os, shutil, zipfile, sys

SRC = "/tmp/convex_snapshot"      # التصدير الكامل المفكوك
DST = "/tmp/clean_import"         # حزمة المهم فقط

KEEP = set("""
authAccounts authSessions authRefreshTokens authVerifiers authVerificationCodes authRateLimits
users profiles profileCustomization siteRoles siteBans reputation favorites
settings playerSettings settingsJournal maintenanceMode systemFlags configSnapshots
apiKeys apiRegistry apiPromptTemplates apiCircuit
memberships membershipCredits membershipBoosts membershipCodes membershipPrestige
membershipTrials membershipQuestClaims membershipEvents
loyaltyWallets loyaltyLedger storeLedger
notificationPrefs notificationTiers
questionPacks questionArchive aiQuestions aiSuggestions
cosmetics achievements dailyBoxes dailyChallenges dailyChallengeBoard dailyQuests questClaims personalChallenges
minds mindBonds mindSpecializations mindEvolution mindHonorLog
arenaRatings arenaSeasonPlayers arenaSeasons
leagues leagueMembers clans clanUpgrades clanTreasury clanWars memberSquads squadSeats
tournaments tournamentEntries seasons seasonScores seasonPasses worldChampionships hallOfFame liveEvents
chatRooms savedMessages invites
rules onlineRules reports appeals
referralCodes referrals
renewalOffers renewalPrefs promoCodes promoRedemptions
perkVault perkShares perkVaultOpens
sovereignModerators sovereignSectionLocks sovereignDecrees sovereignEdicts sovereignLessons sovereignCampaigns
viceOwnerSystems viceOwnerSessions
aiAgents aiHubUnits assistantWorld
governorBans governorRequests
boosts apkRelease collectiveGoals
""".split())

if os.path.exists(DST):
    shutil.rmtree(DST)
os.makedirs(DST)

kept, wiped, kept_bytes = [], [], 0
for d in sorted(os.listdir(SRC)):
    src_dir = os.path.join(SRC, d)
    if not os.path.isdir(src_dir):
        continue
    if d in KEEP or d == "_tables" or d == "_storage":
        shutil.copytree(src_dir, os.path.join(DST, d))
        f = os.path.join(src_dir, "documents.jsonl")
        if os.path.exists(f):
            n = sum(1 for _ in open(f))
            sz = os.path.getsize(f)
            kept.append((sz, n, d))
            if d != "_tables":
                kept_bytes += sz
    else:
        f = os.path.join(src_dir, "documents.jsonl")
        n = sum(1 for _ in open(f)) if os.path.exists(f) else 0
        wiped.append((n, d))

kept.sort(reverse=True)
wiped.sort(reverse=True)
print("=== سيُحفظ (%d جدولاً، %.2f MB) ===" % (len(kept), kept_bytes / 1048576))
for sz, n, d in kept[:15]:
    print("  %8.1fKB %6d صف  %s" % (sz / 1024, n, d))
print("=== سيُمحى نهائياً (%d جدولاً) ===" % len(wiped))
for n, d in wiped[:25]:
    print("  %6d صف  %s" % (n, d))

zip_path = "/tmp/clean_import.zip"
if os.path.exists(zip_path):
    os.remove(zip_path)
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(DST):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, DST))
print("OK ->", zip_path, "%.2f MB" % (os.path.getsize(zip_path) / 1048576))
