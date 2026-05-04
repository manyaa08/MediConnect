console.log("NGO DASHBOARD LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

let allRequests = [];
let allReceived = [];

async function loadNGODashboard() {
  try {
    console.log("🚀 FETCHING NGO DASHBOARD:", `${API_BASE_URL}/dashboard/ngo`);
    const res = await fetch(`${API_BASE_URL}/dashboard/ngo`, {
      headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();
    console.log("RESPONSE:", data);

    if (!res.ok) {
      throw new Error(data.message || "Failed to fetch dashboard data");
    }

    allRequests = data.requests || [];
    allReceived = data.received || [];
    
    let totalItems = 0;
    if (allReceived.length > 0) {
        allReceived.forEach(item => totalItems += item.quantity_transferred);
    }

    if (document.getElementById("statActive")) document.getElementById("statActive").innerText = allRequests.length;
    if (document.getElementById("statReceived")) document.getElementById("statReceived").innerText = allReceived.length;
    if (document.getElementById("statTotalItems")) document.getElementById("statTotalItems").innerText = totalItems;

    renderRequests(allRequests);
    renderReceived(allReceived);

  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Failed to fetch dashboard data.', 'error');
    }
  }
}

function renderRequests(requests) {
  const requestTable = document.getElementById("requestTable");
  if (!requestTable) return;
  
  requestTable.innerHTML = "";
  if (!requests || requests.length === 0) {
    requestTable.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No active requests found.</td></tr>`;
  } else {
    requests.forEach(req => {
      let statusBadge = '';
      if (req.status === 'Pending') statusBadge = `<span class="badge bg-warning text-dark">Pending</span>`;
      else if (req.status === 'Completed' || req.status === 'Fulfilled') statusBadge = `<span class="badge bg-success">Completed</span>`;
      else if (req.status === 'Partially Fulfilled') statusBadge = `<span class="badge bg-info text-dark">Partially Fulfilled</span>`;
      else statusBadge = `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">${req.status || 'Active'}</span>`;

      const progress = req.required_quantity > 0 
        ? Math.round(((req.required_quantity - req.remaining_quantity) / req.required_quantity) * 100) 
        : 0;
        
      const progressBar = `
        <div class="progress mt-2" style="height: 6px; width: 100%;">
            <div class="progress-bar ${progress === 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
        <small class="text-muted" style="font-size: 0.70rem;">${progress}% Fulfilled</small>
      `;

      requestTable.innerHTML += `
      <tr>
        <td class="fw-medium">${req.medicine_name}
          <div class="mt-1"><span class="badge bg-light text-dark border" style="font-size: 0.65rem;">${req.urgency} Urgency</span></div>
        </td>
        <td class="fw-bold text-center">${req.required_quantity}</td>
        <td class="fw-bold text-primary text-center">
            ${req.remaining_quantity}
        </td>
        <td class="text-end">
            <div class="d-flex flex-column align-items-end">
              ${statusBadge}
              <div class="w-100 mt-1">${progressBar}</div>
            </div>
        </td>
      </tr>`;
    });
  }
}

function renderReceived(received) {
  const receivedTable = document.getElementById("receivedTable");
  if (!receivedTable) return;
  
  receivedTable.innerHTML = "";
  if (!received || received.length === 0) {
    receivedTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No medicines received yet.</td></tr>`;
  } else {
    received.forEach(item => {
      const expDate = item.expiry_date ? item.expiry_date.split('T')[0] : "N/A";
      receivedTable.innerHTML += `
      <tr>
        <td class="fw-medium">${item.medicine_name || '<span class="text-muted small">Batch Record Removed</span>'}</td>
        <td class="text-muted text-center">${item.donor_name || 'Unknown Donor'}</td>
        <td class="fw-bold text-success text-center">+${item.quantity_transferred}</td>
        <td class="text-muted small text-center">${new Date(item.transfer_date).toLocaleDateString()}</td>
        <td class="text-end"><span class="badge bg-light text-dark border">${expDate}</span></td>
      </tr>`;
    });
  }
}

function handleRequestFilters() {
  const searchInput = document.getElementById("searchRequests")?.value.toLowerCase() || "";
  const urgencyFilter = document.getElementById("urgencyFilter")?.value || "All";
  const statusFilter = document.getElementById("statusFilter")?.value || "All";

  const filtered = allRequests.filter(req => {
    const matchesSearch = req.medicine_name.toLowerCase().includes(searchInput);
    
    let matchesUrgency = true;
    if (urgencyFilter !== "All") {
      matchesUrgency = (req.urgency === urgencyFilter);
    }

    let matchesStatus = true;
    if (statusFilter !== "All") {
      matchesStatus = (req.status === statusFilter);
    }

    return matchesSearch && matchesUrgency && matchesStatus;
  });

  renderRequests(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  loadNGODashboard();
  
  document.getElementById("searchRequests")?.addEventListener("input", handleRequestFilters);
  document.getElementById("urgencyFilter")?.addEventListener("change", handleRequestFilters);
  document.getElementById("statusFilter")?.addEventListener("change", handleRequestFilters);
});
