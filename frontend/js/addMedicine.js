console.log("ADD MEDICINE JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";

// 🔐 Check login
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

function showAlert(config) {
  if (typeof Swal !== "undefined") {
    return Swal.fire(config);
  }
  alert(config.text || config.title);
}

document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("addMedicineForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const medicine_name = document.getElementById("name").value;
    const batch_number = document.getElementById("batch").value;
    const expiry_date = document.getElementById("expiry").value;
    const quantity = document.getElementById("quantity").value;
    const category = document.getElementById("category").value;

    const btn = form.querySelector("button");
    const originalText = btn.innerText;

    btn.innerText = "Adding...";
    btn.disabled = true;

    try {
      console.log("🚀 Sending request...");

      const res = await fetch(`${API_BASE_URL}/medicines/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          medicine_name,
          batch_number,
          expiry_date,
          quantity,
          category
        })
      });

      const text = await res.text();
      console.log("RESPONSE:", text);

      if (!res.ok) {
        await showAlert({
          icon: "error",
          title: "Error",
          text: text || "Failed to add medicine"
        });

        btn.innerText = originalText;
        btn.disabled = false;
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Success",
        text: "Medicine Added Successfully!",
        timer: 1500,
        showConfirmButton: false
      });

      window.location.href = "donorInventory.html";

    } catch (error) {
      console.error("ERROR:", error);

      await showAlert({
        icon: "error",
        title: "Connection Error",
        text: "Server unreachable"
      });

      btn.innerText = originalText;
      btn.disabled = false;
    }
  });

});