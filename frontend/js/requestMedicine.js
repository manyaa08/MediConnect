const token = localStorage.getItem("token");

if(!token){
  alert("Please login");
  window.location.href = "login.html";
}

document.getElementById("requestForm").addEventListener("submit", async (e)=>{

  e.preventDefault();

  const medicine_name = document.getElementById("medicine").value;
  const required_quantity = document.getElementById("quantity").value;
  const urgency = document.getElementById("urgency").value;

  try{

    const res = await fetch("http://localhost:3000/requests/create",{

      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer "+token
      },

      body: JSON.stringify({
        medicine_name,
        required_quantity,
        urgency
      })

    });

    const text = await res.text();

    if(!res.ok){
      throw new Error(text);
    }

    alert("Request Created Successfully");

    window.location.href = "ngo.html";

  }catch(err){
    alert("Error: " + err.message);
  }

});
