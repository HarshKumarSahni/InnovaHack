import React from 'react';
import { FileText, Plus, Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface Syllabus {
  id: number;
  name: string;
  topic_count: number;
}

interface QuestionType {
  name: string;
  description: string;
}

interface GenerationResult {
  success: boolean;
  message: string;
  files?: { [key: string]: string };
}

interface MockTestSectionProps {
  questionTypes: QuestionType[];
  questionPlan: { [key: string]: number };
  onQuestionCountChange: (questionType: string, count: string) => void;
  testingMode: boolean;
  setTestingMode: (value: boolean) => void;
  outputFormat: 'pdf' | 'docx';
  setOutputFormat: (value: 'pdf' | 'docx') => void;
  syllabuses: Syllabus[];
  selectedSyllabusId: number | null;
  setSelectedSyllabusId: (value: number | null) => void;
  isSyllabusLoading: boolean;
  generateQuestions: () => void;
  generationResult: GenerationResult | null;
  isGenerating: boolean;
  onOpenSyllabusSettings: () => void;
}

const formatFilenameForDisplay = (filename: string) => {
  if (filename.toLowerCase().includes('questions')) return 'Questions';
  if (filename.toLowerCase().includes('verifications')) return 'Verifications';
  if (filename.toLowerCase().includes('skipped')) return 'Skipped';
  return 'Download File';
};

const MockTestSection: React.FC<MockTestSectionProps> = ({
  questionTypes,
  questionPlan,
  onQuestionCountChange,
  testingMode,
  setTestingMode,
  outputFormat,
  setOutputFormat,
  syllabuses,
  selectedSyllabusId,
  setSelectedSyllabusId,
  isSyllabusLoading,
  generateQuestions,
  generationResult,
  isGenerating,
  onOpenSyllabusSettings,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center gap-4 mb-4">
        <FileText className="w-8 h-8 text-cyan-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Create a New Mock Test</h2>
          <p className="text-gray-600">Generate a personalized test based on your syllabus.</p>
        </div>
      </div>

      <div className="my-6">
        <label htmlFor="syllabus-select" className="block text-sm font-medium text-gray-700 mb-1">
          1. Select Syllabus
        </label>
        {isSyllabusLoading ? (
          <div className="w-full p-3 bg-gray-100 rounded-lg animate-pulse">Loading syllabuses...</div>
        ) : syllabuses.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            <p className="font-medium">No syllabus found.</p>
            <p className="text-sm">
              Please go to <button onClick={onOpenSyllabusSettings} className="font-bold underline">Syllabus Settings</button> to upload one first.
            </p>
          </div>
        ) : (
          <select
            id="syllabus-select"
            value={selectedSyllabusId || ''}
            onChange={e => setSelectedSyllabusId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="" disabled>-- Select a syllabus --</option>
            {syllabuses.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.topic_count} topics)
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="my-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">2. Other Options</label>
        <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-cyan-400 transition-colors cursor-pointer">
          <input type="checkbox" checked={testingMode} onChange={e => setTestingMode(e.target.checked)} className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" />
          <div>
            <h4 className="font-medium text-gray-800">Testing Mode</h4>
            <p className="text-sm text-gray-600">Generate sample questions for testing (faster, uses mock data).</p>
          </div>
        </label>
        <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Output Format</h4>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="outputFormat" value="pdf" checked={outputFormat === 'pdf'} onChange={() => setOutputFormat('pdf')} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">PDF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="outputFormat" value="docx" checked={outputFormat === 'docx'} onChange={() => setOutputFormat('docx')} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500" />
              <span className="text-sm text-gray-700">DOCX</span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">3. Select Question Counts</label>
        {questionTypes.length > 0 ? questionTypes.map(qtype => (
          <div key={qtype.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-800">{qtype.name}</h4>
              <p className="text-sm text-gray-600">{qtype.description}</p>
            </div>
            <input type="number" min="0" step="5" placeholder="0" value={questionPlan[qtype.name] || ''} onChange={e => onQuestionCountChange(qtype.name, e.target.value)} className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center" />
          </div>
        )) : (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" /><p className="mt-2 text-gray-500">Loading...</p></div>
        )}
      </div>

      <div className="mt-6 border-t pt-6 space-y-4">
        {generationResult && (
          <div className={`p-4 rounded-lg border ${generationResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              {generationResult.success ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
              <div>
                <span className={`font-semibold ${generationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {generationResult.success ? 'Generation Complete!' : 'Error'}
                </span>
                <p className={`text-sm ${generationResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {generationResult.message}
                </p>
                {generationResult.success && generationResult.files && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(generationResult.files).map(([key, filename]) => (
                      <button key={key} onClick={() => window.open(filename, '_blank')} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                        <Download className="w-4 h-4" /> {formatFilenameForDisplay(filename)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={generateQuestions}
          disabled={isGenerating || isSyllabusLoading || !selectedSyllabusId}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (<><Loader2 className="w-6 h-6 animate-spin" /> Generating...</>) : (<><Plus className="w-6 h-6" /> Generate Test</>)}
        </button>
      </div>
    </div>
  );
};

export default MockTestSection;
