// signup2.js (VERBOSE, full-featured)
// SDK version: 12.2.1 (ensure firebase-login.js uses the same version)

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Import auth and db from your firebase-login.js (must export them)
import { auth, db } from "./firebase-login.js";

/*
  Expected DOM IDs in signup.html:
  - signupForm2
  - name
  - email
  - password
  - resendVerificationBtn
  - goToLoginBtn
  - googleSignupBtn
  - toastContainer
*/

// --------------------------- DOM refs ---------------------------
const signupForm = document.getElementById("signupForm2");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
let resendBtn = document.getElementById("resendVerificationBtn");
const goToLoginBtn = document.getElementById("goToLoginBtn");
const googleSignupBtn = document.getElementById("googleSignupBtn");
let toastContainer = document.getElementById("toastContainer");

// ensure toast container exists (create fallback if not)
if (!toastContainer) {
  toastContainer = document.createElement("div");
  toastContainer.id = "toastContainer";
  toastContainer.style.position = "fixed";
  toastContainer.style.top = "18px";
  toastContainer.style.right = "18px";
  toastContainer.style.zIndex = "99999";
  document.body.appendChild(toastContainer);
}

// If resend button not found, create fallback so UI will work
if (!resendBtn) {
  resendBtn = document.createElement("button");
  resendBtn.id = "resendVerificationBtn";
  resendBtn.textContent = "Resend Verification";
  // basic styles
  resendBtn.style.display = "none";
  resendBtn.style.marginTop = "10px";
  resendBtn.style.padding = "10px";
  resendBtn.style.borderRadius = "6px";
  resendBtn.style.border = "none";
  resendBtn.style.background = "black";
  resendBtn.style.color = "white";
  signupForm?.insertAdjacentElement("afterend", resendBtn);
}

// --------------------------- helper UI functions ---------------------------
function showToast(message, success = true, opts = {}) {
  // inline styling to ensure visibility even if page CSS overrides things
  const div = document.createElement("div");
  div.className = `sg-toast ${success ? "success" : "error"}`;
  div.textContent = message;

  // Inline fallback style (explicit) to avoid theme blending
  div.style.backgroundColor = success ? "#16a34a" : "#dc2626"; // green / red
  div.style.color = "#ffffff";
  div.style.padding = "10px 14px";
  div.style.borderRadius = "8px";
  div.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  div.style.fontWeight = "600";
  div.style.marginTop = "8px";
  div.style.maxWidth = "360px";
  div.style.zIndex = "100000";

  toastContainer.appendChild(div);
  setTimeout(() => {
    try { div.remove(); } catch (e) {}
  }, opts.duration || 4500);
}

function disableFormInputs() {
  if (!signupForm) return;
  signupForm.querySelectorAll("input, button").forEach((el) => {
    // keep google and goToLogin clickable (these are outside form normally)
    if (el.id === "googleSignupBtn" || el.id === "goToLoginBtn") return;
    el.disabled = true;
  });
}

function enableFormInputs() {
  if (!signupForm) return;
  signupForm.querySelectorAll("input, button").forEach((el) => el.disabled = false);
}

// --------------------------- resend cooldown ---------------------------
let cooldown = false;
let cooldownInterval = null;

function startResendCooldown(seconds = 30) {
  if (!resendBtn) return;
  cooldown = true;
  let t = seconds;
  resendBtn.disabled = true;
  resendBtn.style.display = "inline-block";
  resendBtn.textContent = `Resend in ${t}s`;
  resendBtn.style.background = "gray";

  cooldownInterval && clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(cooldownInterval);
      cooldown = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification";
      resendBtn.style.background = "black";
    } else {
      resendBtn.textContent = `Resend in ${t}s`;
    }
  }, 1000);
}

// helper to ensure Firestore user doc exists (merge so not overwrite)
async function ensureUserDoc(uid, data) {
  try {
    await setDoc(doc(db, "users", uid), data, { merge: true });
  } catch (err) {
    console.warn("Failed to write user doc:", err);
  }
}

// --------------------------- core logic ---------------------------

