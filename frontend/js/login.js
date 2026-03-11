document.getElementById("loginForm").addEventListener("submit", async (e)=>{

  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("http://localhost:3000/users/login",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({email,password})
  });

  const data = await res.json();

  if(!res.ok){
    alert(data);
    return;
  }

  localStorage.setItem("token", data.token);

  const payload = JSON.parse(atob(data.token.split('.')[1]));

  if(payload.role === "Donor"){
    window.location.href = "donorInventory.html";
  } else {
    window.location.href = "ngo.html";
  }

});
