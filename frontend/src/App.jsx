import { useState, useEffect } from 'react';
import Visual from './Visuals.jsx';

// The main flow this component handles:
// 1. Load the question bank from the backend, grouped by Task 1 / Task 2
//    question type (recent exam questions since September 2026)
// 2. Student picks a question and writes their answer (with a live word count)
// 3. Submit -> backend calls Claude -> show the answer with at most 9 mistakes
//    highlighted, the corrections underneath, and a recommended version
// 4. Student can edit and resubmit, or go back and pick another question

const MIN_WORDS = { 1: 150, 2: 250 };

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// Splits the essay into plain and highlighted pieces. Each mistake's
// `original` is located in the essay (searching forward from the previous
// match, since mistakes are listed in order). Mistakes whose text overlaps
// share one highlight showing all their numbers; ones that can't be found
// are still listed under the essay, just not highlighted.
function buildHighlightedSegments(essay, mistakes) {
  const ranges = [];
  let cursor = 0;
  mistakes.forEach((mistake, index) => {
    if (!mistake.original) return;
    let start = essay.indexOf(mistake.original, cursor);
    if (start === -1) start = essay.indexOf(mistake.original);
    if (start === -1) return;
    const end = start + mistake.original.length;
    const overlapping = ranges.find((r) => start < r.end && end > r.start);
    if (overlapping) {
      overlapping.start = Math.min(overlapping.start, start);
      overlapping.end = Math.max(overlapping.end, end);
      overlapping.indexes.push(index);
    } else {
      ranges.push({ start, end, indexes: [index] });
    }
    cursor = end;
  });
  ranges.sort((a, b) => a.start - b.start);

  const segments = [];
  let position = 0;
  for (const range of ranges) {
    if (range.start < position) continue; // swallowed by an earlier merged range
    if (range.start > position) segments.push({ text: essay.slice(position, range.start) });
    segments.push({ text: essay.slice(range.start, range.end), indexes: range.indexes });
    position = range.end;
  }
  if (position < essay.length) segments.push({ text: essay.slice(position) });
  return { segments, highlighted: new Set(ranges.flatMap((r) => r.indexes)) };
}

function QuestionCard({ question }) {
  return (
    <section className="question-card">
      <span className="part-label">
        Task {question.task} &middot; đề thi ngày {formatDate(question.date)}
      </span>
      <p className="question-text">{question.prompt}</p>
      {question.task === 1 && (
        <p className="task-instruction">
          Summarise the information by selecting and reporting the main features, and make comparisons where relevant.
        </p>
      )}
      {question.visual && <Visual visual={question.visual} />}
    </section>
  );
}

function DonateFooter() {
  return (
    <footer className="donate-footer">
      <p>
        Web vẫn đang trong quá trình phát triển và hoàn toàn miễn phí. Nếu bạn muốn ủng hộ,
        hãy tặng cho chủ website 1 ly cà phê nhé.
      </p>
      <img className="donate-qr" src="/donate-qr.png" alt="Mã QR ủng hộ - VPBank, VUONG ANH VU, 0905350006" />
      <p>Chúc bạn học vui vẻ và hiệu quả!</p>
      <p>Mọi góp ý xin gửi về Zalo số 0905350006.</p>
    </footer>
  );
}

