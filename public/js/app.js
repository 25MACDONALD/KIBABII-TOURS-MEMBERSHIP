// Minimal client-side JS to interact with API
const API = '';
function getToken(){ return localStorage.getItem('token'); }
function setToken(t){ localStorage.setItem('token', t); }
function authHeaders(){ const t = getToken(); return t? { 'Authorization': 'Bearer '+t } : {}; }

// Register
const registerForm = document.getElementById('registerForm');
if (registerForm) registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(registerForm);
  const body = { regno: fd.get('regno'), name: fd.get('name'), password: fd.get('password') };
  const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  const msg = document.getElementById('msg');
  if (res.ok) { setToken(data.token); window.location = '/dashboard.html'; }
  else msg.innerText = data.error || 'Registration failed';
});

// Login
const loginForm = document.getElementById('loginForm');
if (loginForm) loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  const body = { regno: fd.get('regno'), password: fd.get('password') };
  const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  const msg = document.getElementById('msg');
  if (res.ok) { setToken(data.token); window.location = '/dashboard.html'; }
  else msg.innerText = data.error || 'Login failed';
});

// Dashboard - load courses
const coursesEl = document.getElementById('courses');
if (coursesEl) {
  (async ()=>{
    const res = await fetch('/api/courses', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      coursesEl.innerHTML = data.courses.map(c=>`<li><a href="/course.html?id=${c.id}">${c.title}</a> - ${c.description}</li>`).join('');
    } else {
      if (res.status===401) window.location = '/login.html';
    }
  })();
}

// Logout
const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem('token'); window.location='/'; });

// Course page
if (window.location.pathname.endsWith('/course.html')) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  (async ()=>{
    const res = await fetch('/api/courses/'+id, { headers: authHeaders() });
    if (!res.ok) return window.location='/login.html';
    const { course } = await res.json();
    document.getElementById('title').innerText = course.title;
    document.getElementById('desc').innerText = course.description || '';
    // materials
    const mres = await fetch('/api/courses/'+id+'/materials', { headers: authHeaders() });
    const ml = await mres.json();
    document.getElementById('materials').innerHTML = ml.materials.map(m=>`<li>${m.original_name} <a href='/api/materials/${m.id}/download' target='_blank'>Download</a></li>`).join('');

    document.getElementById('startQuiz').addEventListener('click', ()=>{ window.location = '/quiz.html?course='+id; });
  })();
}

// Quiz page
if (window.location.pathname.endsWith('/quiz.html')) {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course');
  (async ()=>{
    const res = await fetch('/api/courses/'+courseId+'/quiz', { headers: authHeaders() });
    if (!res.ok) return alert('No quiz or please login');
    const data = await res.json();
    document.getElementById('quizTitle').innerText = data.quiz.title;
    const form = document.getElementById('quizForm');
    data.quiz.questions.forEach(q=>{
      const div = document.createElement('div');
      div.innerHTML = `<p><strong>${q.text}</strong></p>` + q.choices.map(ch=>`<label><input type='radio' name='q_${q.id}' value='${ch.id}'> ${ch.text}</label>`).join('');
      form.appendChild(div);
    });
    const btn = document.createElement('button'); btn.textContent='Submit'; form.appendChild(btn);
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const answers = {};
      data.quiz.questions.forEach(q=>{ answers[q.id]=fd.get('q_'+q.id); });
      const sres = await fetch('/api/quizzes/'+data.quiz.id+'/submit', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify({ answers }) });
      const r = await sres.json();
      document.getElementById('result').innerText = sres.ok ? `Score: ${r.score}%` : (r.error || 'Error');
    });
  })();
}

// Simple redirect from root to index handled by static server
