// signup2.js (Enhanced: resend verification for existing unverified users)
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getFirestore,
  doc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { app } from './firebase-login.js';

const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("signupForm2");
const toast = document.getElementById("toastContainer");
const resendBtn = document.getElementById("resendVerificationBtn");
const goToLoginBtn = document.getElementById("goToLoginBtn");
const googleSignupBtn = document.getElementById("googleSignupBtn");

let cooldown = false;

// ✅ Toast
function showToast(msg, success = true) {
  const div = document.createElement("div");
  div.className = `p-3 rounded-lg shadow-md mt-3 text-center font-semibold max-w-xs mx-auto ${
    success ? "bg-green-600 text-white" : "bg-red-600 text-white"
  }`;
  div.style.zIndex = "9999";
  div.textContent = msg;
  toast.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ✅ Button styling
function styleButton(btn) {
  if (!btn) return;
  btn.classList.add(
    "px-4",
    "py-2",
    "bg-black",
    "text-white",
    "rounded-lg",
    "shadow",
    "hover:opacity-80",
    "transition",
    "duration-300",
    "font-semibold",
    "w-full",
    "mt-3"
  );
}
[resendBtn, goToLoginBtn, googleSignupBtn].forEach(styleButton);

// ✅ Signup with email/password
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    await sendEmailVerification(user);
    await setDoc(doc(db, "users", user.uid), {
      email,
      name,
      role: "user"
    });

    showToast(`Verification email sent to ${email}`, true);
    disableForm();
    enableResend();
  } catch (error) {
    // ✅ Handle case: user exists but not verified
    if (error.code === "auth/email-already-in-use") {
      try {
        const existingUser = await signInWithEmailAndPassword(auth, email, password);
        if (!existingUser.user.emailVerified) {
          await sendEmailVerification(existingUser.user);
          showToast("Email already registered but not verified. Verification link resent.");
          disableForm();
          enableResend();
          return;
        } else {
          showToast("This email is already verified. Please login instead.", false);
        }
      } catch (signInError) {
        showToast(signInError.message, false);
      }
    } else {
      showToast(error.message, false);
    }
  }
});

// ✅ Resend Verification Email
resendBtn?.addEventListener("click", async () => {
  if (cooldown) return;

  const user = auth.currentUser;
  if (user) {
    try {
      await sendEmailVerification(user);
      showToast("Verification email resent.");
      startCooldown();
    } catch (error) {
      showToast("Resend error: " + error.message, false);
      if (error.code === "auth/too-many-requests") {
        startCooldown();
      }
    }
  } else {
    showToast("Please sign up or login first.", false);
  }
});

// ✅ Google Signup
googleSignupBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      name: user.displayName || "User",
      role: "user"
    });

    showToast("✅ Google Sign Up successful! Redirecting...");
    setTimeout(() => (window.location.href = "dashboard.html"), 1000);
  } catch (err) {
    showToast("Google signup failed: " + err.message, false);
  }
});

// ✅ Go to Login
goToLoginBtn?.addEventListener("click", () => {
  window.location.href = "login.html";
});

// ✅ Helpers
function disableForm() {
  form.querySelectorAll("input, button").forEach(el => el.disabled = true);
}

function enableResend() {
  resendBtn.disabled = false;
  startCooldown();
}

function startCooldown() {
  cooldown = true;
  let timer = 30;
  resendBtn.textContent = `Wait ${timer}s`;
  resendBtn.disabled = true;
  resendBtn.classList.remove("bg-black");
  resendBtn.classList.add("bg-gray-400");

  const interval = setInterval(() => {
    timer--;
    resendBtn.textContent = `Wait ${timer}s`;
    if (timer <= 0) {
      clearInterval(interval);
      cooldown = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification";
      resendBtn.classList.remove("bg-gray-400");
      resendBtn.classList.add("bg-black", "hover:opacity-80");
    }
  }, 1000);
}
