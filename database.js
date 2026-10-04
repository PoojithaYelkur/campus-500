const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'campus500_data.json');

function initData() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading DB, re-initializing', e);
    }
  }
  return {
    students: [],
    referrals: [],
    referral_clicks: [],
    campaign_expenses: []
  };
}

let dbData = initData();

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
}

const db = {
  raw: dbData,
  save,
  prepare(sql) {
    const s = sql.trim().toLowerCase();

    // 1. DELETE
    if (s.startsWith('delete from')) {
      return {
        run: () => {
          if (s.includes('referrals')) dbData.referrals = [];
          else if (s.includes('referral_clicks')) dbData.referral_clicks = [];
          else if (s.includes('campaign_expenses')) dbData.campaign_expenses = [];
          else if (s.includes('students')) dbData.students = [];
          save();
          return { changes: 1 };
        }
      };
    }

    // 2. INSERT INTO STUDENTS
    if (s.startsWith('insert into students')) {
      return {
        run: (nameOrObj, email, phone, college, branch, graduation_year, referral_code, referred_by_code, source) => {
          let row;
          if (typeof nameOrObj === 'object' && nameOrObj !== null) {
            row = {
              id: dbData.students.length + 1,
              ...nameOrObj,
              created_at: nameOrObj.created_at || new Date().toISOString()
            };
          } else {
            row = {
              id: dbData.students.length + 1,
              name: nameOrObj,
              email,
              phone,
              college,
              branch,
              graduation_year: graduation_year || 2027,
              referral_code,
              referred_by_code,
              source: source || 'direct',
              is_demo: 0,
              created_at: new Date().toISOString()
            };
          }
          dbData.students.push(row);
          save();
          return { lastInsertRowid: row.id };
        }
      };
    }

    // 3. INSERT INTO REFERRALS
    if (s.startsWith('insert into referrals')) {
      return {
        run: (referrer_id, referred_student_id, referral_code, created_at) => {
          const row = {
            id: dbData.referrals.length + 1,
            referrer_id,
            referred_student_id,
            referral_code,
            created_at: created_at || new Date().toISOString()
          };
          dbData.referrals.push(row);
          save();
          return { lastInsertRowid: row.id };
        }
      };
    }

    // 4. INSERT INTO REFERRAL_CLICKS
    if (s.startsWith('insert into referral_clicks')) {
      return {
        run: (referral_code, channel, created_at) => {
          const row = {
            id: dbData.referral_clicks.length + 1,
            referral_code,
            channel: channel || 'web',
            created_at: created_at || new Date().toISOString()
          };
          dbData.referral_clicks.push(row);
          save();
          return { lastInsertRowid: row.id };
        }
      };
    }

    // 5. INSERT INTO CAMPAIGN_EXPENSES
    if (s.startsWith('insert into campaign_expenses')) {
      return {
        run: (category, amount, description, created_at) => {
          const row = {
            id: dbData.campaign_expenses.length + 1,
            category,
            amount: Number(amount),
            description: description || '',
            created_at: created_at || new Date().toISOString()
          };
          dbData.campaign_expenses.push(row);
          save();
          return { lastInsertRowid: row.id };
        }
      };
    }

    // 6. SELECT QUERIES
    return {
      get: (...args) => {
        // COUNT(*) from students
        if (s.includes('select count(*) as count from students') || s.includes('select count(*) as total from students')) {
          if (s.includes("date(created_at) = date('now')")) {
            const todayStr = new Date().toISOString().split('T')[0];
            const count = dbData.students.filter(st => st.created_at && st.created_at.startsWith(todayStr)).length;
            return { count, total: count };
          }
          return { count: dbData.students.length, total: dbData.students.length };
        }

        // COUNT(*) from referrals
        if (s.includes('select count(*) as count from referrals')) {
          if (s.includes('where referrer_id = ?')) {
            const referrerId = args[0];
            const count = dbData.referrals.filter(r => r.referrer_id === referrerId).length;
            return { count };
          }
          return { count: dbData.referrals.length };
        }

        // Active ambassadors
        if (s.includes('count(distinct referrer_id) as count from referrals')) {
          const unique = new Set(dbData.referrals.map(r => r.referrer_id));
          return { count: unique.size };
        }

        // Referral clicks
        if (s.includes('from referral_clicks where referral_code = ?')) {
          const code = args[0];
          const count = dbData.referral_clicks.filter(c => c.referral_code === code).length;
          return { count };
        }

        // Check student by email
        if (s.includes('from students where lower(email) = lower(?)')) {
          const target = (args[0] || '').toLowerCase();
          return dbData.students.find(st => st.email.toLowerCase() === target) || null;
        }

        // Student by referral_code
        if (s.includes('from students where referral_code = ?')) {
          const code = (args[0] || '').toUpperCase();
          return dbData.students.find(st => st.referral_code.toUpperCase() === code) || null;
        }

        // Ambassador ranking calculation
        if (s.includes('ranking')) {
          const studentId = args[0];
          const myCount = dbData.referrals.filter(r => r.referrer_id === studentId).length;
          const refCounts = {};
          dbData.referrals.forEach(r => {
            refCounts[r.referrer_id] = (refCounts[r.referrer_id] || 0) + 1;
          });
          const ranksAhead = Object.values(refCounts).filter(c => c > myCount).length;
          return { ranking: ranksAhead + 1 };
        }

        // Expenses total
        if (s.includes('sum(amount) as spent from campaign_expenses')) {
          const spent = dbData.campaign_expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
          return { spent };
        }

        // Top Ambassador
        if (s.includes('from students s') && s.includes('join referrals r') && s.includes('limit 1')) {
          const map = {};
          dbData.referrals.forEach(r => {
            map[r.referrer_id] = (map[r.referrer_id] || 0) + 1;
          });
          const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
          if (!sorted.length) return null;
          const topStudent = dbData.students.find(st => st.id === Number(sorted[0][0]));
          return topStudent ? { name: topStudent.name, count: sorted[0][1] } : null;
        }

        // Top College
        if (s.includes('group by college') && s.includes('limit 1')) {
          const map = {};
          dbData.students.forEach(st => {
            map[st.college] = (map[st.college] || 0) + 1;
          });
          const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
          return sorted.length ? { college: sorted[0][0], count: sorted[0][1] } : null;
        }

        return null;
      },

      all: (...args) => {
        // Daily registrations for past 7 days
        if (s.includes('with recursive days') || s.includes('group by d.date')) {
          const results = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
            const regs = dbData.students.filter(st => st.created_at && st.created_at.startsWith(d)).length;
            results.push({ date: d, registrations: regs });
          }
          return results;
        }

        // Source breakdown
        if (s.includes('select source, count(*) as count from students group by source')) {
          const map = {};
          dbData.students.forEach(st => {
            const src = st.source || 'direct';
            map[src] = (map[src] || 0) + 1;
          });
          return Object.entries(map).map(([source, count]) => ({ source, count }));
        }

        // Leaderboard
        if (s.includes('from students s') && s.includes('left join referrals r') && s.includes('order by registrations desc')) {
          const refCounts = {};
          dbData.referrals.forEach(r => {
            refCounts[r.referrer_id] = (refCounts[r.referrer_id] || 0) + 1;
          });

          return dbData.students
            .map(st => {
              const registrations = refCounts[st.id] || 0;
              const clicks = dbData.referral_clicks.filter(c => c.referral_code === st.referral_code).length;
              return {
                id: st.id,
                name: st.name,
                college: st.college,
                referral_code: st.referral_code,
                registrations,
                clicks
              };
            })
            .filter(item => item.registrations > 0)
            .sort((a, b) => b.registrations - a.registrations || b.clicks - a.clicks)
            .slice(0, 10);
        }

        // Campaign expenses
        if (s.includes('from campaign_expenses')) {
          return [...dbData.campaign_expenses].reverse();
        }

        // Admin students with search & filter
        if (s.includes('from students s') && s.includes('order by s.created_at desc')) {
          let list = dbData.students.map(st => {
            const refStudent = st.referred_by_code
              ? dbData.students.find(ref => ref.referral_code === st.referred_by_code)
              : null;
            return {
              ...st,
              referred_by_name: refStudent ? refStudent.name : null
            };
          });

          let pIndex = 0;
          if (s.includes('name like ?')) {
            const search = (args[pIndex++] || '').replace(/%/g, '').toLowerCase();
            list = list.filter(st =>
              st.name.toLowerCase().includes(search) ||
              st.email.toLowerCase().includes(search) ||
              st.college.toLowerCase().includes(search)
            );
          }
          if (s.includes('s.college = ?')) {
            const col = args[pIndex++];
            list = list.filter(st => st.college === col);
          }
          if (s.includes('s.source = ?')) {
            const src = args[pIndex++];
            list = list.filter(st => st.source === src);
          }

          return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
        }

        return [];
      }
    };
  },

  transaction(fn) {
    return (...args) => {
      const res = fn(...args);
      save();
      return res;
    };
  }
};

module.exports = db;