/**
 * Strong requirement from you:
 * - NEVER show "email already in use".
 * - If email exists, always respond by attempting to resend verification (if possible).
 * - If we cannot sign the user in with password (wrong pass), automatically send a password reset email
 *   and inform the user to reset & verify — so they are not blocked by an "already in use" message.
 */

// Handler for signup form submit
signupForm?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const name = (nameInput?.value || "").trim();
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  if (!email || !password) {
    showToast("Please enter email and password.", false);
    return;
  }

  try {
    // 1) Check sign-in methods to see if email is already registered
    let methods = [];
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (fetchErr) {
      // fetch error (network or invalid), still proceed to try to create account,
      // but warn user if it's a network issue.
      if (fetchErr?.code === "auth/network-request-failed") {
        showToast("Network error - check connection and try again.", false);
        return;
      }
      console.warn("fetchSignInMethodsForEmail error:", fetchErr);
    }

    // 2) If methods found => email already registered with some provider(s)
    if (methods && methods.length > 0) {
      // If it includes password provider, try sign-in with the provided password and resend verification
      if (methods.includes("password")) {
        // Try to sign in with provided password to gain a User object and resend verification
        try {
          const signInResult = await signInWithEmailAndPassword(auth, email, password);
          const user = signInResult.user;

          // If user is already verified -> just inform them to login
          if (user.emailVerified) {
            showToast("This email is already verified. Please log in.", false);
            return;
          }

          // Not verified -> resend verification email
          await sendEmailVerification(user);
          showToast("Account exists but not verified — verification email resent. Check inbox (and spam).", true);

          // Ensure user document exists in Firestore
          await ensureUserDoc(user.uid, { name: name || user.displayName || "User", email, role: "user" });

          // disable the form and start resend cooldown UI
          disableFormInputs();
          startResendCooldown(30);
          return;
        } catch (signInErr) {
          // sign-in failed (likely wrong password)
          // Instead of showing 'email already in use', send a password reset email automatically
          if (signInErr?.code === "auth/wrong-password" || signInErr?.code === "auth/invalid-login") {
            try {
              await sendPasswordResetEmail(auth, email);
              showToast("Account exists. We couldn't sign you in — a password reset email was sent so you can regain access and verify.", true);
              // do NOT display "email already in use" — we handled it gracefully
              return;
            } catch (resetErr) {
              // couldn't send reset (network or other)
              if (resetErr?.code === "auth/network-request-failed") {
                showToast("Network error while sending reset email. Try again later.", false);
              } else {
                showToast("Could not send reset email: " + (resetErr.message || resetErr), false);
              }
              return;
            }
          }

          // other sign-in errors: show friendly message but not "already in use"
          showToast(signInErr.message || "Account exists — please try to login or reset password.", false);
          return;
        }
      }

      // methods present but NOT password (for example: google.com only)
      // Tell the user to sign in with Google in that case
      if (methods.includes("google.com") && !methods.includes("password")) {
        showToast("An account exists using Google sign-in. Please use 'Sign up with Google' (or login with Google).", false);
        return;
      }

      // fallback: some other provider exists — we'll suggest password reset (safe option)
      try {
        await sendPasswordResetEmail(auth, email);
        showToast("Account exists. Sent a password-reset email so you can regain access and verify.", true);
      } catch (fallbackErr) {
        if (fallbackErr?.code === "auth/network-request-failed") {
          showToast("Network error. Try again later.", false);
        } else {
          showToast("Account exists. Please try signing in or resetting your password.", false);
        }
      }
      return;
    }

    // 3) methods.length === 0 => new email — proceed to create user
    let newUserCredential;
    try {
      newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (createErr) {
      // Rare case: create failed (e.g. network), handle gracefully
      if (createErr?.code === "auth/network-request-failed") {
        showToast("Network error while creating account. Check connection and try again.", false);
        return;
      }
      // For any other create error, show message (do not show raw 'already in use' as that was handled above)
      showToast("Could not create account: " + (createErr.message || createErr), false);
      return;
    }

    const newUser = newUserCredential.user;

    // Save user document in Firestore (uid as doc id)
    try {
      await setDoc(doc(db, "users", newUser.uid), {
        name: name || "User",
        email,
        role: "user",
      }, { merge: true });
    } catch (fsErr) {
      console.warn("Failed to write Firestore user doc:", fsErr);
      // Continue anyway — user created, still send verification
    }

    // Send verification email to new user
    try {
      await sendEmailVerification(newUser);
      showToast("Verification email sent. Please check your inbox (and spam).", true);
      disableFormInputs();
      startResendCooldown(30);
    } catch (verr) {
      if (verr?.code === "auth/network-request-failed") {
        showToast("Network error while sending verification. Try again.", false);
      } else {
        showToast("Verification email could not be sent: " + (verr.message || verr), false);
      }
    }
  } catch (outerErr) {
    // catch-all (very defensive)
    console.error("Unhandled signup error:", outerErr);
    showToast("Signup failed: " + (outerErr.message || outerErr), false);
  }
});

