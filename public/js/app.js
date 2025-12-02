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

// Admin page handlers
if (window.location.pathname.endsWith('/admin.html')) {
  const courseForm = document.getElementById('courseForm');
  const courseMsg = document.getElementById('courseMsg');
  if (courseForm) courseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(courseForm);
    const body = { title: fd.get('title'), description: fd.get('description') };
    const res = await fetch('/api/admin/course', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify(body) });
    const d = await res.json();
    courseMsg.innerText = res.ok ? `Created course ID ${d.id}` : (d.error || 'Error');
  });

  const quizForm = document.getElementById('quizForm');
  const quizMsg = document.getElementById('quizMsg');
  if (quizForm) quizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(quizForm);
    let payload = null;
    try { payload = JSON.parse(fd.get('payload')); } catch (err) { quizMsg.innerText = 'Invalid JSON'; return; }
    const res = await fetch('/api/admin/quiz', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify(payload) });
    const d = await res.json();
    quizMsg.innerText = res.ok ? `Created quiz ID ${d.quizId}` : (d.error || 'Error');
  });
}

// Admin users management
if (window.location.pathname.endsWith('/admin.html')) {
  const usersList = document.getElementById('usersList');
  async function loadUsers(){
    const res = await fetch('/api/admin/users', { headers: authHeaders() });
    if (!res.ok) { usersList.innerText = 'Failed to load users (are you admin?)'; return; }
    const data = await res.json();
    usersList.innerHTML = data.users.map(u => `
      <div style="padding:6px;border-bottom:1px solid #ddd">
        <strong>${u.regno}</strong> ${u.name ? '- '+u.name : ''}
        <label style="margin-left:8px">Admin: <input type="checkbox" data-id="${u.id}" ${u.is_admin? 'checked':''}></label>
      </div>
    `).join('');
    // attach change handlers
    usersList.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const is_admin = e.target.checked ? 1 : 0;
      const r = await fetch('/api/admin/promote', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify({ id, is_admin }) });
      if (!r.ok) alert('Failed to update user');
    }));
  }
  loadUsers();
}
