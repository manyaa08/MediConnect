const token = localStorage.getItem("token");

if(!token){
  window.location.href = "login.html";
}

async function loadInventory(){

  const res = await fetch("http://localhost:3000/medicines/my-medicines",{
    headers:{ "Authorization":"Bearer "+token }
  });

  const data = await res.json();

  const table = document.getElementById("inventoryTable");
  table.innerHTML="";

  data.forEach(med=>{

  let rowClass = "";
  const today = new Date();
  const expiry = new Date(med.expiry_date);

  const diffDays = (expiry - today) / (1000 * 60 * 60 * 24);

  if(diffDays < 0){
    rowClass = "table-danger";
  } else if(diffDays < 30){
    rowClass = "table-warning";
  }

  table.innerHTML += `
  <tr class="${rowClass}">
    <td>${med.medicine_name}</td>
    <td>${med.batch_number}</td>
    <td>${med.expiry_date}</td>
    <td>${med.quantity}</td>
    <td>${med.category}</td>
  </tr>
  `;
});


}

loadInventory();
