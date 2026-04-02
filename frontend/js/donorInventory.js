console.log("DONOR INVENTORY JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

async function loadInventory() {
  try {
    console.log("🚀 FETCHING INVENTORY:", `${API_BASE_URL}/medicines/my-medicines`);
    const res = await fetch(`${API_BASE_URL}/medicines/my-medicines`, {
      headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    console.log("RESPONSE:", data);

    if (!res.ok) {
      throw new Error(data.message || "Failed to load inventory");
    }

    const table = document.getElementById("inventoryTable");
    table.innerHTML = "";

    if (!data || data.length === 0) {
      document.getElementById("statAvailable").innerText = 0;
      document.getElementById("statQuantity").innerText = 0;
      document.getElementById("statExpiring").innerText = 0;
      table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Your inventory is empty. Add some medicines!</td></tr>`;
      return;
    }

    let totalUnits = 0;
    let expiringCount = 0;
    
    data.forEach(med => {
      totalUnits += med.quantity;
      const today = new Date();
      const expiry = new Date(med.expiry_date);
      const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);
      if (diffDays < 30) expiringCount++;
    });

    document.getElementById("statAvailable").innerText = data.length;
    document.getElementById("statQuantity").innerText = totalUnits;
    document.getElementById("statExpiring").innerText = expiringCount;

    data.forEach(med => {
      let rowClass = "";
      let badgeClass = "bg-success";
      let statusLabel = "Valid";

      const today = new Date();
      const expiry = new Date(med.expiry_date);
      const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) {
        rowClass = "table-danger opacity-75";
        badgeClass = "bg-danger";
        statusLabel = "Expired";
      } else if (diffDays < 30) {
        rowClass = "table-warning";
        badgeClass = "bg-warning text-dark";
        statusLabel = "Expiring Soon";
      }

      table.innerHTML += `
      <tr class="${rowClass}">
        <td class="fw-medium">${med.medicine_name}</td>
        <td class="text-muted small">${med.batch_number}</td>
        <td>
           <div class="fw-bold text-dark">${med.expiry_date.split('T')[0]}</div>
           <span class="badge ${badgeClass} mt-1" style="font-size: 0.65rem;">${statusLabel}</span>
        </td>
        <td class="fw-bold">${med.quantity}</td>
        <td><span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">${med.category}</span></td>
      </tr>
      `;
    });
  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Failed to connect to server.', 'error');
    }
  }
}

document.addEventListener("DOMContentLoaded", loadInventory);
