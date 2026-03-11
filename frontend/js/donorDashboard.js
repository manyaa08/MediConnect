const token = localStorage.getItem("token");

if(!token){
  alert("Please login first");
  window.location.href = "login.html";
}

// Load Medicines
async function loadMedicines(){

  try{

    const res = await fetch("http://localhost:3000/medicines/my-medicines",{
      headers:{
        "Authorization":"Bearer "+token
      }
    });

    if(!res.ok){
      const text = await res.text();
      throw new Error(text);
    }

    const data = await res.json();

    const table = document.getElementById("medicineTable");
    table.innerHTML = "";

    data.forEach(med=>{

      let rowColor = "";

      if(med.status === "Expired"){
        rowColor = "table-danger";
      }
      else if(med.status === "Available"){
        rowColor = "table-success";
      }

      table.innerHTML += `
        <tr class="${rowColor}">
          <td>${med.medicine_name}</td>
          <td>${med.batch_number}</td>
          <td>${med.expiry_date || ""}</td>
          <td>${med.quantity}</td>
          <td>${med.status}</td>
        </tr>
      `;
    });

  }catch(err){
    alert("Error loading medicines: " + err.message);
  }
}

loadMedicines();

// Add Medicine
document.getElementById("addMedicineForm").addEventListener("submit", async (e)=>{

  e.preventDefault();

  try{

    const res = await fetch("http://localhost:3000/medicines/add",{

      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer "+token
      },

      body: JSON.stringify({
        medicine_name: document.getElementById("mname").value,
        batch_number: document.getElementById("batch").value,
        expiry_date: document.getElementById("expiry").value,
        quantity: document.getElementById("qty").value,
        category: document.getElementById("cat").value
      })

    });

    const text = await res.text();

    if(!res.ok){
      throw new Error(text);
    }

    alert("Medicine Added Successfully");

    document.getElementById("addMedicineForm").reset();

    loadMedicines();

  }catch(err){
    alert("Error: " + err.message);
  }

});

async function loadMatching(){

  const res = await fetch("http://localhost:3000/requests/matching-needs",{
    headers:{
      "Authorization":"Bearer "+token
    }
  });

  const data = await res.json();

  const table = document.getElementById("matchTable");
  table.innerHTML="";

  data.forEach(req=>{

    table.innerHTML += `
      <tr>
        <td>${req.medicine_name}</td>
        <td>${req.required_quantity}</td>
        <td>${req.remaining_quantity}</td>
        <td>${req.urgency}</td>
        <td>
          <button class="btn btn-primary btn-sm"
          onclick="fulfillRequest(${req.request_id})">
          Fulfill
          </button>
        </td>
      </tr>
    `;
  });

}

loadMatching();


async function fulfillRequest(request_id){

  const quantity = prompt("Enter quantity to fulfill:");

  if(!quantity) return;

  const res = await fetch("http://localhost:3000/requests/fulfill",{

    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+token
    },

    body: JSON.stringify({
      request_id,
      quantity: parseInt(quantity)
    })

  });

  const text = await res.text();

  alert(text);

  loadMedicines();
  loadMatching();
}

