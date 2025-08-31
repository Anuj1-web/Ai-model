// signup2.js
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
const googleSignupBtn = document.getElementById("googleSignupBtn");

let cooldown = false;

// ✅ Toast
function showToast(msg, success = true) {
  const div = document.createElement("div");
  div.style.background = success ? "#16a34a" : "#dc2626";
  div.style.color = "white";
  div.style.padding = "12px";
  div.style.borderRadius = "8px";
  div.style.marginTop = "8px";
  div.style.fontWeight = "600";
  div.style.textAlign = "center";
  div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  div.textContent = msg;
  toast.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ✅ Style button
function styleButton(btn) {
  if (!btn) return;
  btn.classList.add(
    "px-4", "py-2", "bg-black", "text-white", "rounded-lg",
    "shadow", "hover:opacity-80", "transition", "duration-300",
    "font-semibold", "w-full", "mt-3"
  );
}
styleButton(resendBtn);
styleButton(googleSignupBtn);

resendBtn.style.display = "none";

// ✅ Signup / Re-send Verification
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // Try creating a new user
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    await setDoc(doc(db, "users", user.uid), { email, name, role: "user" });
    await sendEmailVerification(user);

    showToast(`Verification email sent to ${email}`, true);
    resendBtn.style.display = "block";
    startCooldown();
    form.reset();

  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      // Try signing in to re-send verification
      try {
        const loginCred = await signInWithEmailAndPassword(auth, email, password);
        const user = loginCred.user;

        if (!user.emailVerified) {
          await sendEmailVerification(user);
          showToast("Email already registered. Verification link resent!", true);
          resendBtn.style.display = "block";
          startCooldown();
        } else {
          showToast("This email is already verified. Please login instead.", false);
        }
      } catch (loginError) {
        if (loginError.code === "auth/wrong-password") {
          showToast("Email already exists. Wrong password. Try reset password.", false);
        } else {
          showToast("Error: " + loginError.message, false);
        }
      }
    } else {
      showToast("Signup failed: " + error.message, false);
    }
  }
});

// ✅ Resend Verification
resendBtn?.addEventListener("click", async () => {
  if (cooldown) return;
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    try {
      await sendEmailVerification(user);
      showToast("Verification email resent.");
      startCooldown();
    } catch (error) {
      showToast("Error: " + error.message, false);
    }
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
    showToast("Google signup successful! Redirecting...");
    setTimeout(() => (window.location.href = "index.html"), 1000);
  } catch (err) {
    showToast("Google signup failed: " + err.message, false);
  }
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
