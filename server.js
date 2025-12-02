const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const DB_FILE = path.join(__dirname, 'data.db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3000;

// Ensure folder for public materials
const PUBLIC_DIR = path.join(__dirname, 'public');
const MATERIALS_DIR = path.join(PUBLIC_DIR, 'materials');
if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR, { recursive: true });

// Open DB
const db = new sqlite3.Database(DB_FILE);

// Init tables
const initSql = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regno TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  FOREIGN KEY(course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT,
  FOREIGN KEY(course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
);

CREATE TABLE IF NOT EXISTS choices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  FOREIGN KEY(question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quiz_id INTEGER NOT NULL,
  score INTEGER,
  taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
);
`;

db.exec(initSql, (err) => {
  if (err) return console.error('DB init error', err);
  seedDemoData();
});

function seedDemoData() {
  db.get('SELECT COUNT(*) as c FROM courses', (err, row) => {
    if (err) return console.error(err);
    if (row.c === 0) {
      db.run('INSERT INTO courses (title, description) VALUES (?, ?)', ['Intro to KIBABII Tours', 'Learn about our tours and services.'], function(err) {
        if (err) return console.error(err);
        const courseId = this.lastID;
        // material - create a simple text file to download
        const samplePath = path.join(MATERIALS_DIR, 'welcome.txt');
        fs.writeFileSync(samplePath, 'Welcome to KIBABII Tours e-learning!');
        db.run('INSERT INTO materials (course_id, filename, original_name) VALUES (?, ?, ?)', [courseId, 'welcome.txt', 'Welcome.txt']);

        // sample quiz with 2 questions
        db.run('INSERT INTO quizzes (course_id, title) VALUES (?, ?)', [courseId, 'Intro Quiz'], function(err) {
          if (err) return console.error(err);
          const quizId = this.lastID;
          db.run('INSERT INTO questions (quiz_id, text) VALUES (?, ?)', [quizId, 'What is KIBABII Tours?'], function(err) {
            const q1 = this.lastID;
            db.run('INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)', [q1, 'A tour operator', 1]);
            db.run('INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)', [q1, 'A hotel', 0]);
          });
          db.run('INSERT INTO questions (quiz_id, text) VALUES (?, ?)', [quizId, 'Where do our tours operate?'], function(err) {
            const q2 = this.lastID;
            db.run('INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)', [q2, 'Locally and regionally', 1]);
            db.run('INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)', [q2, 'Only online', 0]);
          });
        });
      });
    }
  });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function createToken(user) {
  return jwt.sign({ id: user.id, regno: user.regno, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  let token = null;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Register
app.post('/api/register', async (req, res) => {
  const { regno, name, password } = req.body;
  if (!regno || !password) return res.status(400).json({ error: 'regno and password required' });
  const hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (regno, name, password_hash) VALUES (?, ?, ?)', [regno, name || null, hash], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') return res.status(400).json({ error: 'Registration number already used' });
      return res.status(500).json({ error: 'DB error' });
    }
    const user = { id: this.lastID, regno, name };
    const token = createToken(user);
    res.json({ token, user });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { regno, password } = req.body;
  if (!regno || !password) return res.status(400).json({ error: 'regno and password required' });
  db.get('SELECT id, regno, name, password_hash FROM users WHERE regno = ?', [regno], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const user = { id: row.id, regno: row.regno, name: row.name };
    const token = createToken(user);
    res.json({ token, user });
  });
});

// Get courses
app.get('/api/courses', authMiddleware, (req, res) => {
  db.all('SELECT id, title, description FROM courses', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ courses: rows });
  });
});

// Course details
app.get('/api/courses/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, title, description FROM courses WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Course not found' });
    res.json({ course: row });
  });
});

// Materials list
app.get('/api/courses/:id/materials', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.all('SELECT id, original_name FROM materials WHERE course_id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ materials: rows });
  });
});

// Download material
app.get('/api/materials/:id/download', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.get('SELECT filename, original_name FROM materials WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(MATERIALS_DIR, row.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.download(filePath, row.original_name || path.basename(filePath));
  });
});

// Get quiz questions for a course (return first quiz)
app.get('/api/courses/:id/quiz', authMiddleware, (req, res) => {
  const cid = req.params.id;
  db.get('SELECT id, title FROM quizzes WHERE course_id = ? LIMIT 1', [cid], (err, quiz) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    db.all('SELECT q.id as qid, q.text, c.id as cid, c.text as choice_text FROM questions q JOIN choices c ON c.question_id = q.id WHERE q.quiz_id = ?', [quiz.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      // Group choices by question
      const map = {};
      rows.forEach(r => {
        if (!map[r.qid]) map[r.qid] = { id: r.qid, text: r.text, choices: [] };
        map[r.qid].choices.push({ id: r.cid, text: r.choice_text });
      });
      const questions = Object.values(map);
      res.json({ quiz: { id: quiz.id, title: quiz.title, questions } });
    });
  });
});

// Submit quiz
app.post('/api/quizzes/:id/submit', authMiddleware, (req, res) => {
  const quizId = req.params.id;
  const answers = req.body.answers || {}; // { questionId: choiceId }
  const userId = req.user.id;
  // compute score
  db.all('SELECT q.id as qid, c.id as cid, c.is_correct FROM questions q JOIN choices c ON c.question_id = q.id WHERE q.quiz_id = ?', [quizId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const correctByQuestion = {};
    rows.forEach(r => {
      if (r.is_correct) correctByQuestion[r.qid] = r.cid;
    });
    let total = Object.keys(correctByQuestion).length;
    if (total === 0) total = 1;
    let score = 0;
    for (const qid in correctByQuestion) {
      if (answers[qid] && parseInt(answers[qid]) === correctByQuestion[qid]) score++;
    }
    const percent = Math.round((score / total) * 100);
    db.run('INSERT INTO attempts (user_id, quiz_id, score) VALUES (?, ?, ?)', [userId, quizId, percent], function(err) {
      if (err) console.error('Failed to save attempt', err);
      res.json({ score: percent });
    });
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ----- Admin endpoints (simple) -----
// Create a course
app.post('/api/admin/course', authMiddleware, (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  db.run('INSERT INTO courses (title, description) VALUES (?, ?)', [title, description || null], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ id: this.lastID, title, description });
  });
});

// Create a quiz with questions and choices
// Payload: { course_id, title, questions: [ { text, choices: [ { text, is_correct } ] } ] }
app.post('/api/admin/quiz', authMiddleware, (req, res) => {
  const { course_id, title, questions } = req.body;
  if (!course_id || !questions || !Array.isArray(questions)) return res.status(400).json({ error: 'course_id and questions required' });
  db.run('INSERT INTO quizzes (course_id, title) VALUES (?, ?)', [course_id, title || null], function(err) {
    if (err) return res.status(500).json({ error: 'DB error creating quiz' });
    const quizId = this.lastID;
    const stmtQ = db.prepare('INSERT INTO questions (quiz_id, text) VALUES (?, ?)');
    const stmtC = db.prepare('INSERT INTO choices (question_id, text, is_correct) VALUES (?, ?, ?)');
    questions.forEach(q => {
      stmtQ.run([quizId, q.text], function(err) {
        const qid = this.lastID;
        (q.choices || []).forEach(ch => {
          stmtC.run([qid, ch.text, ch.is_correct ? 1 : 0]);
        });
      });
    });
    stmtQ.finalize(); stmtC.finalize();
    res.json({ quizId });
  });
});

// Admin list endpoints
app.get('/api/admin/courses', authMiddleware, (req, res) => {
  db.all('SELECT id, title, description FROM courses', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ courses: rows });
  });
});

app.get('/api/admin/quizzes', authMiddleware, (req, res) => {
  db.all('SELECT id, course_id, title FROM quizzes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ quizzes: rows });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
