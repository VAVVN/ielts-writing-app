// server.js
// A small Express server with two jobs:
// 1. Serve the question bank (recent IELTS Academic Writing questions) to the frontend
// 2. Take a student's essay, send it to Claude, and return the most visible
//    mistakes with corrections plus a recommended version of the essay
//
// Run this with: npm install, then npm start
// You must set ANTHROPIC_API_KEY in a .env file (see .env.example)

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const questions = require('./questions.json');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the built React app (frontend/dist, produced by `npm run build` in
// frontend/) so the backend and frontend are one deployable service.
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Question types in the order they appear on the topic-selection screen.
const QUESTION_TYPES = {
  1: [
    { type: 'line', label: 'Line graph' },
    { type: 'bar', label: 'Bar chart' },
    { type: 'pie', label: 'Pie chart' },
    { type: 'table', label: 'Table' },
    { type: 'map', label: 'Map' },
    { type: 'diagram', label: 'Process / Diagram' },
  ],
  2: [
    { type: 'opinion', label: 'Opinion (agree / disagree)' },
    { type: 'discussion', label: 'Discussion (both views)' },
    { type: 'advantages', label: 'Advantages / Disadvantages' },
    { type: 'problem', label: 'Problem / Solution' },
    { type: 'twopart', label: 'Two-part question' },
  ],
};

// Groups the flat questions.json list by task and question type.
function buildQuestionGroups() {
  const groups = {};
  for (const task of [1, 2]) {
    groups[`task${task}`] = QUESTION_TYPES[task]
      .map(({ type, label }) => ({
        type,
        label,
        questions: questions
          .filter((q) => q.task === task && q.type === type)
          .sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .filter((group) => group.questions.length > 0);
  }
  return groups;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// One request returns both the mistakes and the recommended essay. Short
// JSON keys keep the output tokens down; /api/feedback expands them.
const FEEDBACK_SYSTEM_PROMPT = `You are an IELTS Writing teacher. Read the student's answer to an IELTS Academic Writing question and reply with:

1. "m": the most visible language mistakes (grammar, vocabulary, word form, spelling, punctuation, collocation), AT MOST 9, listed in the order they appear in the answer. Only real errors - if there are fewer, list fewer. For each:
  - "o": the wrong words copied EXACTLY, character for character, from the student's answer (keep it short: just the wrong words plus at most 2-3 words of context, so it can be found and highlighted). The "o" quotes must NOT overlap each other - never reuse the same words in two items
  - "c": the corrected version of those words
  - "e": ONE short explanation in Vietnamese (max 15 words)
2. "r": a recommended version of the WHOLE answer at Band 7.5-8 that keeps the student's own ideas, opinion, structure and examples as closely as possible, fixing the mistakes and upgrading the language. Do not add new arguments, but develop the student's points more fully where needed to reach the length. Length is strict - plan it by paragraph:
  - Task 1 (170-200 words): introduction (1 sentence), overview (2 sentences), then 2 body paragraphs of 60-75 words each reporting the key figures and comparisons from the data given.
  - Task 2 (270-320 words): introduction (40-50 words), 2 body paragraphs of 90-110 words each (topic sentence, explanation, example), conclusion (40-50 words).
  Separate paragraphs with a blank line.

Reply with raw JSON only, no code fence: {"m":[{"o":"","c":"","e":""}],"r":""}`;

// Sends the prompt to Claude and parses its reply, which should be pure
// JSON per the prompt instructions.
async function askClaudeForJson(system, userMessage, maxTokens) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', // update to whichever current model you want to use
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    return JSON.parse(rawText);
  } catch (parseErr) {
    // If the model ever wraps the JSON in markdown fences despite instructions,
    // strip them and try again before giving up.
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// GET /api/questions -> { task1: [{ type, label, questions }], task2: [...] }
app.get('/api/questions', (req, res) => {
  res.json(buildQuestionGroups());
});

// POST /api/feedback -> { mistakes: [{ original, correction, explanation }], recommended }
// body: { questionId: string, essay: string }
app.post('/api/feedback', async (req, res) => {
  try {
    const { questionId, essay } = req.body;

    if (!essay || !essay.trim()) {
      return res.status(400).json({ error: 'essay is required' });
    }

    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    let userMessage = `Task ${question.task}\nQuestion: ${question.prompt}`;
    // Task 1 feedback needs the chart data to check the figures the student reports.
    if (question.visual) {
      userMessage += `\nData shown: ${JSON.stringify(question.visual)}`;
    }
    userMessage += `\n\nStudent's answer:\n${essay}`;

    const parsed = await askClaudeForJson(FEEDBACK_SYSTEM_PROMPT, userMessage, 3000);

    res.json({
      mistakes: (parsed.m || []).slice(0, 9).map((m) => ({
        original: m.o,
        correction: m.c,
        explanation: m.e,
      })),
      recommended: parsed.r,
    });
  } catch (err) {
    console.error('Error in /api/feedback:', err);
    res.status(500).json({ error: 'Something went wrong checking the essay.' });
  }
});

// Any GET that isn't an API route or a static file falls through to the
// React app's index.html, so direct navigation/refresh works.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`IELTS writing backend running on http://localhost:${PORT}`);
});
