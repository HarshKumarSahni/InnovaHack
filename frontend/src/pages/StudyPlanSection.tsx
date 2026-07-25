import React from 'react';
import { Calendar, Flame, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

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

interface StudyTask {
  task: string;
  duration: string;
  type: string;
}

interface StudyPlanSectionProps {
  onboardingData: OnboardingData | null;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  daysUntilExam: number | null;
  renderStudyPlanCalendar: () => React.ReactNode;
  renderStreakCalendar: () => React.ReactNode;
}

const StudyPlanSection: React.FC<StudyPlanSectionProps> = ({
  onboardingData,
  currentDate,
  setCurrentDate,
  daysUntilExam,
  renderStudyPlanCalendar,
  renderStreakCalendar,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-purple-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Study Schedule</h2>
            <p className="text-gray-600">Track your prep and stay on target.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <h3 className="text-lg font-semibold text-gray-800 w-36 text-center">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-b border-gray-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-700 border-t border-r border-gray-100">{day}</div>
        ))}
        {renderStudyPlanCalendar()}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-cyan-500"></div><span className="text-sm text-gray-600">Study</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-pink-500"></div><span className="text-sm text-gray-600">Practice</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-purple-500"></div><span className="text-sm text-gray-600">Revision</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500"></div><span className="text-sm text-gray-600">Test</span></div>
      </div>
    </div>
  );
};

export default StudyPlanSection;
