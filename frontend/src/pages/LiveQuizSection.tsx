import React, { useState } from 'react';
import { Zap, Loader2, CheckCircle, AlertCircle, RefreshCcw } from 'lucide-react';

interface QuestionType {
  name: string;
  description: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

interface QuizFeedback {
  summary: string;
  score_percent: number;
  correct_count: number;
  total_questions: number;
  strengths: string[];
  gaps: string[];
  resources: string[];
  next_steps: string;
}

interface LiveQuizSectionProps {
  API_BASE_URL: string;
  examName?: string;
  questionTypes: QuestionType[];
  questionPlan: Record<string, number>;
  onQuestionCountChange: (questionType: string, count: string) => void;
}

const parseTopics = (text: string): string[] => {
  return text
    .split(/[\n,;]+/)
    .map(topic => topic.trim())
    .filter(Boolean);
};

const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

const LiveQuizSection: React.FC<LiveQuizSectionProps> = ({ API_BASE_URL, examName, questionTypes, questionPlan, onQuestionCountChange }) => {
  const [topicsText, setTopicsText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetQuiz = () => {
    setQuizQuestions([]);
    setSelectedAnswers({});
    setFeedback(null);
    setError(null);
  };

  const generateQuiz = async () => {
    setError(null);
    setFeedback(null);
    setSelectedAnswers({});

    const topics = parseTopics(topicsText);
    if (topics.length === 0) {
      setError('Enter at least one topic for the live quiz. Use commas or new lines to separate topics.');
      return;
    }

    const totalQuestions = Object.values(questionPlan).reduce((sum, count) => sum + count, 0);
    if (totalQuestions < 1) {
      setError('Select at least one question count to generate the quiz.');
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/generate-live-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topics,
          exam_name: examName || 'Practice Quiz',
          question_count: totalQuestions,
          testing_mode: false,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.detail || result.message || 'Failed to generate live quiz.');
        return;
      }

      if (!result.success || !Array.isArray(result.quiz)) {
        setError(result.message || 'Unexpected response from live quiz generation.');
        return;
      }

      setQuizQuestions(result.quiz);
      setSelectedAnswers({});
      setFeedback(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while generating quiz.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const submitQuiz = async () => {
    if (quizQuestions.length === 0) {
      setError('Generate a quiz before submitting answers.');
      return;
    }

    setError(null);
    setIsGrading(true);
    try {
      const token = localStorage.getItem('access_token');
      const answers = quizQuestions.reduce<Record<string, string>>((acc, question) => {
        acc[question.id] = selectedAnswers[question.id] || '';
        return acc;
      }, {});

      const response = await fetch(`${API_BASE_URL}/api/grade-live-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quiz: quizQuestions,
          answers,
          exam_name: examName || 'Practice Quiz',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.detail || result.message || 'Failed to grade the quiz.');
        return;
      }

      if (!result.success || typeof result.feedback !== 'object') {
        setError(result.message || 'Unexpected response from grading endpoint.');
        return;
      }

      setFeedback(result.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while grading quiz.');
    } finally {
      setIsGrading(false);
    }
  };

  const renderOption = (question: QuizQuestion, option: string, idx: number) => {
    const letter = getOptionLabel(idx);
    const isSelected = selectedAnswers[question.id] === letter;
    const optionText = option.length > 1 ? option : `Option ${letter}`;
    return (
      <label key={letter} className={`block border rounded-xl px-4 py-3 cursor-pointer transition ${isSelected ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50'}`}>
        <input
          type="radio"
          name={question.id}
          value={letter}
          checked={isSelected}
          onChange={() => handleAnswerChange(question.id, letter)}
          className="mr-3 accent-cyan-600"
        />
        <span className="font-semibold text-gray-800">{letter}.</span>
        <span className="ml-2 text-gray-700">{optionText}</span>
      </label>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center gap-4 mb-6">
        <Zap className="w-8 h-8 text-amber-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Live Quiz Generator</h2>
          <p className="text-gray-600">Create a quick practice quiz on any topic and get instant feedback.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Topics</span>
            <textarea
              value={topicsText}
              onChange={e => setTopicsText(e.target.value)}
              rows={5}
              placeholder="Enter topics separated by commas or new lines, e.g. Graph Theory, Database Normalization"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 focus:border-cyan-500 focus:ring-cyan-100 focus:outline-none"
            />
          </label>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">3. Select Question Counts</label>
            <div className="space-y-3">
              {questionTypes.length > 0 ? questionTypes.map((qtype) => (
                <div key={qtype.name} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
                  <div>
                    <p className="font-semibold text-gray-900">{qtype.name}</p>
                    <p className="text-sm text-gray-600">{qtype.description}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={questionPlan[qtype.name] ?? 0}
                    onChange={(e) => onQuestionCountChange(qtype.name, e.target.value)}
                    className="w-24 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 focus:border-cyan-500 focus:ring-cyan-100 focus:outline-none"
                  />
                </div>
              )) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">Loading question types...</div>
              )}
            </div>
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Total questions: {Object.values(questionPlan).reduce((sum, count) => sum + count, 0)}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5" />
            <div>{error}</div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={generateQuiz}
            disabled={isGenerating}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-200/40 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Generate Quiz
          </button>
          <p className="text-sm text-gray-500">Use 1+ topics to create a focused quiz.</p>
        </div>
      </div>

      {quizQuestions.length > 0 && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Your Quiz</h3>
              <p className="text-sm text-gray-600">Answer the questions below and submit to receive feedback.</p>
            </div>
            <button
              type="button"
              onClick={resetQuiz}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCcw className="w-4 h-4" /> Generate Again
            </button>
          </div>

          <div className="space-y-6">
            {quizQuestions.map((question, index) => (
              <div key={question.id} className="rounded-3xl border border-gray-200 p-6 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">Question {index + 1}</h4>
                    <p className="mt-2 text-gray-700 whitespace-pre-line">{question.question}</p>
                  </div>
                  <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">{question.id}</div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => renderOption(question, option, optionIndex))}
                </div>

                {feedback && (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">Explanation</p>
                    <p className="mt-2 whitespace-pre-line">{question.explanation || 'No explanation available.'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">Once you've answered all questions, submit to see your score and learning gaps.</div>
            <button
              type="button"
              onClick={submitQuiz}
              disabled={isGrading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-200/30 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Submit Answers
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="mt-8 rounded-3xl border border-cyan-100 bg-cyan-50 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-2xl bg-cyan-500 p-3 text-white"><CheckCircle className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Quiz Feedback</h3>
              <p className="text-sm text-gray-700">{feedback.summary}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 border border-cyan-100">
              <p className="text-sm text-gray-600">Score</p>
              <p className="mt-2 text-3xl font-bold text-cyan-700">{feedback.score_percent}%</p>
              <p className="text-sm text-gray-500">{feedback.correct_count}/{feedback.total_questions} correct</p>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-cyan-100">
              <p className="text-sm text-gray-600">Next Steps</p>
              <p className="mt-2 text-gray-700 text-sm">{feedback.next_steps}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 border border-cyan-100">
              <p className="text-sm font-semibold text-gray-800">Strengths</p>
              <ul className="mt-3 list-disc list-inside text-sm text-gray-700 space-y-2">
                {feedback.strengths.map((item, index) => (
                  <li key={`strength-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-4 border border-cyan-100">
              <p className="text-sm font-semibold text-gray-800">Gaps</p>
              <ul className="mt-3 list-disc list-inside text-sm text-gray-700 space-y-2">
                {feedback.gaps.map((item, index) => (
                  <li key={`gap-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-white p-4 border border-cyan-100">
            <p className="text-sm font-semibold text-gray-800">Suggested Resources</p>
            <ul className="mt-3 list-disc list-inside text-sm text-gray-700 space-y-2">
              {feedback.resources.map((resource, index) => (
                <li key={`resource-${index}`}>{resource}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveQuizSection;
