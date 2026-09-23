# 📋 16Bits OmniOps — Teammate Task Delegation & Scope

**Project:** 16Bits OmniOps  
**Team:** 3 Members (Dhanush, Teammate 2, Teammate 3)  
**Status:** Core Heavy Lifting (Backend Swarm, SQLite DB, Webhook, and Frontend UI) is **100% COMPLETE & LIVE**.  

---

## 💡 The Core Idea Explained (Like You Are 5 Years Old)

> Imagine a giant building catches fire. 🔥  
> **How humans do it today:**  
> One human security guard has to run to the basement, search through dusty filing cabinets for the building blueprint, call the building owner to ask if it's okay to turn on the water sprinklers, and write apology emails to everyone in the building. It takes **45 minutes**, and by then, the building is burned down.  
>  
> **How 16Bits OmniOps does it:**  
> We have a team of **4 super-fast robots** who work together in **3.8 seconds**:  
> 1. 🧠 **Robot 1 (The Boss)**: "Alarm ringing! Here is our 3-step battle plan."  
> 2. 🔍 **Robot 2 (The Detective)**: Instantly reads the thermometer, checks the building water tank, and reads the building instruction manual (Runbook).  
> 3. 🛡️ **Robot 3 (The Safety Guard)**: "Wait! Sprinklers will get the computers wet. Boss, press this BIG RED BUTTON to confirm you want to turn on sprinklers."  
> 4. 📢 **Robot 4 (The Fixer)**: Turns on the sprinklers, texts the fire chief, and emails everyone in the building!  

---

## 🎯 Strict Scope Delegation (Zero Merge Conflicts)

All heavy lifting is done. Here are the specific, isolated tasks for Teammates 2 and 3:

---

### 🎨 Teammate 2: Data & Scenario Specialist (Frontend & Runbooks)
*Your role is to add rich data and test the live application from your laptop/phone.*

#### Your Tasks:
1. **Add 2 More SOP Runbooks into `backend/runbooks/`**:
   - Create `backend/runbooks/auth-service-timeout.md`:
     - Condition: JWT service latency > 500ms.
     - Actions: Flush expired tokens, scale Redis auth cluster.
   - Create `backend/runbooks/aws-s3-upload-throttling.md`:
     - Condition: S3 uploading returning 503 SlowDown.
     - Actions: Partition upload prefixes with hash keys.
   *(Creating these markdown files gives our agent even more real enterprise knowledge to show judges!)*

2. **Test Real External Webhook Ingestion from your Laptop**:
   - Open your terminal and send this curl request to Dhanush's server:
     ```bash
     curl -X POST http://localhost:8000/api/agents/webhook/alert \
       -H "Content-Type: application/json" \
       -d '{"service": "payment-api", "error": "Stripe webhook queue overflow (3,500 unacked)", "severity": "CRITICAL"}'
     ```
   - Watch the dashboard update live on Dhanush's screen!

3. **Verify Mobile Responsiveness**:
   - Open `http://<Dhanush-IP>:5173` on your smartphone browser.
   - Confirm the buttons are easy to tap and the "Copy Fix" button works cleanly.

---

### 🎙️ Teammate 3: Pitch Lead & Video Director (Presentation & Submission)
*Your role is to ensure our presentation is championship-grade and record the mandatory submission video.*

#### Your Tasks:
1. **Slidev Deck Polish (`presentation/slides.md`)**:
   - Run `cd presentation && npm run dev` (Port 3030).
   - Ensure all 3 team member names and college registration IDs are on Slide 1 and Slide 7.

2. **Master the 3-Minute Judging Pitch**:
   - **Minute 0:00 – 0:45 (The Hook)**:
     *"Every day, companies lose millions when payments or servers crash. Humans take 45 minutes to triage alerts across 10 dashboards. That downtime costs $5,600 per minute."*
   - **Minute 0:45 – 1:30 (The 4-Agent Architecture)**:
     *"We built 16Bits OmniOps: an autonomous 4-agent swarm. Planner decomposes the task, Investigator reads real server telemetry and disk runbooks, Verifier enforces safety guardrails, and Synthesizer generates the fix."*
   - **Minute 1:30 – 2:30 (The Live Demo)**:
     *Hand off to Dhanush: Show the live dashboard, trigger an incident, watch it resolve in 3.8 seconds, and click 'Authorize Execution'.*
   - **Minute 2:30 – 3:00 (Business Impact & Closing)**:
     *"Reduces downtime by 99%, guarantees zero hallucinated commands via human-in-the-loop, and stores every action in SQLite. Thank you!"*

3. **Record the Mandatory 3–5 Minute Demo Video** *(Deadline: 1:00 PM)*:
   - Use OBS Studio, Loom, or phone camera + screen capture.
   - Show:
     1. Slidev slides (Problem & 4-Agent diagram).
     2. Web Dashboard resolving an incident live.
     3. The curl webhook command executing from terminal.
   - Upload video to unlisted YouTube / Google Drive link for the submission form.

---

### 🧠 Dhanush: Lead Systems Architect (Full-Stack Engine)
- Express API, SQLite database, Gemini/Groq inference, and React dashboard live on `http://localhost:8000` and `http://localhost:5173`.
- Lead technical Q&A during judges' inspection.
