console.log("REGISTER JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000"; // backend URL

function showAlert(config) {
  if (typeof Swal !== "undefined") {
    return Swal.fire(config);
  }

  window.alert(config.text || config.title || "Action completed");
  return Promise.resolve();
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("FORM SUBMITTED");

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    const city = document.getElementById("city").value;

    const btn = document.querySelector("#registerForm button");
    const originalText = btn.innerText;

    btn.innerText = "Signing Up...";
    btn.disabled = true;

    try {
      console.log("🚀 CALLING API:", `${API_BASE_URL}/users/register`);

      const res = await fetch(`${API_BASE_URL}/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password, role, city })
      });

      console.log("STATUS:", res.status);

      const data = await res.json();
      console.log("RESPONSE:", data);

      if (!res.ok) {
        await showAlert({
          icon: "error",
          title: "Registration Failed",
          text: data.message || "Registration failed"
        });

        btn.innerText = originalText;
        btn.disabled = false;
        return;
      }

      await showAlert({
        icon: "success",
        title: "Welcome!",
        text: data.message || "Registration successful!",
        timer: 2000,
        showConfirmButton: false
      });

      window.location.href = "login.html";

    } catch (error) {
      console.error("ERROR:", error);

      await showAlert({
        icon: "error",
        title: "Connection Error",
        text: "Could not connect to the server. Is it running?"
      });

      btn.innerText = originalText;
      btn.disabled = false;
    }
  });
});