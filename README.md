# IELTS Writing Practice

Practice IELTS Academic Writing with recent exam questions (Task 1 and Task 2, reported from real tests since 1 September 2026). After you submit, the app highlights up to 9 of the most visible mistakes, shows the corrections, and gives a recommended version of your answer that keeps your own ideas.

Same look and setup as the IELTS Speaking Practice app.

## Setup

```bash
# backend
cd backend
cp .env.example .env   # then put your Anthropic API key in .env
npm install

# frontend
cd ../frontend
npm install
npm run build
```

## Run

```bash
cd backend
npm start
```

Open http://localhost:3002.

For development with auto-reload, run `npm run dev` in `backend/` and `npm run dev` in `frontend/` (then open the address Vite prints).

## Questions

`backend/questions.json` holds the question bank: 3 questions per Task 1 visual type (line, bar, pie, table, map; only 1 process diagram was reported this quarter) and 3 per Task 2 essay type (opinion, discussion, advantages/disadvantages, problem/solution, two-part). Reported questions don't include the real chart numbers, so the Task 1 data is illustrative and the app says so under each visual. To add a question, add an entry with the same shape and restart the backend.
