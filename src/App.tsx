import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { FileUpload } from './components/Upload/FileUpload';
import { DocumentList } from './components/Documents/DocumentList';
import { DocumentViewer } from './components/Viewer/DocumentViewer';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { FileText, LogOut, Upload, List, RefreshCw } from 'lucide-react';

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
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleUploadComplete = (documentId: string) => {
    setProcessingDocumentId(documentId);
    setRefreshTrigger(prev => prev + 1);
    setActiveView('documents');
  };

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleBackToDocuments = () => {
    setSelectedDocument(null);
    // Refresh the document list when returning from document view
    setRefreshTrigger(prev => prev + 1);
  };

  // Poll for document status updates if there's a processing document
  useEffect(() => {
    if (!processingDocumentId) return;

    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 5000); // Poll every 5 seconds

    // Clean up interval after 5 minutes to prevent infinite polling
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setProcessingDocumentId(null);
    }, 300000); // 5 minutes

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [processingDocumentId]);

  if (selectedDocument) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
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
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Tamil PDF Translator</h1>
                <p className="text-sm text-gray-600">Convert Tamil PDFs to English</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user?.email}</span>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <Button
              variant={activeView === 'upload' ? 'default' : 'ghost'}
              onClick={() => setActiveView('upload')}
              className="rounded-none border-b-2 border-transparent data-[active=true]:border-blue-600"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
            <Button
              variant={activeView === 'documents' ? 'default' : 'ghost'}
              onClick={() => setActiveView('documents')}
              className="rounded-none border-b-2 border-transparent data-[active=true]:border-blue-600"
            >
              <List className="h-4 w-4 mr-2" />
              My Documents
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeView === 'upload' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Upload Tamil PDF Documents
              </h2>
              <p className="text-lg text-gray-600">
                Upload your Tamil PDF documents and get instant English translations 
                with field extraction and parsing.
              </p>
            </div>
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {activeView === 'documents' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Your Documents
              </h2>
              <p className="text-lg text-gray-600">
                View, search, and manage your processed documents.
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
          <div className="text-center mb-8">
            <div className="bg-blue-600 p-3 rounded-full w-16 h-16 mx-auto mb-4">
              <FileText className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Tamil PDF Translator</h1>
            <p className="text-gray-600 mt-2">
              Convert Tamil PDFs to English with AI-powered translation
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