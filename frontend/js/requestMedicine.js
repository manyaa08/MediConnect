console.log("REQUEST MEDICINE JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("requestForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const medicine_name = document.getElementById("medicine").value;
    const required_quantity = document.getElementById("quantity").value;
    const urgency = document.getElementById("urgency").value;

    const btn = form.querySelector("button");
    const originalText = btn.innerText;

    btn.innerText = "Submitting...";
    btn.disabled = true;

    try {
      console.log("🚀 SENDING REQUEST:", `${API_BASE_URL}/requests/create`);
      const res = await fetch(`${API_BASE_URL}/requests/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          medicine_name,
          required_quantity,
          urgency
        })
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to create request");
      }

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Medicine Request Created Successfully!',
        showConfirmButton: false,
        timer: 1500
      }).then(() => {
        window.location.href = "ngo.html";
      });

    } catch (err) {
      console.error("ERROR:", err);
      Swal.fire('Error', err.message || 'Failed to connect to server.', 'error');
      btn.innerText = originalText;
      btn.disabled = false;
    }
  });
});
