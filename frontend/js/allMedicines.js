console.log("ALL MEDICINES JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

let allMedicines = [];

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

    allMedicines = data || [];
    
    populateDropdowns(allMedicines);
    renderTable(allMedicines);

  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Could not load medicines. Server may be down.', 'error');
    }
  }
}

function populateDropdowns(inventory) {
  const categories = new Set();
  const cities = new Set();
  
  inventory.forEach(med => {
    if (med.category) categories.add(med.category);
    if (med.city) cities.add(med.city);
  });
  
  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.innerHTML = '<option value="All">All Categories</option>';
    categories.forEach(cat => {
      categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  }

  const cityFilter = document.getElementById("cityFilter");
  if (cityFilter) {
    cityFilter.innerHTML = '<option value="All">All Cities</option>';
    cities.forEach(city => {
      cityFilter.innerHTML += `<option value="${city}">${city}</option>`;
    });
  }
}

function renderTable(data) {
  const table = document.getElementById("medicineTable");
  if (!table) return;
  table.innerHTML = "";

  if (!data || data.length === 0) {
    table.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No available medicines found at the moment.</td></tr>`;
    return;
  }

  data.forEach(med => {
    let rowColor = "";
    let badgeClass = "bg-success";
    let statusLabel = "Available";

    // Use backend's classification
    if (med.expiry_status === "expired") {
      rowColor = "table-danger opacity-75";
      badgeClass = "bg-danger";
      statusLabel = "Expired";
    } else if (med.expiry_status === "near_expiry") {
      rowColor = "table-warning";
      badgeClass = "bg-warning text-dark";
      statusLabel = "Near Expiry";
    }

    let formattedDate = med.expiry_date ? med.expiry_date.split('T')[0] : "N/A";

    table.innerHTML += `
      <tr class="${rowColor}">
        <td class="fw-medium">${med.medicine_name}</td>
        <td class="text-muted small">${med.batch_number || "N/A"}</td>
        <td>
          <div class="fw-bold text-dark">${formattedDate}</div>
          <span class="badge ${badgeClass} mt-1" style="font-size: 0.65rem;">${statusLabel}</span>
        </td>
        <td class="fw-bold text-primary">${med.quantity}</td>
        <td><span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">${med.category || "General"}</span></td>
        <td class="small fw-medium">${med.donor_name}</td>
        <td class="text-muted small"><i class="fas fa-map-marker-alt me-1 text-primary"></i>${med.city}</td>
      </tr>
    `;
  });
}

function handleFilters() {
  const searchInput = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const expiryFilter = document.getElementById("expiryFilter")?.value || "All";
  const categoryFilter = document.getElementById("categoryFilter")?.value || "All";
  const cityFilter = document.getElementById("cityFilter")?.value || "All";

  const filtered = allMedicines.filter(med => {
    const matchesSearch = med.medicine_name.toLowerCase().includes(searchInput) || 
                          (med.batch_number && med.batch_number.toLowerCase().includes(searchInput)) ||
                          (med.donor_name && med.donor_name.toLowerCase().includes(searchInput));
    
    let matchesExpiry = true;
    if (expiryFilter !== "All") {
      matchesExpiry = (med.expiry_status === expiryFilter);
    }

    let matchesCategory = true;
    if (categoryFilter !== "All") {
      matchesCategory = (med.category === categoryFilter);
    }

    let matchesCity = true;
    if (cityFilter !== "All") {
      matchesCity = (med.city === cityFilter);
    }

    return matchesSearch && matchesExpiry && matchesCategory && matchesCity;
  });

  renderTable(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  loadAllMedicines();
  
  // Attach event listeners for filtering
  document.getElementById("searchInput")?.addEventListener("input", handleFilters);
  document.getElementById("expiryFilter")?.addEventListener("change", handleFilters);
  document.getElementById("categoryFilter")?.addEventListener("change", handleFilters);
  document.getElementById("cityFilter")?.addEventListener("change", handleFilters);
});
