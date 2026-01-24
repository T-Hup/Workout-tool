import { useState } from 'react';
import SubsidyTool from './components/SubsidyTool';
import AdminDashboard from './components/AdminDashboard';

/**
 * Main Application Component
 * 
 * Integrates the SubsidyTool and AdminDashboard with state-based navigation.
 */
function App() {
    const [view, setView] = useState<'tool' | 'admin'>('tool');

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {view === 'tool' ? (
                <>
                    <SubsidyTool />

                    {/* Hidden Admin Trigger (Bottom Right) */}
                    <div className="fixed bottom-4 right-4 opacity-10 hover:opacity-100 transition-opacity z-50">
                        <button
                            onClick={() => setView('admin')}
                            className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs shadow-lg"
                        >
                            Admin Dashboard
                        </button>
                    </div>
                </>
            ) : (
                <AdminDashboard onNavigateBack={() => setView('tool')} />
            )}
        </div>
    );
}

export default App;