// --------------------------- Resend button handler ---------------------------
resendBtn?.addEventListener("click", async (ev) => {
  ev.preventDefault();
  if (!resendBtn || cooldown) return;

  // Prefer current signed-in user
  let user = auth.currentUser;
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  try {
    if (!user) {
      // Not signed in — try to sign in silently (using provided email+password)
      if (!email) {
        showToast("Please enter your email (and password if you remember) to resend.", false);
        return;
      }
      try {
        if (password) {
          const signInResult = await signInWithEmailAndPassword(auth, email, password);
          user = signInResult.user;
        } else {
          // No password: send reset email so user can login and verify
          await sendPasswordResetEmail(auth, email);
          showToast("No password provided. Sent password reset email so you can sign in & verify.", true);
          startResendCooldown(30);
          return;
        }
      } catch (signErr) {
        // If cannot sign in (wrong password), send password reset automatically (to avoid "already in use")
        if (signErr?.code === "auth/wrong-password") {
          try {
            await sendPasswordResetEmail(auth, email);
            showToast("Wrong password. Password reset email sent — use it to log in and verify.", true);
            startResendCooldown(30);
            return;
          } catch (resetErr) {
            showToast("Cannot send reset email: " + (resetErr.message || resetErr), false);
            return;
          }
        } else if (signErr?.code === "auth/network-request-failed") {
          showToast("Network error. Try again later.", false);
          return;
        } else {
          showToast("Could not sign in to resend verification: " + (signErr.message || signErr), false);
          return;
        }
      }
    }

    // At this point `user` should be available
    if (!user) {
      showToast("Unable to locate account. Try signing up or contact support.", false);
      return;
    }

    if (user.emailVerified) {
      showToast("Email already verified. Please login.", true);
      return;
    }

    // send verification
    await sendEmailVerification(user);
    showToast("Verification email resent. Check inbox & spam.", true);
    startResendCooldown(30);
  } catch (err) {
    console.error("Resend error:", err);
    if (err?.code === "auth/network-request-failed") {
      showToast("Network error. Try again later.", false);
    } else {
      showToast("Could not resend verification: " + (err.message || err), false);
    }
  }
});

// --------------------------- Google signup ---------------------------
googleSignupBtn?.addEventListener("click", async (ev) => {
  ev?.preventDefault();
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Ensure a Firestore user doc exists (merge so we don't overwrite)
    await ensureUserDoc(user.uid, {
      name: user.displayName || "User",
      email: user.email || "",
      role: "user",
      verified: !!user.emailVerified
    });

    showToast("Signed in with Google. Redirecting...", true);
    // redirect to the appropriate page (you can change target)
    setTimeout(() => (window.location.href = "index.html"), 700);
  } catch (err) {
    console.error("Google signup error:", err);
    if (err?.code === "auth/network-request-failed") {
      showToast("Network error when performing Google sign-in. Try again.", false);
    } else {
      showToast("Google sign-in failed: " + (err.message || err), false);
    }
  }
});

// --------------------------- go to login link ---------------------------
goToLoginBtn?.addEventListener("click", (ev) => {
  ev?.preventDefault();
  window.location.href = "login.html";
});
