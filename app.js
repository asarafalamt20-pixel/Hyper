let mode="login";
const $=id=>document.getElementById(id);
const token=()=>localStorage.getItem("hyper_token");

function setMode(m){
  mode=m;
  $("name").style.display=m==="register"?"block":"none";
  $("password").autocomplete=m==="login"?"current-password":"new-password";
  $("msg").textContent="";
  $("loginTab").style.background=m==="login"?"#111":"#eee";
  $("loginTab").style.color=m==="login"?"#fff":"#111";
  $("registerTab").style.background=m==="register"?"#111":"#eee";
  $("registerTab").style.color=m==="register"?"#fff":"#111";
}

async function api(url,options={}){
  const headers=Object.assign({},options.headers||{});
  headers["Content-Type"]="application/json";
  if(token()) headers.Authorization="Bearer "+token();
  const r=await fetch(url,Object.assign({},options,{headers}));
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Request failed");
  return data;
}

async function load(){
  if(!token()) return;
  try{
    const d=await api("/api/me");
    $("auth").classList.add("hidden");
    $("user").classList.remove("hidden");
    $("who").textContent=d.user.name;
    $("emailOut").textContent=d.user.email;
    $("admin").textContent=d.user.isAdmin?"Admin account":"User account";
  }catch{
    localStorage.removeItem("hyper_token");
  }
}

$("loginTab").onclick=()=>setMode("login");
$("registerTab").onclick=()=>setMode("register");

$("showPassword").onclick=()=>{
  const input=$("password");
  const visible=input.type==="text";
  input.type=visible?"password":"text";
  $("showPassword").textContent=visible?"Show":"Hide";
};

$("form").onsubmit=async e=>{
  e.preventDefault();
  $("msg").textContent="Please wait...";
  try{
    const body={
      email:$("email").value,
      name:$("name").value,
      password:$("password").value
    };
    const d=await api(mode==="login"?"/api/login":"/api/register",{
      method:"POST",
      body:JSON.stringify(body)
    });
    localStorage.setItem("hyper_token",d.token);
    load();
  }catch(err){
    $("msg").textContent=err.message;
  }
};

$("logout").onclick=()=>{
  localStorage.removeItem("hyper_token");
  location.reload();
};

setMode("login");
load();
