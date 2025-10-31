import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  FileText, 
  Eye, 
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  RefreshCw
} from 'lucide-react';

interface DocumentRecord {
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

interface DocumentListProps {
  onDocumentSelect: (document: DocumentRecord) => void;
  refreshTrigger: number;
}

export const DocumentList: React.FC<DocumentListProps> = ({ 
  onDocumentSelect, 
  refreshTrigger 
}) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          parsed_fields(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch documents on mount and when refreshTrigger changes
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  // Set up real-time subscription for document updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to document changes
    const channel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Document updated:', payload);
          // Refresh the document list when a document is updated
          fetchDocuments();
        }
      )
      .subscribe();

    setSubscription(channel);

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, fetchDocuments]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-amber-100 text-amber-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadDocument = async (document: DocumentRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from('pdfs')
        .download(document.file_path);

      if (error) throw error;

      if (!data) {
        throw new Error('No data received from download');
      }

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDocuments();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center">
            <span>Your Documents</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">Refresh</span>
            </Button>
            <Badge variant="secondary">{documents.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">No documents found</p>
                <p className="text-sm text-gray-600">
                  Upload your first Tamil PDF to get started
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start space-x-4 flex-1">
                        <FileText className="h-8 w-8 text-blue-500 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {doc.filename}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(doc.processing_status)}
                              <Badge className={getStatusColor(doc.processing_status)}>
                                {doc.processing_status}
                              </Badge>
                            </div>
                            {doc.detected_language && (
                              <Badge variant="outline">
                                {doc.detected_language}
                              </Badge>
                            )}
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(doc.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {doc.processing_status === 'completed' && doc.translated_text && (
                            <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                              {doc.translated_text.substring(0, 150)}...
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDocumentSelect(doc)}
                          className="flex items-center"
                        >
                          <Eye className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(doc)}
                          className="flex items-center"
                        >
                          <Download className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};