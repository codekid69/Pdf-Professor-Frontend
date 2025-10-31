import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface FileUploadProps {
  onUploadComplete: (documentId: string) => void;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  id: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [error, setError] = useState('');
  const { user } = useAuth();



  const processFile = async (uploadFile: UploadFile) => {
    try {
      const { file, id } = uploadFile;
      
      // Ensure user is authenticated
      if (!user) {
        throw new Error('User not authenticated. Please sign in first.');
      }
      
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: uploadData.path,
          original_text: '',
          translated_text: '',
          detected_language: '',
          processing_status: 'processing',
        })
        .select()
        .single();

      if (docError) throw docError;

      updateFileStatus(id, 'completed');
      onUploadComplete(docData.id);

      // Trigger backend processing via Express server
      try {
        console.log('Sending request to backend:', {
          documentId: docData.id,
          filePath: uploadData.path,
        });
        
        const response = await fetch('http://localhost:3002/api/process-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: docData.id,
            filePath: uploadData.path,
          }),
        });

        console.log('Backend response:', response.status, response.statusText);
        
        if (!response.ok) {
          console.error('Backend processing failed:', response.status, response.statusText);
        } else {
          console.log('Backend processing successful');
        }
      } catch (fetchError) {
        console.error('Failed to trigger backend processing:', fetchError);
      }

    } catch (error) {
      console.error('Upload error:', error);
      updateFileStatus(uploadFile.id, 'error');
      if (error instanceof Error) {
        setError(`Failed to upload ${uploadFile.file.name}: ${error.message}`);
      } else {
        setError(`Failed to upload ${uploadFile.file.name}: Unknown error occurred`);
      }
    }
  };

  const updateFileProgress = (id: string, progress: number) => {
    setUploadFiles(prev =>
      prev.map(f => f.id === id ? { ...f, progress } : f)
    );
  };

  const updateFileStatus = (id: string, status: UploadFile['status']) => {
    setUploadFiles(prev =>
      prev.map(f => f.id === id ? { ...f, status, progress: status === 'completed' ? 100 : f.progress } : f)
    );
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  // Function to check PDF page count
  const checkPdfPageCount = async (file: File): Promise<number> => {
    try {
      // Dynamically import pdfjs-dist to avoid issues with server-side rendering
      const pdfjs = await import('pdfjs-dist');
      
      // Set the worker
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load the PDF document
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      // Return the number of pages
      return pdf.numPages;
    } catch (error) {
      console.error('Error checking PDF page count:', error);
      throw new Error('Failed to read PDF file');
    }
  };

  // Custom onDrop function to handle page count validation
  const onDropWithValidation = useCallback(async (acceptedFiles: File[]) => {
    // Process each file with page count validation
    for (const file of acceptedFiles) {
      try {
        // Check if it's a PDF file
        if (file.type === 'application/pdf') {
          // Check the page count
          const pageCount = await checkPdfPageCount(file);
          
          // If more than 2 pages, show error and skip upload
          if (pageCount > 2) {
            setError(`File "${file.name}" has ${pageCount} pages, which exceeds the 2-page limit. Please select a document with 2 pages or fewer.`);
            continue; // Skip this file and process the next one
          }
        }
        
        // If validation passes, proceed with normal upload process
        const newFile = {
          file,
          progress: 0,
          status: 'uploading' as const,
          id: Math.random().toString(36).substr(2, 9),
        };
        
        setUploadFiles(prev => [...prev, newFile]);
        setError('');
        
        // Process the file
        processFile(newFile);
      } catch (error) {
        console.error('Error processing file:', error);
        setError(`Failed to process file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropWithValidation,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className="space-y-6">
      <Card 
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <CardContent className="p-6 sm:p-8">
          <div {...getRootProps()} className="text-center">
            <input {...getInputProps()} />
            <Upload className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <p className="text-lg sm:text-xl font-medium text-gray-900">
                {isDragActive ? 'Drop your Tamil PDFs here' : 'Upload Tamil PDF documents'}
              </p>
              <p className="text-sm text-gray-600">
                Drag & drop or click to select PDF files (max 10MB each)
              </p>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              className="mt-4"
            >
              Select Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">Uploading Files</h3>
          {uploadFiles.map((uploadFile) => (
            <Card key={uploadFile.id} className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {uploadFile.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <button
                    onClick={() => removeFile(uploadFile.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {uploadFile.status === 'uploading' && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadFile.progress}% uploaded
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};