export default function App() {
  const [groups, setGroups] = useState(null);
  const [question, setQuestion] = useState(null);
  const [essay, setEssay] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/questions')
      .then((res) => res.json())
      .then((data) => setGroups(data))
      .catch(() => setError('Could not load questions. Is the backend running?'));
  }, []);

  function handleSelectQuestion(q) {
    setQuestion(q);
    setEssay('');
    setFeedback(null);
    setError(null);
    window.scrollTo(0, 0);
  }

  function handleBackToQuestions() {
    setQuestion(null);
    setFeedback(null);
    setError(null);
  }

  function handleEditAgain() {
    setFeedback(null);
    window.scrollTo(0, 0);
  }

  async function handleSubmit() {
    if (!essay.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, essay }),
      });

      if (!res.ok) {
        throw new Error('Feedback request failed');
      }

      setFeedback(await res.json());
      window.scrollTo(0, 0);
    } catch (err) {
      setError('Có lỗi khi chấm bài. Bạn vui lòng thử lại nhé.');
    } finally {
      setLoading(false);
    }
  }

  if (!question) {
    return (
      <div className="page">
        <header className="header">
          <h1>IELTS Writing Practice</h1>
          <p className="subtitle">Chọn đề để luyện tập cho quý này (tháng 9-12 2026)</p>
          <p className="header-note">Đề được tổng hợp từ các bài thi IELTS Academic thật từ 01/09/2026.</p>
        </header>

        {error && <p className="error-text">{error}</p>}

        {groups && (
          <div className="topic-columns">
            {[
              ['task1', 'Task 1'],
              ['task2', 'Task 2'],
            ].map(([key, title]) => (
              <section key={key} className="topic-section">
                <h2 className="topic-section-title">{title}</h2>
                {groups[key].map((group) => (
                  <div key={group.type} className="type-group">
                    <h3 className="type-title">{group.label}</h3>
                    <ul className="topic-list">
                      {group.questions.map((q) => (
                        <li key={q.id}>
                          <button className="topic-list-item question-item" onClick={() => handleSelectQuestion(q)}>
                            <span className="question-item-text">{q.prompt.split('\n')[0]}</span>
                            <span className="question-item-date">{formatDate(q.date)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}

        {!groups && !error && <p>Loading questions...</p>}

        <DonateFooter />
      </div>
    );
  }

  const wordCount = countWords(essay);
  const minWords = MIN_WORDS[question.task];

  return (
    <div className="page">
      <header className="header">
        <h1>IELTS Writing Practice</h1>
        <button className="back-link" onClick={handleBackToQuestions}>
          &larr; Quay lại danh sách đề
        </button>
      </header>

      <QuestionCard question={question} />

      {!feedback && (
        <section className="answer-section">
          <textarea
            className="answer-input essay-input"
            placeholder={`Viết bài của bạn ở đây (ít nhất ${minWords} từ)...`}
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            rows={16}
            disabled={loading}
          />
          <div className="essay-footer">
            <span className={wordCount >= minWords ? 'word-count enough' : 'word-count'}>
              {wordCount} / {minWords} từ
            </span>
            <button className="primary-button" onClick={handleSubmit} disabled={loading || !essay.trim()}>
              {loading ? 'Đang chấm bài...' : 'Nộp bài'}
            </button>
          </div>
          {loading && <p className="loading-note">Đang tìm lỗi và viết bài đề xuất, khoảng 20-30 giây...</p>}
          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      {feedback && <FeedbackResult essay={essay} feedback={feedback} />}

      {feedback && (
        <div className="button-row result-buttons">
          <button className="secondary-button" onClick={handleEditAgain}>
            Sửa bài và nộp lại
          </button>
          <button className="primary-button" onClick={handleBackToQuestions}>
            Chọn đề khác
          </button>
        </div>
      )}

      <DonateFooter />
    </div>
  );
}

function FeedbackResult({ essay, feedback }) {
  const { segments, highlighted } = buildHighlightedSegments(essay, feedback.mistakes);

  return (
    <section className="result-section">
      <div className="essay-card">
        <h3>Bài viết của bạn</h3>
        <p className="essay-text">
          {segments.map((segment, i) =>
            segment.indexes == null ? (
              <span key={i}>{segment.text}</span>
            ) : (
              <mark key={i} className="mistake-mark">
                {segment.text}
                <sup className="mistake-number">{segment.indexes.map((n) => n + 1).join(',')}</sup>
              </mark>
            )
          )}
        </p>
      </div>

      <div className="essay-card">
        <h3>
          {feedback.mistakes.length > 0
            ? `Lỗi cần sửa (${feedback.mistakes.length})`
            : 'Không tìm thấy lỗi rõ ràng nào - tốt lắm!'}
        </h3>
        {feedback.mistakes.length > 0 && (
          <ol className="correction-list">
            {feedback.mistakes.map((mistake, i) => (
              <li key={i} className={highlighted.has(i) ? '' : 'not-highlighted'}>
                <div>
                  <del className="correction-original">{mistake.original}</del>
                  <span className="correction-arrow">&rarr;</span>
                  <strong className="correction-fixed">{mistake.correction}</strong>
                </div>
                <p className="correction-explanation">{mistake.explanation}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="essay-card">
        <h3>Bài viết đề xuất (giữ ý của bạn)</h3>
        <p className="essay-text">{feedback.recommended}</p>
        <p className="recommended-count">{countWords(feedback.recommended || '')} từ</p>
      </div>
    </section>
  );
}
