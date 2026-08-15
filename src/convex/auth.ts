// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

// «حساب بالاسم والرمز السري» — تسجيل دخول بدون بريد نهائياً:
// اسم دخول فريد + رمز سري (6 خانات فأكثر) = حسابك على أي جهاز.
// اسم الدخول نفسه يعمل كمعرّف الحساب الفريد (بديل البريد).
const passwordProvider = Password({
  id: "password",
  validatePasswordRequirements(password) {
    if (password.length < 6) {
      throw new Error("الرمز السري يجب أن يكون 6 خانات على الأقل");
    }
  },
  profile(params) {
    const raw = (params.username as string | undefined) ?? "";
    const username = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    if (username.length < 3) {
      throw new Error("اسم الدخول يجب أن يكون 3 أحرف على الأقل");
    }
    return { name: username, email: username };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous, passwordProvider],
});