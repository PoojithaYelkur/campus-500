const db = require('./database');

console.log('🌱 Seeding Campus 500 demo data...');

// Clear existing demo data
db.prepare('DELETE FROM referrals').run();
db.prepare('DELETE FROM referral_clicks').run();
db.prepare('DELETE FROM campaign_expenses').run();
db.prepare('DELETE FROM students').run();

const colleges = [
  'IIT Bombay', 'BITS Pilani', 'Delhi Technological University (DTU)',
  'VIT Vellore', 'RV College of Engineering', 'Manipal Institute of Tech',
  'Thapar Institute', 'College of Engineering Pune (COEP)'
];

const branches = [
  'Computer Science & Engg', 'Information Technology',
  'Electronics & Comm (ECE)', 'Data Science & AI', 'Mechanical Engg'
];

const sources = ['direct', 'whatsapp', 'ambassador', 'college_club', 'email'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCode(name, id) {
  const clean = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
  return `${clean.slice(0, 5)}${10 + id}`;
}

// 1. Seed Core Ambassadors
const ambassadors = [
  { name: 'Rahul Sharma', email: 'rahul.s@dtu.ac.in', phone: '9876543210', college: 'Delhi Technological University (DTU)', branch: 'Computer Science & Engg', code: 'RAHUL42' },
  { name: 'Priya Iyer', email: 'priya.i@vit.ac.in', phone: '9876543211', college: 'VIT Vellore', branch: 'Data Science & AI', code: 'PRIYA88' },
  { name: 'Arjun Verma', email: 'arjun.v@bits.ac.in', phone: '9876543212', college: 'BITS Pilani', branch: 'Computer Science & Engg', code: 'ARJUN21' },
  { name: 'Sneha Patel', email: 'sneha.p@coep.ac.in', phone: '9876543213', college: 'College of Engineering Pune (COEP)', branch: 'Information Technology', code: 'SNEHA15' },
  { name: 'Kavya Nair', email: 'kavya.n@rvce.ac.in', phone: '9876543214', college: 'RV College of Engineering', branch: 'Electronics & Comm (ECE)', code: 'KAVYA99' }
];

const insertStudent = db.prepare(`
  INSERT INTO students (name, email, phone, college, branch, graduation_year, referral_code, referred_by_code, source, is_demo, created_at)
  VALUES (@name, @email, @phone, @college, @branch, @graduation_year, @referral_code, @referred_by_code, @source, 1, @created_at)
`);

const insertReferral = db.prepare(`
  INSERT INTO referrals (referrer_id, referred_student_id, referral_code, created_at)
  VALUES (?, ?, ?, ?)
`);

const insertClick = db.prepare(`
  INSERT INTO referral_clicks (referral_code, channel, created_at)
  VALUES (?, ?, ?)
`);

// Insert ambassadors first (Day 1-2)
const ambassadorIds = [];
for (let i = 0; i < ambassadors.length; i++) {
  const a = ambassadors[i];
  const date = new Date(Date.now() - (6 - (i % 2)) * 86400000).toISOString();
  const info = insertStudent.run({
    name: a.name,
    email: a.email,
    phone: a.phone,
    college: a.college,
    branch: a.branch,
    graduation_year: 2027,
    referral_code: a.code,
    referred_by_code: null,
    source: 'college_club',
    created_at: date
  });
  ambassadorIds.push({ id: info.lastInsertRowid, code: a.code });
}

// 2. Generate 115 demo students
const firstNames = ['Aarav', 'Ananya', 'Rohan', 'Tanvi', 'Ishaan', 'Meera', 'Aditya', 'Diya', 'Vikram', 'Pooja', 'Siddharth', 'Nisha', 'Kabir', 'Rhea', 'Dev', 'Tara'];
const lastNames = ['Gupta', 'Singh', 'Deshmukh', 'Chopra', 'Rao', 'Reddy', 'Mehta', 'Kulkarni', 'Bansal', 'Jain'];

for (let i = 1; i <= 115; i++) {
  const fn = randomChoice(firstNames);
  const ln = randomChoice(lastNames);
  const fullName = `${fn} ${ln}`;
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@demo.edu`;
  const phone = `9811${String(100000 + i).slice(0, 6)}`;
  const college = randomChoice(colleges);
  const branch = randomChoice(branches);
  const refCode = generateCode(fullName, i);

  // Distribution: ~70% referrals (most to top 3 ambassadors), ~30% organic
  const isReferral = Math.random() < 0.72;
  let referrer = null;
  let source = 'direct';

  if (isReferral) {
    // Weighted towards top ambassadors
    const rand = Math.random();
    if (rand < 0.45) referrer = ambassadorIds[0]; // Rahul
    else if (rand < 0.75) referrer = ambassadorIds[1]; // Priya
    else if (rand < 0.90) referrer = ambassadorIds[2]; // Arjun
    else referrer = randomChoice(ambassadorIds);
    source = 'ambassador';
  } else {
    source = randomChoice(['direct', 'whatsapp', 'email', 'college_club']);
  }

  // Staggered registration across the past 7 days
  const daysAgo = Math.floor(Math.random() * 7);
  const hoursAgo = Math.floor(Math.random() * 24);
  const createdAt = new Date(Date.now() - (daysAgo * 86400000 + hoursAgo * 3600000)).toISOString();

  const res = insertStudent.run({
    name: fullName,
    email,
    phone,
    college,
    branch,
    graduation_year: 2027,
    referral_code: refCode,
    referred_by_code: referrer ? referrer.code : null,
    source,
    created_at: createdAt
  });

  if (referrer) {
    insertReferral.run(referrer.id, res.lastInsertRowid, referrer.code, createdAt);
  }
}

// 3. Insert realistic referral clicks
ambassadorIds.forEach(amb => {
  const clickCount = Math.floor(Math.random() * 40) + 40;
  for (let c = 0; c < clickCount; c++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    insertClick.run(amb.code, randomChoice(['whatsapp', 'linkedin', 'direct']), createdAt);
  }
});

// 4. Seed initial Campaign Expenses
const insertExpense = db.prepare('INSERT INTO campaign_expenses (category, amount, description, created_at) VALUES (?, ?, ?, ?)');
insertExpense.run('Creative/design', 350, 'Canva Pro flyers & WhatsApp creative kit', new Date(Date.now() - 6 * 86400000).toISOString());
insertExpense.run('Ambassador incentives', 300, 'Top ambassador milestone reward token', new Date(Date.now() - 3 * 86400000).toISOString());
insertExpense.run('Paid promotion', 200, 'Targeted student club broadcast spotlight', new Date(Date.now() - 2 * 86400000).toISOString());

console.log('✅ Demo data successfully seeded! Total students in DB:', db.prepare('SELECT COUNT(*) as count FROM students').get().count);