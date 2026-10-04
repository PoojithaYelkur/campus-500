require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Generate unique referral code
function generateReferralCode(name) {
  const clean = name.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'STUDENT';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${clean}${randomSuffix}`;
}

// 1. Get Campaign Progress (Hero & Header)
app.get('/api/campaign/progress', (req, res) => {
  try {
    const totalRow = db.prepare('SELECT COUNT(*) as total FROM students').get();
    const target = 500;
    const total = totalRow.total;
    const remaining = Math.max(0, target - total);
    res.json({ target, total, remaining, percentage: Math.min(100, Math.round((total / target) * 100)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Track Referral Click
app.post('/api/referrals/click', (req, res) => {
  const { code, channel } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  try {
    db.prepare('INSERT INTO referral_clicks (referral_code, channel) VALUES (?, ?)').run(code.toUpperCase(), channel || 'direct');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Register Student with Referral Attribution
app.post('/api/students/register', (req, res) => {
  const { name, email, phone, college, branch, graduation_year, ref } = req.body;

  if (!name || !email || !phone || !college || !branch) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Prevent duplicate registration by email
  const existing = db.prepare('SELECT id, referral_code FROM students WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({
      error: 'An account with this email is already registered.',
      referral_code: existing.referral_code
    });
  }

  // Check valid referrer
  let referrer = null;
  let source = 'direct';
  if (ref) {
    referrer = db.prepare('SELECT id, referral_code, name FROM students WHERE referral_code = ?').get(ref.trim().toUpperCase());
    if (referrer) {
      source = 'ambassador';
    }
  }

  // Generate unique code
  let newCode;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    newCode = generateReferralCode(name);
    const codeCheck = db.prepare('SELECT id FROM students WHERE referral_code = ?').get(newCode);
    if (!codeCheck) isUnique = true;
    attempts++;
  }

  const registerTransaction = db.transaction(() => {
    const studentInsert = db.prepare(`
      INSERT INTO students (name, email, phone, college, branch, graduation_year, referral_code, referred_by_code, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      email.trim().toLowerCase(),
      phone.trim(),
      college.trim(),
      branch.trim(),
      graduation_year || 2027,
      newCode,
      referrer ? referrer.referral_code : null,
      source
    );

    const studentId = studentInsert.lastInsertRowid;

    if (referrer) {
      db.prepare(`
        INSERT INTO referrals (referrer_id, referred_student_id, referral_code)
        VALUES (?, ?, ?)
      `).run(referrer.id, studentId, referrer.referral_code);
    }

    return { studentId, code: newCode };
  });

  try {
    const result = registerTransaction();
    res.status(201).json({
      success: true,
      studentId: result.studentId,
      referral_code: result.code,
      message: 'Registration successful!'
    });
  } catch (err) {
    res.status(500).json({ error: 'Database transaction failed: ' + err.message });
  }
});

