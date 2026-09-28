(function(){
"use strict";
var cfg=window.LIFE_RESET_CONFIG||{};
var sb=null, session=null, profile=null;
function escA(s){return String(s||"").replace(/[&<>'"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])});}
function guest(){return{user:{name:"",email:"",plan:"free"},tasks:[],brain:"",bills:[],income:[],applications:[],goals:[],history:[],settings:{dark:false}}}
function plus(){return !!profile&&["active","on_trial","trialing"].indexOf(profile.subscription_status)>=0}
function syncHeader(){
 var b=document.querySelector(".sideProfile");
 if(b&&session){var n=state.user.name||profile?.full_name||"Your account";b.innerHTML='<div class="row"><div class="avatar">'+escA(n.slice(0,2).toUpperCase())+'</div><div><b>'+escA(n)+'</b><div class="small">'+(plus()?"Plus member":"Free plan")+'</div></div></div><div class="row" style="margin-top:10px"><button class="btn dark" onclick="window.openAccount()">Account</button><button class="btn dark" onclick="window.signOutLR()">Sign out</button></div>';}
 var m=document.getElementById("mobileAccountBtn");if(m){m.textContent=session?"Account":"Sign in";m.onclick=session?window.openAccount:function(){window.openAccountCenter()};}
}
function accountButton(){return session?'<button class="accountBtn" onclick="window.openAccount()">Account</button>':'<button class="accountBtn primary" onclick="window.openAccountCenter()">Sign in / Create account</button>'}
async function loadUser(u){
 var p=await sb.from("profiles").select("*").eq("id",u.id).maybeSingle();if(p.error)throw p.error;profile=p.data;
 if(!profile){var ins=await sb.from("profiles").upsert({id:u.id,email:u.email||"",full_name:u.user_metadata?.full_name||""},{onConflict:"id"});if(ins.error)throw ins.error;var pp=await sb.from("profiles").select("*").eq("id",u.id).maybeSingle();profile=pp.data;}
 var d=await sb.from("life_data").select("data").eq("user_id",u.id).maybeSingle();if(d.error)throw d.error;
 var cloud=d.data?.data||{};state={...guest(),...cloud,user:{...guest().user,...(cloud.user||{})}};state.user.name=profile?.full_name||u.user_metadata?.full_name||state.user.name;state.user.email=u.email||profile?.email||state.user.email;state.user.plan=plus()?"plus":"free";
 setTimeout(function(){syncHeader();render();},0);
}
async function initAccount(){
 try{
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});window.LR_SUPABASE=sb;
  var r=await sb.auth.getSession();session=r.data.session;
  if(!session){return;}
  await loadUser(session.user);
  sb.auth.onAuthStateChange(function(ev,s){session=s;if(ev==="SIGNED_OUT"){profile=null;state=guest();location.replace("auth.html?mode=signin");return;}if(s)setTimeout(function(){loadUser(s.user).catch(console.error)},0);});
 }catch(e){console.error(e);alert(e?.message||"Life Reset could not connect to your account.");}
}
window.lrAuthButtonHTML=accountButton;
window.openAccountCenter=function(){location.href="auth.html?mode=signin"};
window.authLR=function(signup){location.href="auth.html?mode="+(signup?"signup":"signin")};
window.signOutLR=async function(){if(sb){var r=await sb.auth.signOut();if(r.error)alert(r.error.message);}};
window.save=async function(){localStorage.setItem(KEY,JSON.stringify(state));render();if(sb&&session){var r=await sb.from("life_data").upsert({user_id:session.user.id,data:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(r.error)console.error(r.error);}};
window.saveProfile=async function(){if(!session){location.href="auth.html?mode=signin";return;}var n=(document.getElementById("name")?.value||"").trim();var r=await sb.from("profiles").update({full_name:n,updated_at:new Date().toISOString()}).eq("id",session.user.id);if(r.error){alert(r.error.message);return;}await sb.auth.updateUser({data:{full_name:n}});state.user.name=n;await window.save();alert("Profile saved.");};
window.openAccount=function(){var n=state.user.name||"Your account";var html='<div class="sectionHead"><div><h2>Your account</h2><div class="small">'+escA(n)+'</div></div><button class="btn" onclick="closeModal()">×</button></div><div class="notice"><b>'+(plus()?"Plus":"Free")+' plan</b><br>'+escA(state.user.email)+'</div>'+(plus()?'<p class="muted">Your Life Reset Plus access is active.</p>':'<p class="muted">Your plans and progress are saved to this account.</p><button class="btn primary" style="width:100%" onclick="closeModal();window.openPlus()">Get Plus — $7.99/month</button>')+'<button class="btn dark" style="width:100%;margin-top:10px" onclick="window.signOutLR()">Sign out</button>';document.getElementById("modalCard").innerHTML=html;document.getElementById("modal").classList.add("open");};
window.openPlus=function(){if(!session){location.href="auth.html?mode=signin";return;}if(plus()){window.openAccount();return;}openModal("Life Reset Plus",'<div class="authHero"><div class="eyebrow">LIFE RESET PLUS</div><h2>More planning power. Less life chaos.</h2><p class="muted">Unlimited planning, cloud sync, advanced insights and an ad-free experience.</p><div class="price">$7.99 <span style="font-size:15px">/ month</span></div></div><div class="notice" style="margin-top:15px"><b>Choose your payment method</b><br>Your subscription will be linked to your Life Reset account.</div><button class="btn primary" style="width:100%;margin-top:16px" onclick="window.startStripeCheckout()">Continue with Stripe</button><button class="btn" style="width:100%;margin-top:10px" onclick="window.startPayPalCheckout()">Pay with PayPal</button>');};
window.startPayPalCheckout=function(){var u=cfg.PAYPAL_PLUS_LINK;if(!u){alert("PayPal link is not connected yet.");return;}location.href=u;};
window.startStripeCheckout=async function(){try{var r=await sb.functions.invoke(cfg.STRIPE_CHECKOUT_FUNCTION||"stripe-checkout",{body:{price_id:cfg.STRIPE_PRICE_ID}});if(r.error)throw r.error;if(!r.data?.url)throw new Error(r.data?.error||"Stripe checkout could not open.");location.href=r.data.url;}catch(e){alert(e?.message||"Stripe checkout could not open.");}};
initAccount();
})();