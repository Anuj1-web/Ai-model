// signup2.js

import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  onAuthStateChanged,
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

// ✅ Toast UI with background
function showToast(msg, success = true) {
  const div = document.createElement("div");
  div.className = `p-3 rounded-lg shadow-md mt-3 text-center font-semibold ${
    success ? "bg-green-600 text-white" : "bg-red-600 text-white"
  }`;
  div.textContent = msg;
  toast.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

// ✅ Button styling
function styleButton(btn) {
  if (!btn) return;
  btn.classList.add(
    "px-4", "py-2", "bg-black", "text-white",
    "rounded-lg", "shadow", "hover:opacity-80",
    "transition", "duration-300", "font-semibold",
    "w-full", "mt-3"
  );
}
[resendBtn, goToLoginBtn, googleSignupBtn].forEach(styleButton);

// ✅ Signup Form Submit
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // First check if email already exists
    const methods = await fetchSignInMethodsForEmail(auth, email);

    if (methods.length > 0) {
      // Email exists, try signing in and sending verification again
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        if (!user.emailVerified) {
          await sendEmailVerification(user);
          showToast(`Verification link re-sent to ${email}`, true);
          startCooldown();
        } else {
          showToast("Email already verified. Please login.", false);
        }
      } catch (err) {
        showToast("This email already exists. Try logging in.", false);
      }
      return;
    }

    // If new user → create account
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    await sendEmailVerification(user);
    await setDoc(doc(db, "users", user.uid), {
      email,
      name,
      role: "user"
    });

    showToast(`Verification email sent to ${email}`, true);
    startCooldown();
    form.reset();

  } catch (error) {
    showToast(error.message, false);
  }
});

// ✅ Resend Verification Email
resendBtn?.addEventListener("click", async () => {
  if (cooldown) return;
  const user = auth.currentUser;
  if (user) {
    try {
      await sendEmailVerification(user);
      showToast("Verification email resent.", true);
      startCooldown();
    } catch (error) {
      showToast("Resend error: " + error.message, false);
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

// ✅ Cooldown Timer
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

// ✅ Auto Redirect after Verification
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await user.reload();
    if (user.emailVerified) {
      showToast("Email verified! Redirecting to login...", true);
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    }
  }
});
