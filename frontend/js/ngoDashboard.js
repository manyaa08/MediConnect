const token = localStorage.getItem("token");

if(!token){
  alert("Please login");
  window.location.href = "login.html";
}

async function loadNGODashboard(){

  try{

    const res = await fetch("http://localhost:3000/dashboard/ngo",{
      headers:{
        "Authorization":"Bearer "+token
      }
    });

    if(!res.ok){
      const text = await res.text();
      throw new Error(text);
    }

    const data = await res.json();

    const requestTable = document.getElementById("requestTable");
    const receivedTable = document.getElementById("receivedTable");

    requestTable.innerHTML="";
    receivedTable.innerHTML="";

    data.requests.forEach(req=>{
      requestTable.innerHTML += `
        <tr>
          <td>${req.medicine_name}</td>
          <td>${req.required_quantity}</td>
          <td>${req.remaining_quantity}</td>
          <td>${req.status}</td>
        </tr>`;
    });

    data.received.forEach(item=>{
  receivedTable.innerHTML += `
    <tr>
      <td>${item.medicine_name || "Batch Removed"}</td>
      <td>${item.quantity_transferred}</td>
      <td>${new Date(item.transfer_date).toLocaleDateString()}</td>
      <td>${item.expiry_date ? item.expiry_date : "N/A"}</td>

    </tr>`;
});


  }catch(err){
    alert("Error: "+err.message);
  }
}

loadNGODashboard();
