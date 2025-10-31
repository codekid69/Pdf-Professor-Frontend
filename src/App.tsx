import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { FileUpload } from './components/Upload/FileUpload';
import { DocumentList } from './components/Documents/DocumentList';
import { DocumentViewer } from './components/Viewer/DocumentViewer';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { FileText, LogOut, Upload, List, RefreshCw, Menu, X } from 'lucide-react';

const queryClient = new QueryClient();

interface Document {
  id: string;
  filename: string;
  file_path: string;
  original_text: string;
  translated_text: string;
  detected_language: string;
  processing_status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  parsed_data?: Array<{
    buyer: string;
    seller: string;
    house_no: string | number;
    survey_no: string | number;
    document_no: string | number;
    date: string;
    value: string | number;
  }>;
}

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState<'upload' | 'documents'>('upload');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleUploadComplete = (documentId: string) => {
    setRefreshTrigger(prev => prev + 1);
    setActiveView('documents');
  };

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleBackToDocuments = () => {
    setSelectedDocument(null);
    setRefreshTrigger(prev => prev + 1);
  };

  if (selectedDocument) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <DocumentViewer 
            document={selectedDocument} 
            onBack={handleBackToDocuments} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">PDF Professor</h1>
                <p className="text-xs text-gray-600 hidden sm:block">AI-Powered Document Translation & Analysis</p>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="flex items-center space-x-2 sm:hidden">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Desktop user info */}
            <div className="hidden sm:flex items-center space-x-4">
              <span className="text-sm text-gray-700 truncate max-w-[150px]">Welcome, {user?.email}</span>
              <Button variant="outline" onClick={handleSignOut} size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
          
          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="mt-3 pt-3 border-t sm:hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700 truncate max-w-[180px]">Welcome, {user?.email}</span>
                <Button variant="outline" onClick={handleSignOut} size="sm">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Mobile navigation */}
              <div className="flex space-x-2 overflow-x-auto pb-2">
                <Button
                  variant={activeView === 'upload' ? 'default' : 'outline'}
                  onClick={() => {
                    setActiveView('upload');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-shrink-0 whitespace-nowrap"
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <Button
                  variant={activeView === 'documents' ? 'default' : 'outline'}
                  onClick={() => {
                    setActiveView('documents');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-shrink-0 whitespace-nowrap"
                  size="sm"
                >
                  <List className="h-4 w-4 mr-2" />
                  Documents
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Navigation - Desktop only */}
      <nav className="bg-white border-b hidden sm:block">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <Button
              variant={activeView === 'upload' ? 'default' : 'ghost'}
              onClick={() => setActiveView('upload')}
              className="rounded-none border-b-2 border-transparent data-[active=true]:border-blue-600 whitespace-nowrap"
            >
              <Upload className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Upload Documents</span>
            </Button>
            <Button
              variant={activeView === 'documents' ? 'default' : 'ghost'}
              onClick={() => setActiveView('documents')}
              className="rounded-none border-b-2 border-transparent data-[active=true]:border-blue-600 whitespace-nowrap"
            >
              <List className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">My Documents</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeView === 'upload' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Upload Documents for AI Translation
              </h2>
              <p className="text-gray-600">
                Convert PDFs from any language to English with AI-powered translation. 
                Extract key information and chat with your documents.
              </p>
            </div>
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {activeView === 'documents' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Your Documents
              </h2>
              <p className="text-gray-600">
                View, search, and interact with your processed documents. 
                Ask questions and get insights from AI.
              </p>
            </div>
            <DocumentList 
              onDocumentSelect={handleDocumentSelect}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}
      </main>
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="bg-blue-600 p-3 rounded-full w-16 h-16 mx-auto mb-4">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PDF Professor</h1>
            <p className="text-gray-600 mt-2">
              AI-Powered Document Translation & Analysis
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Convert any language PDF to English and chat with your documents
            </p>
          </div>
          <LoginForm 
            onToggleMode={() => setIsSignUp(!isSignUp)}
            isSignUp={isSignUp}
          />
        </div>
      </div>
    );
  }

  return <Dashboard />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;