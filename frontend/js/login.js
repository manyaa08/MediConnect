console.log("LOGIN JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";

function showAlert(config) {
  if (typeof Swal !== "undefined") {
    return Swal.fire(config);
  }
  window.alert(config.text || config.title || "Action completed");
  return Promise.resolve();
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const btn = document.querySelector("#loginForm button");
    const originalText = btn.innerText;

    btn.innerText = "Signing In...";
    btn.disabled = true;

    try {
      console.log("🚀 CALLING API:", `${API_BASE_URL}/users/login`);

      const res = await fetch(`${API_BASE_URL}/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      console.log("RESPONSE:", data);

      // ❌ Handle login failure
      if (!res.ok) {
        await showAlert({
          icon: "error",
          title: "Login Failed",
          text: data.message || "Invalid credentials"
        });

        btn.innerText = originalText;
        btn.disabled = false;
        return;
      }

      // ✅ Store user info
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // ✅ Success alert + redirect AFTER alert closes
      Swal.fire({
        icon: "success",
        title: "Welcome Back!",
        text: data.message || "Login successful!",
        timer: 1200,
        showConfirmButton: false
      }).then(() => {
        const role = data.user.role;

        if (role === "Donor") {
          window.location.href = "donorInventory.html";
        } else if (role === "NGO") {
          window.location.href = "ngo.html";
        } else {
          alert("Unknown role");
        }
      });

    } catch (error) {
      console.error("ERROR:", error);

      // ✅ Only show if real connection issue
      await showAlert({
        icon: "error",
        title: "Connection Error",
        text: "Could not connect to the server. Please try again."
      });

      btn.innerText = originalText;
      btn.disabled = false;
    }
  });
});