// 4. Student Referral Dashboard Data
app.get('/api/students/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const student = db.prepare('SELECT * FROM students WHERE referral_code = ?').get(code);
    if (!student) return res.status(404).json({ error: 'Student not found with this code' });

    // Count referrals brought by this student
    const referralCount = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').get(student.id).count;

    // Count clicks
    const clicksCount = db.prepare('SELECT COUNT(*) as count FROM referral_clicks WHERE referral_code = ?').get(code).count;

    // Leaderboard ranking
    const rankQuery = `
      SELECT id, (
        SELECT COUNT(*) + 1 
        FROM (
          SELECT referrer_id, COUNT(*) as ref_count 
          FROM referrals 
          GROUP BY referrer_id
        ) sub 
        WHERE sub.ref_count > (
          SELECT COUNT(*) FROM referrals WHERE referrer_id = ?
        )
      ) as ranking
    `;
    const rankResult = db.prepare(rankQuery).get(student.id);

    // Milestones: 5, 10, 25, 50
    const milestones = [5, 10, 25, 50];
    const nextMilestone = milestones.find(m => m > referralCount) || 50;
    const neededForNext = Math.max(0, nextMilestone - referralCount);

    const conversionRate = clicksCount > 0 ? Math.round((referralCount / clicksCount) * 100) : 0;

    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        college: student.college,
        branch: student.branch,
        referral_code: student.referral_code
      },
      stats: {
        registrations: referralCount,
        clicks: clicksCount,
        conversionRate: `${conversionRate}%`,
        rank: rankResult ? rankResult.ranking : 1,
        nextMilestone,
        neededForNext
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Public / Student Leaderboard (Top 10)
app.get('/api/leaderboard', (req, res) => {
  try {
    const leaders = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.college,
        s.referral_code,
        COUNT(r.id) as registrations,
        (SELECT COUNT(*) FROM referral_clicks rc WHERE rc.referral_code = s.referral_code) as clicks
      FROM students s
      LEFT JOIN referrals r ON s.id = r.referrer_id
      GROUP BY s.id
      HAVING registrations > 0
      ORDER BY registrations DESC, clicks DESC
      LIMIT 10
    `).all();

    const formatted = leaders.map((item, index) => {
      const conv = item.clicks > 0 ? Math.round((item.registrations / item.clicks) * 100) : 0;
      return {
        rank: index + 1,
        name: item.name,
        college: item.college,
        referral_code: item.referral_code,
        clicks: item.clicks,
        registrations: item.registrations,
        conversionRate: `${conv}%`
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Admin Authentication & Dashboard APIs
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@campus500.demo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'demo123';

  if (email === adminEmail && password === adminPassword) {
    return res.json({ success: true, token: 'demo-admin-auth-token-campus500' });
  }
  return res.status(401).json({ error: 'Invalid admin credentials' });
});

// Admin Analytics Overview
app.get('/api/admin/metrics', (req, res) => {
  try {
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    const target = 500;
    const remaining = Math.max(0, target - totalStudents);

    // Today's registrations
    const today = db.prepare(`
      SELECT COUNT(*) as count FROM students 
      WHERE DATE(created_at) = DATE('now')
    `).get().count;

    // Active ambassadors (generated at least 1 referral)
    const activeAmbassadors = db.prepare(`
      SELECT COUNT(DISTINCT referrer_id) as count FROM referrals
    `).get().count;

    // Referral vs Direct Registrations
    const referralRegs = db.prepare('SELECT COUNT(*) as count FROM referrals').get().count;

    // Daily breakdown for the last 7 days
    const dailyRegistrations = db.prepare(`
      WITH RECURSIVE days(date) AS (
        SELECT DATE('now', '-6 days')
        UNION ALL
        SELECT DATE(date, '+1 day') FROM days WHERE date < DATE('now')
      )
      SELECT 
        d.date,
        COUNT(s.id) as registrations
      FROM days d
      LEFT JOIN students s ON DATE(s.created_at) = d.date
      GROUP BY d.date
      ORDER BY d.date ASC
    `).all();

    // Source Breakdown
    const sources = db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM students 
      GROUP BY source
    `).all();

    // Expenses
    const expensesTotal = db.prepare('SELECT SUM(amount) as spent FROM campaign_expenses').get().spent || 0;
    const totalBudget = 2000;
    const costPerRegistration = totalStudents > 0 ? (expensesTotal / totalStudents).toFixed(2) : 0;

    res.json({
      kpis: {
        totalRegistrations: totalStudents,
        target,
        remaining,
        todayRegistrations: today,
        activeAmbassadors,
        referralRegistrations: referralRegs
      },
      dailyRegistrations,
      sourceBreakdown: sources,
      budget: {
        total: totalBudget,
        spent: expensesTotal,
        remaining: Math.max(0, totalBudget - expensesTotal),
        costPerRegistration
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Students List (with filters & search)
app.get('/api/admin/students', (req, res) => {
  const { search = '', college = '', source = '' } = req.query;

  try {
    let query = `
      SELECT 
        s.id,
        s.name,
        s.email,
        s.phone,
        s.college,
        s.branch,
        s.graduation_year,
        s.referral_code,
        s.source,
        s.created_at,
        ref.name as referred_by_name
      FROM students s
      LEFT JOIN students ref ON s.referred_by_code = ref.referral_code
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (s.name LIKE ? OR s.email LIKE ? OR s.college LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (college) {
      query += ` AND s.college = ?`;
      params.push(college);
    }
    if (source) {
      query += ` AND s.source = ?`;
      params.push(source);
    }

    query += ` ORDER BY s.created_at DESC LIMIT 200`;

    const students = db.prepare(query).all(...params);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Expenses Management
app.get('/api/admin/expenses', (req, res) => {
  try {
    const expenses = db.prepare('SELECT * FROM campaign_expenses ORDER BY created_at DESC').all();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/expenses', (req, res) => {
  const { category, amount, description } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ error: 'Category and amount are required' });
  }
  try {
    const stmt = db.prepare('INSERT INTO campaign_expenses (category, amount, description) VALUES (?, ?, ?)');
    const info = stmt.run(category, parseFloat(amount), description || '');
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. AI Campaign Copilot (Dynamic Data Analysis + Gemini API / Fallback)
app.post('/api/admin/copilot', async (req, res) => {
  try {
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    const referralRegs = db.prepare('SELECT COUNT(*) as count FROM referrals').get().count;
    const sources = db.prepare('SELECT source, COUNT(*) as count FROM students GROUP BY source').all();
    const topAmbassador = db.prepare(`
      SELECT s.name, COUNT(r.id) as count 
      FROM students s 
      JOIN referrals r ON s.id = r.referrer_id 
      GROUP BY s.id 
      ORDER BY count DESC LIMIT 1
    `).get();

    const topCollege = db.prepare(`
      SELECT college, COUNT(*) as count 
      FROM students 
      GROUP BY college 
      ORDER BY count DESC LIMIT 1
    `).get();

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const prompt = `You are the AI Growth Copilot for Campus 500, a 7-day marketing campaign aiming for 500 engineering student registrations.
Current campaign data:
- Total registrations: ${totalStudents} / 500
- Referral registrations: ${referralRegs} (${Math.round((referralRegs / (totalStudents || 1)) * 100)}%)
- Source distribution: ${JSON.stringify(sources)}
- Top Ambassador: ${topAmbassador ? topAmbassador.name : 'None'} (${topAmbassador ? topAmbassador.count : 0} invites)
- Top College: ${topCollege ? topCollege.college : 'None'} (${topCollege ? topCollege.count : 0} signups)

Analyze these real campaign metrics and provide concise, high-impact growth advice in JSON format:
{
  "health": "On Track" | "Needs Attention" | "Pacing Well",
  "observation": "Brief observation citing these specific numbers",
  "recommendation": "One strategic tactical recommendation",
  "suggested_action": "Clear immediate action step for the campaign admin"
}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return res.json(JSON.parse(text));
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to algorithmic analysis:', geminiError.message);
      }
    }

    // Dynamic Algorithmic Analysis based on real DB metrics
    const referralRatio = totalStudents > 0 ? referralRegs / totalStudents : 0;
    let health = totalStudents >= 300 ? 'Ahead of Schedule' : totalStudents >= 100 ? 'On Track' : 'Needs Optimization';

    let observation = `Referral virality accounts for ${Math.round(referralRatio * 100)}% (${referralRegs}/${totalStudents}) of registrations. ${
      topCollege ? `${topCollege.college} represents the strongest demographic.` : ''
    }`;

    let recommendation = '';
    let suggestedAction = '';

    if (referralRatio > 0.5) {
      recommendation = `The peer referral loop is your highest ROI channel. Direct email/display shows lower velocity compared to ambassador shares.`;
      suggestedAction = `Double down on ${topAmbassador ? topAmbassador.name : 'the top ambassadors'} with an exclusive milestone bonus and invite them to share in 3 additional WhatsApp cohort groups.`;
    } else {
      recommendation = `Direct registrations are outpacing referral shares. The viral loop has not achieved critical velocity yet.`;
      suggestedAction = `Trigger an immediate WhatsApp notification prompt to all registered students spotlighting the top 3 leaderboard spots to trigger organic shares.`;
    }

    res.json({
      health,
      observation,
      recommendation,
      suggested_action: suggestedAction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed reset endpoint for quick testing in demo
app.post('/api/admin/reset-demo', (req, res) => {
  try {
    require('./seed');
    res.json({ success: true, message: 'Database refreshed with demo data' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wildcard route to serve index.html for direct link handling
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Campus 500 App live at: http://localhost:${PORT}`);
  console.log(`👑 Admin Login: admin@campus500.demo / demo123`);
  console.log(`===============================================`);
});