# Campus 500 🚀

### A 7-Day Growth & Referral Platform for Final-Year Engineering Students

Campus 500 is a growth experiment designed to answer one question:

> **How can we get 500 final-year engineering students to register in 7 days with a budget of only ₹2,000?**

The project combines a **student registration experience, referral engine, ambassador leaderboard, campaign analytics, and AI-powered campaign recommendations** into one platform.

---

## 🎯 The Problem

The goal is to get **500 final-year engineering students** to register within:

* **Duration:** 7 days
* **Target:** 500 registrations
* **Budget:** ₹2,000

Instead of relying heavily on paid advertising, Campus 500 uses the existing networks of engineering students:

**Student Ambassadors → WhatsApp & College Communities → Referrals → Registrations**

The idea is to turn students themselves into distribution channels.

---

## 💡 What Are Students Registering For?

Campus 500 is designed as a **7-day AI & Technology Sprint for final-year engineering students**.

Students join the sprint to:

* Build practical technology projects
* Explore AI workflows and tools
* Improve their project portfolio
* Learn alongside other final-year engineering students
* Participate in a peer-driven learning experience

The campaign is intentionally designed around skills, projects, and peer learning rather than making unsupported promises about jobs or placements.

---

# 📈 Growth Strategy

The campaign focuses on three primary acquisition channels.

### 1. Student Ambassadors — Primary Channel

Recruit approximately 20 student ambassadors.

Each ambassador receives a unique referral link.

Example:

```text
/register?ref=ARJUN42
```

Ambassadors share their links through:

* WhatsApp groups
* Department groups
* College communities
* Coding/AI clubs
* Peer networks

---

### 2. WhatsApp & Student Communities

The target audience already communicates through existing student communities.

Instead of spending the entire ₹2,000 on advertising, the campaign uses these communities as distribution channels.

The registration flow is optimized for mobile and includes a direct WhatsApp sharing option.

---

### 3. Referral Loop

After registering, every student receives a unique referral link.

The flow becomes:

```text
Student sees campaign
        ↓
Registers
        ↓
Gets referral link
        ↓
Shares with friends
        ↓
Friends register
        ↓
Referral gets tracked
        ↓
Leaderboard updates
```

This creates a repeatable growth loop.

---

# 🧮 Registration Target

The 500-registration target is treated as an operating goal rather than a guaranteed outcome.

An example planning model:

| Channel                 | Potential Registrations |
| ----------------------- | ----------------------: |
| Student Ambassadors     |                     300 |
| College Communities     |                     150 |
| Email / Direct Outreach |                      50 |
| Referral Spillover      |                     50+ |
| **Target**              |                **500+** |

These numbers are planning assumptions that would be validated and adjusted using real campaign data during the first 24 hours.

---

# 🛠️ What I Built

Instead of building only a static landing page, I built a working **growth and referral platform**.

## Student Registration

Students can register using:

* Name
* Email
* Phone
* College
* Engineering branch
* Graduation year

Each student receives a unique referral code after registration.

---

## 🔗 Referral System

Each registered student receives a unique referral link.

Example:

```text
https://campus-500.onrender.com/register?ref=ARJUN42
```

When another student registers using the link, the system attributes that registration to the original student.

Duplicate registrations are prevented using email validation.

---

## 📱 WhatsApp Sharing

Students can directly share their referral link through WhatsApp.

Example:

```text
Hey! I'm joining Campus 500.

You should join too 👇

[Referral Link]
```

This makes the referral mechanism easy to use on mobile.

---

# 🏆 Ambassador Leaderboard

The platform tracks ambassador performance.

Example:

| Rank | Ambassador | Registrations |
| ---: | ---------- | ------------: |
|    1 | Rahul      |            61 |
|    2 | Priya      |            54 |
|    3 | Arjun      |            43 |

The leaderboard creates visibility and encourages students to bring more registrations.

---

# 📊 Admin Campaign Dashboard

The admin dashboard provides an overview of campaign performance.

It includes:

* Total registrations
* Progress toward 500
* Daily registrations
* Active ambassadors
* Referral registrations
* Registration sources
* Ambassador leaderboard
* Student registration data
* Campaign expenses

The goal is to make campaign decisions using data instead of assumptions.

---

# 🤖 AI Campaign Copilot

The platform also includes an AI-assisted campaign analysis feature.

The AI Campaign Copilot analyzes campaign metrics and suggests actions.

For example:

> **Observation:** Referral registrations are increasing while email conversion is low.

> **Recommendation:** Focus the next campaign push on the top-performing ambassadors rather than increasing email activity.

The goal is not to let AI make every decision.

Instead:

**Data → AI suggestion → Human judgment → Campaign action**

---

# 💰 Budget Strategy

The total campaign budget is:

## ₹2,000

A possible allocation:

| Category                   |     Budget |
| -------------------------- | ---------: |
| Ambassador incentives      |     ₹1,200 |
| Creative / campaign assets |       ₹300 |
| Contingency / testing      |       ₹500 |
| **Total**                  | **₹2,000** |

Paid advertising is deliberately not the primary acquisition strategy because ₹2,000 is a small budget for reaching 500 students.

The first priority is to validate organic/referral acquisition before spending heavily.

---

# 🧠 Key Product Decision

My initial instinct was to build a conventional landing page and promote it through multiple channels.

I changed the approach after considering the campaign constraints.

A landing page can explain the opportunity, but it does not solve the core growth problem:

> **How do we get students to distribute the campaign to other students?**

Therefore, I built the referral engine and campaign dashboard around the landing page.

The landing page gets the student interested.

The referral system turns that student into a distribution channel.

The dashboard measures whether the strategy is working.

---

# 🧪 7-Day Campaign Experiment

### Day 1 — Seed

Recruit student ambassadors and target the first 50–75 registrations.

### Day 2 — Test

Test different registration messages and identify which message converts better.

### Day 3–4 — Scale

Give the best-performing message to ambassadors and expand through college communities.

### Day 5 — Referral Push

Encourage existing registrants to bring friends through their unique links.

### Day 6 — Optimize

Focus on the ambassadors, colleges and channels producing the highest conversion.

### Day 7 — Final Push

Use final-day messaging and referral activity to reach the 500-registration target.

---

# 🚀 Running Locally

Clone the repository:

```bash
git clone https://github.com/PoojithaYelkur/campus-500
```

Move into the project:

```bash
cd campus-500
```

Install frontend dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

For the backend, create environment and install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

---

# 🌐 Live Demo

**Live Website:**

https://campus-500.onrender.com/

---


# 👤 Project Philosophy

The core idea behind Campus 500 is:

> **Don't try to reach 500 students one by one. Build a system that turns students into distribution channels.**

The project combines:

**Growth Strategy + Product + Analytics + Referral Mechanics + AI-assisted Decision Making**

into one experiment.