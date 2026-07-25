import React, { useState, useEffect } from 'react';
import { FileText, Zap, Calendar, BookMarked, Flame, Clock, Target, User } from 'lucide-react';
import SyllabusPage from './SyllabusPage';
import MockTestSection from './MockTestSection';
import StudyPlanSection from './StudyPlanSection';
import LiveQuizSection from './LiveQuizSection';

interface User {
  id: number;
  email: string;
  token?: string;
}

interface QuestionType {
  name: string;
  description: string;
}

interface Syllabus {
  id: number;
  name: string;
  created_at: string;
  topic_count: number;
}

interface HomePageProps {
  user: User;
  onLogout: () => void;
}

interface GenerationResult {
  success: boolean;
  message: string;
  files?: { [key: string]: string };
}

interface OnboardingData {
  examName?: string;
  examDate?: string;
  topicsCovered?: string[];
  studyHours?: string;
  studyDays?: string;
  currentPreparationLevel?: string;
  preferredStudyTime?: string;
  weakSubjects?: string[];
  strongSubjects?: string[];
}

const API_BASE_URL = 'https://acetrack-backend.onrender.com';
const numQuestionsChunk = 5;

const HomePage: React.FC<HomePageProps> = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState<'mockTest' | 'studyPlan' | 'syllabus' | 'liveQuiz'>('mockTest');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);
  const [questionPlan, setQuestionPlan] = useState<{ [key: string]: number }>({});
  const [testingMode, setTestingMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx'>('pdf');
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<number | null>(null);
  const [isSyllabusLoading, setIsSyllabusLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);

  useEffect(() => {
    loadQuestionTypes();
    loadOnboardingData();
    fetchSyllabuses();
  }, []);

  const loadQuestionTypes = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/question-types`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const types = await response.json();
        setQuestionTypes(types);
      } else {
        console.error('Failed to load question types');
      }
    } catch (error) {
      console.error('Error loading question types:', error);
    }
  };

  const loadOnboardingData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/onboarding`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const formattedData = {
          examName: data.exam_name,
          examDate: data.exam_date,
          topicsCovered: data.topics_covered || [],
          studyHours: data.daily_study_hours?.toString() || '',
          studyDays: data.additional_notes?.includes('Study Days per Week:')
            ? data.additional_notes.split('Study Days per Week: ')[1]
            : '',
          currentPreparationLevel: data.current_preparation_level,
          preferredStudyTime: data.preferred_study_time,
          weakSubjects: data.weak_subjects || [],
          strongSubjects: data.strong_subjects || [],
        };
        setOnboardingData(formattedData);
        localStorage.setItem('onboarding_data', JSON.stringify(formattedData));
      } else if (response.status !== 404) {
        console.error('Failed to load onboarding data:', response.status);
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
      const savedOnboardingData = localStorage.getItem('onboarding_data');
      if (savedOnboardingData) {
        try {
          setOnboardingData(JSON.parse(savedOnboardingData));
        } catch (parseError) {
          console.error('Error parsing saved onboarding data:', parseError);
        }
      }
    }
  };

  const fetchSyllabuses = async () => {
    setIsSyllabusLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/syllabus`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data: Syllabus[] = await response.json();
      setSyllabuses(data);
      if (data.length > 0) {
        setSelectedSyllabusId(data[0].id);
        if (currentView === 'syllabus') setCurrentView('mockTest');
      } else {
        setCurrentView('syllabus');
      }
    } catch (error) {
      console.error('Error fetching syllabuses:', error);
    } finally {
      setIsSyllabusLoading(false);
    }
  };

  const getDaysUntilExam = () => {
    if (!onboardingData?.examDate) return null;
    const diffTime = new Date(onboardingData.examDate).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysUntilExam = getDaysUntilExam();

  const getUserDisplayName = () => user?.email?.split('@')[0] || 'User';

  const handleQuestionCountChange = (questionType: string, count: string) => {
    const numCount = parseInt(count) || 0;
    setQuestionPlan(prev => ({ ...prev, [questionType]: numCount }));
  };

  const generateQuestions = async () => {
    if (!selectedSyllabusId) {
      setGenerationResult({ success: false, message: 'Please select a syllabus first. Go to Syllabus Settings to upload one.' });
      return;
    }

    const totalQuestions = Object.values(questionPlan).reduce((sum, count) => sum + count, 0);
    if (totalQuestions === 0) {
      setGenerationResult({ success: false, message: 'Please select at least one question type.' });
      return;
    }

    const invalidCounts = Object.entries(questionPlan).filter(([_, count]) => count > 0 && count % numQuestionsChunk !== 0);
    if (invalidCounts.length > 0) {
      setGenerationResult({ success: false, message: `All question counts must be multiples of ${numQuestionsChunk}.` });
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      const token = localStorage.getItem('access_token');
      const examName = onboardingData?.examName || 'General Exam';
      const request = {
        question_plan: Object.fromEntries(Object.entries(questionPlan).filter(([_, count]) => count > 0)),
        testing_mode: testingMode,
        exam_name: examName,
        output_format: outputFormat,
        questions_per_chunk: numQuestionsChunk,
        syllabus_id: selectedSyllabusId,
      };

      const response = await fetch(`${API_BASE_URL}/api/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
      });

      const result = await response.json();
      if (response.status === 403) {
        setGenerationResult({ success: false, message: result.detail });
        return;
      }
      if (!response.ok) {
        setGenerationResult({ success: false, message: result.detail || 'An unknown server error occurred.' });
      } else {
        setGenerationResult(result);
      }
    } catch (error) {
      setGenerationResult({ success: false, message: `An unexpected error occurred: ${error}` });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStudyPlanCalendar = () => {
    const studyTasks: Record<string, { task: string; duration: string; type: string }[]> = {
      '2025-08-22': [{ task: 'Revise Math', duration: '2h', type: 'revision' }, { task: 'Practice PYQs', duration: '1h', type: 'practice' }],
      '2025-08-23': [{ task: 'Physics Chapter 3', duration: '3h', type: 'study' }, { task: 'Mock Test', duration: '2h', type: 'test' }],
      '2025-09-02': [{ task: 'Chemistry Ch. 1', duration: '2h', type: 'study' }],
    };
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const formatDateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const getTaskTypeColor = (type: string) => {
      switch (type) {
        case 'study': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
        case 'practice': return 'bg-pink-100 text-pink-700 border-pink-200';
        case 'revision': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'test': return 'bg-amber-100 text-amber-700 border-amber-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    };

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const today = new Date();
    const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-28 border-t border-r border-gray-100"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayTasks = studyTasks[dateKey] || [];
      const isToday = isCurrentMonth && day === today.getDate();

      days.push(
        <div key={day} className={`h-28 border-t border-r border-gray-100 p-1.5 ${isToday ? 'bg-cyan-50' : 'bg-white'}`}>
          <div className={`text-sm font-medium ${isToday ? 'text-cyan-700' : 'text-gray-700'}`}>{day}</div>
          <div className="space-y-1 mt-1">
            {dayTasks.slice(0, 2).map((task, index) => (
              <div key={index} className={`text-xs px-1.5 py-0.5 rounded border ${getTaskTypeColor(task.type)} truncate`}>
                {task.task}
              </div>
            ))}
            {dayTasks.length > 2 && <div className="text-xs text-gray-500">+{dayTasks.length - 2} more</div>}
          </div>
        </div>
      );
    }

    return days;
  };

  const renderStreakCalendar = () => {
    const streakDaysData = ['2025-08-24', '2025-08-25', '2025-08-26', '2025-08-27', '2025-08-28'];
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const formatDateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`streak-empty-${i}`} className="h-8 w-8"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const hasStreak = ['2025-08-24', '2025-08-25', '2025-08-26', '2025-08-27', '2025-08-28'].includes(dateKey);
      days.push(
        <div key={day} className="h-8 w-8 flex items-center justify-center text-xs relative">
          <span className={`relative z-10 ${hasStreak ? 'text-white font-semibold' : 'text-gray-600'}`}>{day}</span>
          {hasStreak && <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-cyan-300 rounded-full"></div>}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AceTrack</h1>
                <p className="text-sm text-gray-500">Welcome back, {getUserDisplayName()}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => setCurrentView('mockTest')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium ${currentView === 'mockTest' ? 'bg-cyan-100 text-cyan-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <FileText className="w-4 h-4" /> Mock Tests
              </button>
              <button onClick={() => setCurrentView('liveQuiz')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium ${currentView === 'liveQuiz' ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Zap className="w-4 h-4" /> Live Quiz
              </button>
              <button onClick={() => setCurrentView('studyPlan')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium ${currentView === 'studyPlan' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Calendar className="w-4 h-4" /> Study Plan
              </button>
              <button onClick={() => setCurrentView('syllabus')} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium ${currentView === 'syllabus' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <BookMarked className="w-4 h-4" /> Syllabus
              </button>
            </div>

            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100">
                <User className="w-5 h-5 text-gray-600" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    <Clock className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'syllabus' ? (
          <SyllabusPage API_BASE_URL={API_BASE_URL} onBack={() => setCurrentView('mockTest')} onSyllabusUploaded={fetchSyllabuses} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {currentView === 'mockTest' ? (
                <MockTestSection
                  questionTypes={questionTypes}
                  questionPlan={questionPlan}
                  onQuestionCountChange={handleQuestionCountChange}
                  testingMode={testingMode}
                  setTestingMode={setTestingMode}
                  outputFormat={outputFormat}
                  setOutputFormat={setOutputFormat}
                  syllabuses={syllabuses}
                  selectedSyllabusId={selectedSyllabusId}
                  setSelectedSyllabusId={setSelectedSyllabusId}
                  isSyllabusLoading={isSyllabusLoading}
                  generateQuestions={generateQuestions}
                  generationResult={generationResult}
                  isGenerating={isGenerating}
                  onOpenSyllabusSettings={() => setCurrentView('syllabus')}
                />
              ) : currentView === 'liveQuiz' ? (
                <LiveQuizSection
                  API_BASE_URL={API_BASE_URL}
                  examName={onboardingData?.examName}
                  questionTypes={questionTypes}
                  questionPlan={questionPlan}
                  onQuestionCountChange={handleQuestionCountChange}
                />
              ) : (
                <StudyPlanSection
                  onboardingData={onboardingData}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  daysUntilExam={daysUntilExam}
                  renderStudyPlanCalendar={renderStudyPlanCalendar}
                  renderStreakCalendar={renderStreakCalendar}
                />
              )}

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <Flame className="w-6 h-6 text-pink-500" />
                  <h3 className="text-lg font-bold text-gray-800">Study Streak</h3>
                </div>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-300">5</div>
                  <p className="text-sm text-gray-600">days in a row</p>
                </div>
                <div className="grid grid-cols-7 gap-1 mt-4">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div key={`dow-${idx}`} className="text-center text-xs font-medium text-gray-500 mb-1">{day}</div>
                  ))}
                  {renderStreakCalendar()}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {daysUntilExam !== null && (
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-6 h-6 text-red-500" />
                    <h3 className="text-lg font-bold text-gray-800">Countdown</h3>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-300">{daysUntilExam}</div>
                    <p className="text-sm text-gray-600">days until {onboardingData?.examName || 'your exam'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
