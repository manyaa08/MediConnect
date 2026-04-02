console.log("MATCHING NEEDS JS LOADED");

const API_BASE_URL = "http://127.0.0.1:5000";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

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

    const table = document.getElementById("matchTable");
    if (!table) return;
    table.innerHTML = "";

    if (!data || data.length === 0) {
      table.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No matching NGO needs in your city for your medicines!</td></tr>`;
      return;
    }

    data.forEach(req => {
      let urgencyBadge = '';
      if (req.urgency === 'High') urgencyBadge = `<span class="badge bg-danger rounded-pill">High</span>`;
      else if (req.urgency === 'Medium') urgencyBadge = `<span class="badge bg-warning text-dark rounded-pill">Medium</span>`;
      else urgencyBadge = `<span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 rounded-pill">${req.urgency || 'Low'}</span>`;

      table.innerHTML += `
        <tr>
          <td class="fw-medium text-dark">${req.medicine_name}</td>
          <td class="fw-bold">${req.required_quantity}</td>
          <td class="fw-bold text-primary">${req.remaining_quantity}</td>
          <td>${urgencyBadge}</td>
          <td>
            <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm"
            onclick="fulfillRequest(${req.request_id}, ${req.remaining_quantity})">
            Fulfill
            </button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("ERROR:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire('Error', err.message || 'Connection Error', 'error');
    }
  }
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

document.addEventListener("DOMContentLoaded", loadMatching);
