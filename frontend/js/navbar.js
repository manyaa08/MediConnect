document.addEventListener("DOMContentLoaded", function(){

  const token = localStorage.getItem("token");

  if(!token){
    window.location.href = "login.html";
    return;
  }

  const payload = JSON.parse(atob(token.split('.')[1]));
  const role = payload.role;

  const navbar = document.getElementById("navbar");

  if(!navbar) return;

  navbar.innerHTML = `
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
  <div class="container-fluid">

  <a class="navbar-brand">MediConnect</a>

  <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
    <span class="navbar-toggler-icon"></span>
  </button>

  <div class="collapse navbar-collapse" id="navContent">

  <ul class="navbar-nav me-auto">

  ${role === "Donor" ? `
  <li class="nav-item">
    <a class="nav-link" href="donorInventory.html">Your Medicines</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" href="addMedicine.html">Add Medicine</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" href="allMedicines.html">All Medicines</a>
  </li>
  ` : ""}

  ${role === "NGO" ? `
  <li class="nav-item">
    <a class="nav-link" href="ngo.html">Dashboard</a>
  </li>
  ` : ""}

  </ul>

  <button class="btn btn-outline-light btn-sm" id="logoutBtn">Logout</button>

  </div>
  </div>
  </nav>
  `;

  document.getElementById("logoutBtn").addEventListener("click", function(){
    localStorage.clear();
    window.location.href = "login.html";
  });

});
