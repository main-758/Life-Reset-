(function(){
"use strict";
var cfg=window.LIFE_RESET_CONFIG||{};
var sb=null,session=null,profile=null,hydratedUserId=null,cloudBaseline=null;

function guest(){
  return {user:{name:"",email:"",plan:"free"},tasks:[],brain:"",bills:[],income:[],applications:[],goals:[],history:[],settings:{dark:false}};
}
function loadLocalState(){
  try{
    var raw=localStorage.getItem("lifeReset3");
    if(!raw)return guest();
    var local=JSON.parse(raw)||{};
    return {...guest(),...local,user:{...guest().user,...(local.user||{})},tasks:Array.isArray(local.tasks)?local.tasks:[],goals:Array.isArray(local.goals)?local.goals:[],history:Array.isArray(local.history)?local.history:[]};
  }catch(e){return guest();}
}
function escA(s){return String(s||"").replace(/[&<>'"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]);});}
function isPlus(){return !!profile&&["active","on_trial","trialing"].indexOf(profile.subscription_status)>=0;}
function showMessage(msg){
  if(typeof window.toast==="function")window.toast(msg);else alert(msg);
}
function renderAccountUI(){
  var side=document.querySelector(".sideProfile");
  if(side){
    if(session){
      var n=state.user.name||profile?.full_name||"Your account";
      side.innerHTML='<div class="row"><div class="avatar">'+escA(n.slice(0,2).toUpperCase())+'</div><div><b>'+escA(n)+'</b><div class="small">'+(isPlus()?"Plus member":"Free plan")+'</div></div></div><div class="row" style="margin-top:10px"><button class="btn dark" onclick="window.openAccount()">Account</button><button class="btn dark" onclick="window.signOutLR()">Sign out</button></div>';
    }else{
      side.innerHTML='<div class="eyebrow">ACCOUNT</div><b>Save your Life Reset</b><div class="small" style="margin-top:4px">Keep your plans and progress with your account.</div><div class="row" style="margin-top:10px"><button class="btn primary" onclick="window.openAuth(1)">Create account</button><button class="btn dark" onclick="window.openAuth(0)">Sign in</button></div>';
    }
  }
  var mob=document.getElementById("mobileAccountBtn");
  if(mob){mob.textContent=session?"Account":"Sign in";mob.onclick=session?window.openAccount:function(){window.openAuth(0)};}
}
function accountButton(){
  return session
    ? '<button class="accountBtn" onclick="window.openAccount()">Account</button>'
    : '<button class="accountBtn primary" onclick="window.openAuth(0)">Sign in</button>';
}
async function loadUser(user){
  var p=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
  if(p.error)throw p.error;
  profile=p.data;
  if(!profile){
    var ins=await sb.from("profiles").upsert({id:user.id,email:user.email||"",full_name:user.user_metadata?.full_name||""},{onConflict:"id"});
    if(ins.error)throw ins.error;
    var p2=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
    profile=p2.data;
  }
  var d=await sb.from("life_data").select("data").eq("user_id",user.id).maybeSingle();
  if(d.error)throw d.error;
  var cloud=d.data?.data||{};
  // A signed-in account is authoritative. Do not let stale device-local data
  // overwrite the account's cloud state during hydration.
  state={...guest(),...cloud,user:{...guest().user,...(cloud.user||{})}};
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];
  state.goals=Array.isArray(state.goals)?state.goals:[];
  state.history=Array.isArray(state.history)?state.history:[];
  state.user.name=profile?.full_name||user.user_metadata?.full_name||state.user.name;
  state.user.email=user.email||profile?.email||state.user.email;
  state.user.plan=isPlus()?"plus":"free";
  hydratedUserId=user.id;
  cloudBaseline=cloneLR(state);
  localStorage.setItem("lifeReset3",JSON.stringify(state));
  if(!d.data){
    await sb.from("life_data").upsert({user_id:user.id,data:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  }
  renderAccountUI();
  render();
}
var cloudSaveQueue=Promise.resolve();
function cloneLR(v){return JSON.parse(JSON.stringify(v));}
function sameLR(a,b){try{return JSON.stringify(a)===JSON.stringify(b);}catch(e){return false;}}
function mergeCloudSafe(latest){
  var base=cloudBaseline||guest(), local=state||guest(), merged=cloneLR(latest||guest());
  ["user","tasks","brain","bills","income","applications","goals","history","settings"].forEach(function(k){
    if(!sameLR(local[k],base[k])) merged[k]=cloneLR(local[k]);
  });
  return merged;
}
async function saveCloud(){
  if(!sb||!session||hydratedUserId!==session.user.id)return;
  var localSnapshot=cloneLR(state);
  var baselineSnapshot=cloneLR(cloudBaseline||guest());
  var userId=session.user.id;
  cloudSaveQueue=cloudSaveQueue.then(async function(){
    var latestRes=await sb.from("life_data").select("data").eq("user_id",userId).maybeSingle();
    if(latestRes.error)throw latestRes.error;
    var latest=latestRes.data?.data||guest();
    var savedState=state;
    var savedBase=cloudBaseline;
    state=localSnapshot;
    cloudBaseline=baselineSnapshot;
    var snapshot=mergeCloudSafe(latest);
    state=savedState;
    cloudBaseline=savedBase;
    var r=await sb.from("life_data").upsert({user_id:userId,data:snapshot,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(r.error)throw r.error;
    // Never replace newer live UI changes with an older queued snapshot.
    if(sameLR(state,localSnapshot) && sameLR(cloudBaseline,baselineSnapshot)){
      cloudBaseline=cloneLR(snapshot);
      localStorage.setItem("lifeReset3",JSON.stringify(state));
    }
  });
  return cloudSaveQueue;
}
window.lrSaveCloud=function(){return saveCloud().catch(function(e){console.error("Life Reset cloud save failed:",e);});};
async function boot(){
  try{
    if(/(?:^|[&#])type=recovery(?:&|#|$)/.test(location.hash.slice(1)) || new URLSearchParams(location.search).get("type")==="recovery"){
      location.replace("auth.html?mode=reset"+location.search+location.hash);
      return;
    }
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    window.LR_SUPABASE=sb;
    sb.auth.onAuthStateChange(function(event,next){
      session=next||null;
      if(event==="SIGNED_OUT"){
      profile=null;hydratedUserId=null;cloudBaseline=null;state=guest();
      localStorage.removeItem("lifeReset3");
      renderAccountUI();render();
      setTimeout(function(){location.replace("auth.html?mode=signin&signedout=1");},0);
      return;
    }
      if(event==="PASSWORD_RECOVERY"){location.replace("auth.html?mode=reset"+location.search+location.hash);return;}
      if(next)setTimeout(function(){loadUser(next.user).catch(function(e){console.error(e);});},0);
    });
    var r=await sb.auth.getSession();
    session=r.data.session||null;
    if(session){await loadUser(session.user);}
    else {
      state=guest(); localStorage.removeItem("lifeReset3");
      location.replace("auth.html?mode=signin");
      return;
    }
  }catch(e){console.error(e);renderAccountUI();render();}
}

window.lrAuthButtonHTML=accountButton;
window.openAccountCenter=function(){window.openAuth(0);};
window.authLR=function(signup){window.openAuth(signup?1:0);};
window.openAuth=function(signup){
  var mode=signup?"Create account":"Sign in";
  var body='<div class="sectionHead"><div><div class="eyebrow">LIFE RESET ACCOUNT</div><h2>'+mode+'</h2></div><button class="btn" onclick="closeModal()">×</button></div>'+
    (signup?'<div class="field"><label>Full name</label><input id="an" autocomplete="name" placeholder="Your name"></div>':'')+
    '<div class="field"><label>Email</label><input id="ae" type="email" autocomplete="email" placeholder="you@example.com"></div>'+
    '<div class="field"><label>Password</label><input id="ap" type="password" autocomplete="'+(signup?"new-password":"current-password")+'" placeholder="At least 6 characters"></div>'+
    '<div id="ax" class="small" style="min-height:22px;margin-top:10px"></div>'+
    '<button class="btn primary" style="width:100%;margin-top:16px" onclick="window.submitAuthModal('+!!signup+')">'+mode+'</button>'+
    (!signup?'<div style="text-align:right;margin-top:10px"><button class="btn" style="border:0;background:none;padding:0;color:var(--brand);font-weight:900" onclick="window.showResetPassword()">Forgot password?</button></div>':'')+
    '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn" onclick="window.openAuth('+(!signup)+');"> '+(signup?"I already have an account":"Create an account")+' </button></div>'+
    '<div class="small">Use your same account on every device to restore your saved Life Reset data.</div>';
  if(typeof openModal==="function")openModal(mode,body);else location.href="auth.html?mode="+(signup?"signup":"signin");
};
window.showResetPassword=function(){location.href="https://docs.google.com/forms/d/e/1FAIpQLSewfuoKEirB6ikGXLc6qHq5QIrnA0HxlkrN5Kf7o1_E55ypXw/viewform?usp=header";};
window.sendResetPassword=async function(){
  var email=document.getElementById("resetEmail")?.value.trim(),msg=document.getElementById("resetMsg");
  if(!email){if(msg)msg.textContent="Enter your email address.";return;}
  if(msg)msg.textContent="Sending reset link...";
  try{
    var r=await sb.auth.resetPasswordForEmail(email,{redirectTo:cfg.APP_URL});
    if(r.error)throw r.error;
    if(msg)msg.textContent="Reset link sent. Check your email.";
  }catch(e){if(msg)msg.textContent=e?.message||"Could not send the reset link.";}
};
window.submitAuthModal=async function(signup){
  var msg=document.getElementById("ax"),email=document.getElementById("ae")?.value.trim(),pw=document.getElementById("ap")?.value||"",name=document.getElementById("an")?.value.trim()||"";
  if(!email||!pw){if(msg)msg.textContent="Enter your email and password.";return;}
  if(signup&&!name){if(msg)msg.textContent="Enter your name.";return;}
  if(pw.length<6){if(msg)msg.textContent="Password must be at least 6 characters.";return;}
  if(msg)msg.textContent=signup?"Creating your account...":"Signing you in...";
  try{
    var r=signup
      ?await sb.auth.signUp({email:email,password:pw,options:{data:{full_name:name},emailRedirectTo:cfg.APP_URL}})
      :await sb.auth.signInWithPassword({email:email,password:pw});
    if(r.error)throw r.error;
    if(signup&&!r.data.session){
      if(msg)msg.textContent="Account created. Check your email to verify it, then sign in.";
      return;
    }
    if(r.data.session){closeModal();showMessage(signup?"Account created. Welcome to Life Reset!":"Welcome back!");}
  }catch(e){if(msg)msg.textContent=e?.message||"Authentication failed.";}
};
window.signOutLR=async function(){
  if(!sb)return;
  try{
    if(session)await saveCloud();
    var r=await sb.auth.signOut();
    if(r.error)throw r.error;
    session=null;profile=null;hydratedUserId=null;cloudBaseline=null;state=guest();
    localStorage.removeItem("lifeReset3");
    location.replace("auth.html?mode=signin&signedout=1");
  }catch(e){console.error(e);showMessage(e?.message||"Could not sign out safely. Your latest changes may still be saving.");}};
window.save=async function(){render();try{await saveCloud();showMessage("Saved to your Life Reset account.");}catch(e){console.error(e);showMessage("Saved on this device. Cloud sync needs attention.");}};
window.saveProfile=async function(){
  if(!session){window.openAuth(0);return;}
  var n=(document.getElementById("name")?.value||"").trim();
  if(!n){showMessage("Enter your name.");return;}
  var r=await sb.from("profiles").update({full_name:n,updated_at:new Date().toISOString()}).eq("id",session.user.id);
  if(r.error){showMessage(r.error.message);return;}
  if(sb.auth)await sb.auth.updateUser({data:{full_name:n}});
  profile={...profile,full_name:n};
  state.user.name=n;
  await saveCloud();
  renderAccountUI();render();
  showMessage("Profile saved to your account.");
};
window.openAccount=function(){
  if(!session){window.openAuth(0);return;}
  var n=state.user.name||"Your account";
  var html='<div class="sectionHead"><div><div class="eyebrow">ACCOUNT</div><h2>'+escA(n)+'</h2></div><button class="btn" onclick="closeModal()">×</button></div><div class="notice"><b>'+ (isPlus()?"Plus":"Free") +' plan</b><br>'+escA(state.user.email)+'</div><p class="muted" style="margin-top:14px">Your Life Reset plans and progress are linked to this account and saved in the cloud.</p>'+(isPlus()?'<div class="small">Life Reset Plus is active.</div>':'<button class="btn primary" style="width:100%;margin-top:14px" onclick="closeModal();window.openPlus()">Get Plus — $7.99/month</button>')+'<button class="btn dark" style="width:100%;margin-top:10px" onclick="window.signOutLR()">Sign out</button>';
  document.getElementById("modalCard").innerHTML=html;document.getElementById("modal").classList.add("open");
};
window.startPayPalCheckout=function(){window.openPlus();};
window.openPlus=function(){
  if(!session){window.openAuth(0);return;}
  if(isPlus()){window.openAccount();return;}
  var paypal=cfg.PAYPAL_PLUS_LINK||"";
  var html='<div class="sectionHead"><div><div class="eyebrow">LIFE RESET PLUS</div><h2>$7.99/month</h2></div><button class="btn" onclick="closeModal()">×</button></div><p class="muted">Unlimited planning, cloud sync, advanced insights and an ad-free experience.</p><div class="notice" style="margin-top:16px"><b>Secure PayPal checkout</b><br>Your Plus subscription is handled securely by PayPal.</div>'+(paypal?'<a class="btn primary" style="display:block;width:100%;margin-top:16px;text-align:center;text-decoration:none" href="'+escA(paypal)+'" target="_blank" rel="noopener noreferrer">Continue with PayPal</a>':'<div class="msg" style="margin-top:14px">PayPal checkout is not connected yet.</div>')+'<button class="btn" style="width:100%;margin-top:10px" onclick="closeModal()">Not now</button>';
  document.getElementById("modalCard").innerHTML=html;document.getElementById("modal").classList.add("open");
};

boot();
})();