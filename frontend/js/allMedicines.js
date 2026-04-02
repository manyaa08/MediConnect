console.log("ALL MEDICINES JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

async function loadAllMedicines() {
  try {
    console.log("🚀 FETCHING ALL AVAILABLE MEDICINES:", `${API_BASE_URL}/medicines/all-available`);
    const res = await fetch(`${API_BASE_URL}/medicines/all-available`, {
      headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    console.log("RESPONSE:", data);

    if (!res.ok) {
      throw new Error(data.message || "Failed to load medicines");
    }

    const table = document.getElementById("medicineTable");
    table.innerHTML = "";

    if (!data || data.length === 0) {
      table.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No available medicines found at the moment.</td></tr>`;
      return;
    }

    data.forEach(med => {
      let rowColor = "";
      let badgeClass = "bg-success";
      let statusLabel = "Valid";

      const today = new Date();
      const expiry = new Date(med.expiry_date);
      const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) {
        rowColor = "table-danger opacity-75";
        badgeClass = "bg-danger";
        statusLabel = "Expired";
      } else if (diffDays < 30) {
        rowColor = "table-warning";
        badgeClass = "bg-warning text-dark";
        statusLabel = "Expiring Soon";
      }

      table.innerHTML += `
        <tr class="${rowColor}">
          <td class="fw-medium">${med.medicine_name}</td>
          <td class="text-muted small">${med.batch_number}</td>
          <td>
            <div class="fw-bold text-dark">${med.expiry_date.split('T')[0]}</div>
            <span class="badge ${badgeClass} mt-1" style="font-size: 0.65rem;">${statusLabel}</span>
          </td>
          <td class="fw-bold text-primary">${med.quantity}</td>
          <td><span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">${med.category}</span></td>
          <td class="small fw-medium">${med.donor_name}</td>
          <td class="text-muted small"><i class="bi bi-geo-alt-fill me-1"></i>${med.city}</td>
        </tr>
      `;
    });

  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Could not load medicines. Server may be down.', 'error');
    }
  }
}

document.addEventListener("DOMContentLoaded", loadAllMedicines);
