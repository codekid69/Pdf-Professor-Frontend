import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  FileText, 
  Search, 
  Filter, 
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
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilters, setSearchFilters] = useState({
    buyer: '',
    seller: '',
    houseNumber: '',
    surveyNumber: '',
    documentNumber: ''
  });
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Use the search API endpoint for more advanced searching
      const response = await fetch(
        `/api/search-documents?userId=${user.id}&query=${encodeURIComponent(searchQuery)}&buyer=${encodeURIComponent(searchFilters.buyer)}&seller=${encodeURIComponent(searchFilters.seller)}&houseNumber=${encodeURIComponent(searchFilters.houseNumber)}&surveyNumber=${encodeURIComponent(searchFilters.surveyNumber)}&documentNumber=${encodeURIComponent(searchFilters.documentNumber)}`
      );
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setDocuments(data);
        } else {
          // If not JSON, fall back to original method
          throw new Error('Response is not JSON');
        }
      } else {
        // If response not OK, fall back to original method
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Search API not available, falling back to original method:', error);
      // Fallback to original method if API fails
      try {
        const { data, error: supabaseError } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (supabaseError) throw supabaseError;
        setDocuments(data || []);
      } catch (supabaseError) {
        console.error('Error fetching documents:', supabaseError);
      }
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, searchFilters]);

  // Apply client-side filtering for immediate feedback
  useEffect(() => {
    let result = documents.filter(doc => {
      const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.translated_text.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || doc.processing_status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
    
    setFilteredDocuments(result);
  }, [documents, searchQuery, statusFilter]);

  // Fetch documents on mount and when refreshTrigger changes
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  // Poll for document status updates if there are processing documents
  useEffect(() => {
    const processingDocs = documents.filter(doc => doc.processing_status === 'processing');
    if (processingDocs.length === 0) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

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
      const a = window.document.createElement('a'); // Explicitly use window.document
      a.href = url;
      a.download = document.filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      // Show user-friendly error message
      alert(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleSearch = () => {
    fetchDocuments();
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
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Your Documents</span>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Badge variant="secondary">{documents.length} total</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and basic filters */}
            <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Advanced filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buyer</label>
                <Input
                  placeholder="Buyer name"
                  value={searchFilters.buyer}
                  onChange={(e) => handleFilterChange('buyer', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seller</label>
                <Input
                  placeholder="Seller name"
                  value={searchFilters.seller}
                  onChange={(e) => handleFilterChange('seller', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">House No</label>
                <Input
                  placeholder="House number"
                  value={searchFilters.houseNumber}
                  onChange={(e) => handleFilterChange('houseNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Survey No</label>
                <Input
                  placeholder="Survey number"
                  value={searchFilters.surveyNumber}
                  onChange={(e) => handleFilterChange('surveyNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document No</label>
                <Input
                  placeholder="Document number"
                  value={searchFilters.documentNumber}
                  onChange={(e) => handleFilterChange('documentNumber', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">No documents found</p>
                <p className="text-sm text-gray-600">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Upload your first Tamil PDF to get started'
                  }
                </p>
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {doc.filename}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1">
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
                        {doc.processing_status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDocumentSelect(doc)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
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