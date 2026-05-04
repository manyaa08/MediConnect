console.log("DONOR INVENTORY JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

let allInventory = [];

async function loadInventory() {
  try {
    console.log("🚀 FETCHING INVENTORY DASHBOARD");
    const res = await fetch(`${API_BASE_URL}/dashboard/donor`, {
      headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    console.log("RESPONSE:", data);

    if (!res.ok) {
      throw new Error(data.message || "Failed to load inventory");
    }

    const { summary, inventory } = data;
    allInventory = inventory || [];

    // Update stat cards
    document.getElementById("statTotal").innerText = summary.total_medicines_listed || 0;
    document.getElementById("statAvailable").innerText = summary.available_count || 0;
    document.getElementById("statExpiring").innerText = summary.near_expiry_count || 0;
    document.getElementById("statExpired").innerText = summary.expired_count || 0;

    // Populate category filter dropdown
    populateCategories(allInventory);

    // Initial render
    renderTable(allInventory);
    
  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Failed to connect to server.', 'error');
    }
  }
}

function populateCategories(inventory) {
  const categories = new Set();
  inventory.forEach(med => {
    if (med.category) categories.add(med.category);
  });
  
  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.innerHTML = '<option value="All">All Categories</option>';
    categories.forEach(cat => {
      categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  }
}

function renderTable(data) {
  const table = document.getElementById("inventoryTable");
  table.innerHTML = "";

  if (!data || data.length === 0) {
    table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No matching medicines found.</td></tr>`;
    return;
  }

  data.forEach(med => {
    let rowClass = "";
    let badgeClass = "bg-success";
    let statusLabel = "Available";

    // Use backend's classification
    if (med.expiry_status === "expired") {
      rowClass = "table-danger opacity-75";
      badgeClass = "bg-danger";
      statusLabel = "Expired";
    } else if (med.expiry_status === "near_expiry") {
      rowClass = "table-warning";
      badgeClass = "bg-warning text-dark";
      statusLabel = "Near Expiry";
    }

    // Default formatting for date
    let formattedDate = med.expiry_date ? med.expiry_date.split('T')[0] : "N/A";

    table.innerHTML += `
    <tr class="${rowClass}">
      <td class="fw-medium">${med.medicine_name}</td>
      <td class="text-muted small">${med.batch_number || "N/A"}</td>
      <td>
         <div class="fw-bold text-dark">${formattedDate}</div>
         <span class="badge ${badgeClass} mt-1" style="font-size: 0.65rem;">${statusLabel}</span>
      </td>
      <td class="fw-bold">${med.quantity}</td>
      <td><span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">${med.category || "General"}</span></td>
    </tr>
    `;
  });
}

function handleFilters() {
  const searchInput = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const expiryFilter = document.getElementById("expiryFilter")?.value || "All";
  const categoryFilter = document.getElementById("categoryFilter")?.value || "All";

  const filtered = allInventory.filter(med => {
    const matchesSearch = med.medicine_name.toLowerCase().includes(searchInput) || 
                          (med.batch_number && med.batch_number.toLowerCase().includes(searchInput));
    
    let matchesExpiry = true;
    if (expiryFilter !== "All") {
      matchesExpiry = (med.expiry_status === expiryFilter);
    }

    let matchesCategory = true;
    if (categoryFilter !== "All") {
      matchesCategory = (med.category === categoryFilter);
    }

    return matchesSearch && matchesExpiry && matchesCategory;
  });

  renderTable(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  loadInventory();
  
  // Attach event listeners for filtering
  document.getElementById("searchInput")?.addEventListener("input", handleFilters);
  document.getElementById("expiryFilter")?.addEventListener("change", handleFilters);
  document.getElementById("categoryFilter")?.addEventListener("change", handleFilters);
});
