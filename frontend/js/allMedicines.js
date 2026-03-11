const token = localStorage.getItem("token");

if(!token){
  alert("Please login first");
  window.location.href="login.html";
}

async function loadAllMedicines(){

  try{

    const res = await fetch("http://localhost:3000/medicines/all-available",{
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
    table.innerHTML="";

    data.forEach(med=>{

      let rowColor="";

      const today = new Date();
      const expiry = new Date(med.expiry_date);

      if(expiry < today){
        rowColor="table-danger";
      }

      table.innerHTML += `
        <tr class="${rowColor}">
          <td>${med.medicine_name}</td>
          <td>${med.batch_number}</td>
          <td>${med.expiry_date}</td>
          <td>${med.quantity}</td>
          <td>${med.category}</td>
          <td>${med.donor_name}</td>
          <td>${med.city}</td>
        </tr>
      `;
    });

  }catch(err){
    alert("Error: "+err.message);
  }

}

loadAllMedicines();
