const token = localStorage.getItem("token");

if(!token){
  window.location.href = "login.html";
}

document.getElementById("addMedicineForm").addEventListener("submit", async (e)=>{

  e.preventDefault();

  const medicine_name = document.getElementById("name").value;
  const batch_number = document.getElementById("batch").value;
  const expiry_date = document.getElementById("expiry").value;
  const quantity = document.getElementById("quantity").value;
  const category = document.getElementById("category").value;

  const res = await fetch("http://localhost:3000/medicines/add",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+token
    },
    body: JSON.stringify({
      medicine_name,
      batch_number,
      expiry_date,
      quantity,
      category
    })
  });

  const text = await res.text();

  if(!res.ok){
    alert(text);
  } else {
    alert("Medicine Added Successfully");
    window.location.href = "donorInventory.html";
  }

});
