import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase-login.js";

// ---- DOM
const form = document.getElementById("signupForm2");
const toast = document.getElementById("toastContainer");
const resendBtn = document.getElementById("resendVerificationBtn");
const goToLoginBtn = document.getElementById("goToLoginBtn");
const googleSignupBtn = document.getElementById("googleSignupBtn");
const verifyEmailBtn = document.getElementById("verifyEmailBtn");
const verifyEmailInput = document.getElementById("verifyEmailInput");

let cooldown = false;

// ---- Toast
function showToast(msg, ok = true) {
  const div = document.createElement("div");
  div.className = `p-3 rounded-lg shadow-md mt-3 text-center font-semibold ${
    ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
  }`;
  div.textContent = msg;
  (toast || document.body).appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function styleButton(btn) {
  if (!btn) return;
  btn.classList.add(
    "px-4","py-2","bg-black","text-white","rounded-lg","shadow",
    "hover:opacity-80","transition","duration-300","font-semibold","w-full","mt-3"
  );
}
[resendBtn, goToLoginBtn, googleSignupBtn, verifyEmailBtn].forEach(styleButton);

// ---- Email/Password Signup
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = (document.getElementById("name")?.value || "").trim();
  const email = (document.getElementById("email")?.value || "").trim();
  const password = document.getElementById("password")?.value || "";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    await sendEmailVerification(user);
    await setDoc(doc(db, "users", user.uid), { email, name, role: "user" });

    showToast(`Verification email sent to ${email}`, true);
    resendBtn && (resendBtn.disabled = false);
    startCooldown();
    form.reset();
  } catch (err) {
    showToast(err.message || "Signup failed", false);
  }
});

// ---- Resend verification
resendBtn?.addEventListener("click", async () => {
  if (cooldown) return;
  const user = auth.currentUser;
  if (!user) return showToast("Please sign up or log in first.", false);

  try {
    await sendEmailVerification(user);
    showToast("Verification email resent.");
    startCooldown();
  } catch (err) {
    showToast("Resend error: " + (err.message || ""), false);
    startCooldown();
  }
});

// ---- Manual verify (re-sends to current user)
verifyEmailBtn?.addEventListener("click", async () => {
  const email = verifyEmailInput?.value.trim();
  if (!email) return showToast("Please enter a valid email.", false);

  const user = auth.currentUser;
  if (!user) return showToast("Please log in first.", false);

  if (user.email === email) {
    try {
      await sendEmailVerification(user);
      showToast("Verification email sent again.");
    } catch (err) {
      showToast("Error: " + (err.message || ""), false);
    }
  } else {
    showToast("Login again with this email to resend verification.", false);
  }
});

// ---- Google signup
googleSignupBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email || "",
      name: user.displayName || "User",
      role: "user"
    });

    showToast("✅ Google Sign Up successful! Redirecting...");
    setTimeout(() => (window.location.href = "dashboard.html"), 800);
  } catch (err) {
    showToast("Google signup failed: " + (err.message || ""), false);
  }
});

// ---- Go to login
goToLoginBtn?.addEventListener("click", () => {
  window.location.href = "login.html";
});

// ---- Cooldown
function startCooldown() {
  if (!resendBtn) return;
  cooldown = true;
  let timer = 30;
  resendBtn.textContent = `Wait ${timer}s`;
  resendBtn.disabled = true;
  resendBtn.classList.remove("bg-black");
  resendBtn.classList.add("bg-gray-400");

  const it = setInterval(() => {
    timer--;
    resendBtn.textContent = `Wait ${timer}s`;
    if (timer <= 0) {
      clearInterval(it);
      cooldown = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification";
      resendBtn.classList.remove("bg-gray-400");
      resendBtn.classList.add("bg-black","hover:opacity-80");
    }
  }, 1000);
}
