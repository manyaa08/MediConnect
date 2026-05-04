console.log("MATCHING NEEDS JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

let allMatches = [];

async function loadMatching() {
  try {
    console.log("🚀 FETCHING MATCHING NEEDS:", `${API_BASE_URL}/requests/matching-needs`);
    const res = await fetch(`${API_BASE_URL}/requests/matching-needs`, {
      headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    console.log("RESPONSE:", data);

    if (!res.ok) {
      throw new Error(data.message || "Failed to load matching needs");
    }

    allMatches = data || [];
    renderMatches(allMatches);

  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Connection Error', 'error');
    }
  }
}

function renderMatches(matches) {
  const table = document.getElementById("matchTable");
  if (!table) return;
  table.innerHTML = "";

  if (!matches || matches.length === 0) {
    table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No matching NGO needs in your city for your medicines!</td></tr>`;
    return;
  }

  matches.forEach(req => {
    let urgencyBadge = '';
    if (req.urgency === 'High') urgencyBadge = `<span class="badge bg-danger rounded-pill">High</span>`;
    else if (req.urgency === 'Medium') urgencyBadge = `<span class="badge bg-warning text-dark rounded-pill">Medium</span>`;
    else urgencyBadge = `<span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 rounded-pill">${req.urgency || 'Low'}</span>`;

    const canFullyFulfill = req.total_available >= req.remaining_quantity;
    const compatibilityBadge = canFullyFulfill 
        ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25" style="font-size:0.65rem;">Full Fulfillment Possible</span>`
        : `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25" style="font-size:0.65rem;">Partial Fulfillment Only</span>`;

    table.innerHTML += `
      <tr>
        <td class="fw-medium text-dark">
          ${req.medicine_name}
          <div class="mt-1">${compatibilityBadge}</div>
        </td>
        <td class="fw-bold text-center">${req.required_quantity}</td>
        <td class="fw-bold text-primary text-center">
            ${req.remaining_quantity}
            <div class="text-muted small mt-1" style="font-size:0.7rem;">You have: ${req.total_available}</div>
        </td>
        <td class="text-center">${urgencyBadge}</td>
        <td class="text-end">
          <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm"
          onclick="fulfillRequest(${req.request_id}, ${req.remaining_quantity})">
          Fulfill
          </button>
        </td>
      </tr>
    `;
  });
}

function handleMatchFilters() {
  const searchInput = document.getElementById("searchMatch")?.value.toLowerCase() || "";
  const compatibilityFilter = document.getElementById("compatibilityFilter")?.value || "All";

  const filtered = allMatches.filter(req => {
    const matchesSearch = req.medicine_name.toLowerCase().includes(searchInput) ||
                          (req.ngo_name && req.ngo_name.toLowerCase().includes(searchInput)) ||
                          (req.city && req.city.toLowerCase().includes(searchInput));
    
    let matchesCompatibility = true;
    if (compatibilityFilter !== "All") {
      const canFullyFulfill = req.total_available >= req.remaining_quantity;
      if (compatibilityFilter === "Full" && !canFullyFulfill) matchesCompatibility = false;
      if (compatibilityFilter === "Partial" && canFullyFulfill) matchesCompatibility = false;
    }

    return matchesSearch && matchesCompatibility;
  });

  renderMatches(filtered);
}

async function fulfillRequest(request_id, max_quantity) {
  const { value: quantity } = await Swal.fire({
    title: 'Fulfill Need',
    input: 'number',
    inputLabel: 'Enter amount to donate (Available in need: ' + max_quantity + ')',
    inputValue: max_quantity,
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || value <= 0) {
        return 'Please enter a valid amount'
      }
      if (value > max_quantity) {
        return 'Cannot donate more than required.'
      }
    }
  });

  if (!quantity) return;

  try {
    const res = await fetch(`${API_BASE_URL}/transfers/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        request_id,
        quantity: parseInt(quantity)
      })
    });

    const data = await res.json();
    console.log("FULFILL RESPONSE:", data);

    if (!res.ok) {
      Swal.fire('Failed', data.message || 'Fulfillment failed', 'error');
    } else {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: data.message || 'Thank you for your generous donation!',
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        loadMatching();
      });
    }
  } catch (err) {
    Swal.fire('Error', 'Connection Error', 'error');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMatching();
  
  document.getElementById("searchMatch")?.addEventListener("input", handleMatchFilters);
  document.getElementById("compatibilityFilter")?.addEventListener("change", handleMatchFilters);
});
