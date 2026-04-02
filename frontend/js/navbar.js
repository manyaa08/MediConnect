console.log("NAVBAR JS LOADED");

document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");

  // Protection for pages using navbar.js
  if (!token) {
    if (!window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("register.html")) {
      window.location.href = "login.html";
    }
    return;
  }

  let payload;
  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("JWT Parse Error:", e);
    localStorage.clear();
    window.location.href = "login.html";
    return;
  }

  const role = payload.role;
  const userStr = localStorage.getItem("user");
  let user = { name: "User", role: role, email: "" };
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("User Parse Error:", e);
    }
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const currentPath = window.location.pathname.split('/').pop() || "index.html";
  const isActive = (path) => currentPath === path ? 'active text-emerald fw-bold border-bottom border-2 border-emerald' : '';

  navbar.innerHTML = `
  <nav class="navbar navbar-expand-lg sticky-top py-2" style="background: var(--glass-bg); backdrop-filter: blur(15px); border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
    <div class="container pe-3">
      <a class="navbar-brand d-flex align-items-center fw-bold" href="${role === 'Donor' ? 'donorInventory.html' : 'ngo.html'}" style="color: var(--primary) !important;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" class="bi bi-heart-pulse-fill me-2" viewBox="0 0 16 16">
          <path d="M1.475 9C2.702 10.84 4.779 12.871 8 15c3.221-2.129 5.298-4.16 6.525-6H12a.5.5 0 0 1-.464-.314l-1.457-3.642-1.598 5.593a.5.5 0 0 1-.945.049L5.889 6.568l-1.473 2.21A.5.5 0 0 1 4 9H1.475Z"/>
          <path d="M.88 8C-2.427 1.68 4.41-2 7.823 1.143q.09.083.176.171a3 3 0 0 1 .176-.171C11.59-2 18.426 1.68 15.12 8h-2.783l-1.874-4.686a.5.5 0 0 0-.945.049L7.921 8.956 6.464 5.314a.5.5 0 0 0-.88-.091L3.732 8H.88Z"/>
        </svg>
        <span style="letter-spacing: -1px; font-size: 1.4rem;">MediConnect</span>
      </a>

      <button class="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navContent">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3">
          ${role === "Donor" ? `
            <li class="nav-item"><a class="nav-link ${isActive('donorInventory.html')}" href="donorInventory.html">Inventory</a></li>
            <li class="nav-item"><a class="nav-link ${isActive('addMedicine.html')}" href="addMedicine.html">Add</a></li>
            <li class="nav-item"><a class="nav-link ${isActive('matchingNeeds.html')}" href="matchingNeeds.html">Matches</a></li>
            <li class="nav-item"><a class="nav-link ${isActive('allMedicines.html')}" href="allMedicines.html">Global</a></li>
          ` : ""}
          ${role === "NGO" ? `
            <li class="nav-item"><a class="nav-link ${isActive('ngo.html')}" href="ngo.html">Dashboard</a></li>
            <li class="nav-item"><a class="nav-link ${isActive('requestMedicine.html')}" href="requestMedicine.html">Request</a></li>
            <li class="nav-item"><a class="nav-link ${isActive('allMedicines.html')}" href="allMedicines.html">Global List</a></li>
          ` : ""}
        </ul>

        <!-- 👤 PREMIUM PROFILE DROPDOWN (Emerald Theme) -->
        <div class="dropdown">
          <div class="d-flex align-items-center gap-2 p-1 pe-2 rounded-pill hover-bg-emerald transition-all" style="cursor: pointer;" data-bs-toggle="dropdown" aria-expanded="false">
             <div class="d-none d-lg-block text-end me-1">
                <div class="small fw-bold text-dark mb-0" style="line-height: 1; font-size: 0.85rem;">${user.name}</div>
                <div class="text-emerald fw-bold" style="font-size: 0.6rem; letter-spacing: 0.5px; text-transform: uppercase;">${user.role}</div>
             </div>
             <div class="avatar-circle shadow-sm d-flex align-items-center justify-content-center text-white fw-bold position-relative" 
                  style="width: 40px; height: 40px; border-radius: 50%; font-size: 0.9rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                ${initials}
                <span class="position-absolute bottom-0 end-0 bg-success border border-white border-2 rounded-circle" style="width: 12px; height: 12px;"></span>
             </div>
          </div>
          <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 mt-3 p-2 animate-fadeIn" style="border-radius: 16px; min-width: 240px; backdrop-filter: blur(15px); background: rgba(255, 255, 255, 0.98); z-index: 1050;">
            <li class="px-3 py-3 mb-2 rounded-4" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%);">
                <div class="fw-bold text-dark mb-0" style="font-size: 1rem;">${user.name}</div>
                <div class="text-muted small mb-2" style="font-size: 0.75rem;">${user.email}</div>
                <span class="badge rounded-pill bg-emerald bg-opacity-10 text-emerald border border-emerald border-opacity-10 px-2" style="font-size: 0.65rem;">
                   <i class="bi bi-shield-check me-1"></i>Verified ${user.role}
                </span>
            </li>
            <li><a class="dropdown-item rounded-3 py-2 d-flex align-items-center mb-1" href="${role === 'Donor' ? 'donorInventory.html' : 'ngo.html'}">
                <div class="icon-box bg-emerald bg-opacity-10 rounded-2 d-flex align-items-center justify-content-center me-2" style="width: 30px; height: 30px;">
                   <i class="bi bi-grid text-emerald"></i>
                </div>
                <span>Dashboard</span>
            </a></li>
            <li><hr class="dropdown-divider opacity-25 mx-2"></li>
            <li><button class="dropdown-item rounded-3 py-2 text-danger d-flex align-items-center mt-1" id="navbarLogoutBtn">
                <div class="icon-box bg-danger bg-opacity-10 rounded-2 d-flex align-items-center justify-content-center me-2" style="width: 30px; height: 30px;">
                   <i class="bi bi-box-arrow-right text-danger"></i>
                </div>
                <span class="fw-medium">Log Out</span>
            </button></li>
          </ul>
        </div>
      </div>
    </div>
  </nav>

  <style>
    .text-emerald { color: #059669 !important; }
    .bg-emerald { background-color: #059669 !important; }
    .border-emerald { border-color: #059669 !important; }
    .hover-bg-emerald:hover { background: rgba(5, 150, 105, 0.05); }
    .transition-all { transition: all 0.2s ease-in-out; }
    .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dropdown-item:active { background-color: rgba(5, 150, 105, 0.1); color: #059669; }
  </style>
  `;

  // Attach logout listener
  const lgBtn = document.getElementById("navbarLogoutBtn");
  if (lgBtn) {
    lgBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "login.html";
    });
  }
});
