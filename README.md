# PDF Professor - Document Translation & Analysis Platform

PDF Professor is an AI-powered document translation and analysis platform that converts PDF documents from any language to English and extracts key information. The application features user authentication, document upload, AI translation using Google Gemini, data extraction, and semantic search capabilities.

## Features

- User authentication (Sign up/Sign in)
- PDF document upload
- AI-powered translation using Google Gemini API
- Key data extraction from translated documents
- Semantic search and Q&A with documents
- Responsive web interface

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [Supabase](https://supabase.com/) account
- A [Google AI](https://ai.google.dev/) account for Gemini API access

## Project Structure

```
project/
├── server/          # Backend Node.js server
├── src/             # Frontend React application
│   ├── components/  # React components
│   ├── contexts/    # React context providers
│   ├── lib/         # Library files (Supabase client)
│   └── ...
├── package.json     # Frontend dependencies
└── ...
```

## Setup Instructions

### 1. Supabase Configuration

1. Create a new project in [Supabase](https://supabase.com/)
2. Get your project's URL and API keys:
   - Project URL
   - Anonymous key (for frontend)
   - Service role key (for backend)

### 2. Environment Variables

#### Frontend Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Configuration
PORT=3001
NODE_ENV=development

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Optional: OpenAI API for embeddings
OPENAI_API_KEY=your_openai_api_key
```

### 3. Install Dependencies

Install frontend dependencies:
```bash
npm install
```

Install backend dependencies:
```bash
cd server
npm install
```

### 4. Database Setup

In your Supabase SQL editor, run the following queries to set up the required tables:

```sql
-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_text TEXT,
  translated_text TEXT,
  detected_language TEXT,
  processing_status TEXT DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parsed_fields table
CREATE TABLE parsed_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  translated_value TEXT,
  confidence_score REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_embeddings table
CREATE TABLE document_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) NOT NULL,
  content TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for documents
CREATE POLICY "Users can only access their own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for parsed_fields
CREATE POLICY "Users can only access fields from their own documents" ON parsed_fields
  FOR ALL USING (EXISTS (SELECT 1 FROM documents WHERE id = document_id AND user_id = auth.uid()));

-- Create RLS policies for document_embeddings
CREATE POLICY "Users can only access embeddings from their own documents" ON document_embeddings
  FOR ALL USING (EXISTS (SELECT 1 FROM documents WHERE id = document_id AND user_id = auth.uid()));

-- Create RLS policies for storage
CREATE POLICY "Users can only access their own PDFs" ON storage.objects
  FOR ALL USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 5. Authentication Setup

In your Supabase dashboard:
1. Go to Authentication > Settings
2. Enable Email authentication provider
3. Optionally configure other authentication providers

## Running the Application

### Start the Backend Server

From the `server/` directory:
```bash
npm run server
```

The server will start on port 3001 (or your configured PORT).

### Start the Frontend Development Server

From the project root:
```bash
npm run dev
```

The frontend will start on port 5173 by default. Visit `http://localhost:5173` in your browser.

## Usage

1. Sign up for a new account or sign in with existing credentials
2. Upload a PDF document (limited to 2 pages)
3. Wait for the document to be processed (translation and data extraction)
4. View your documents and interact with them:
   - See extracted data
   - Ask questions about the document content
   - Search through your documents

## API Endpoints

The backend server provides the following endpoints:

- `POST /api/process-document` - Process uploaded PDF documents
- `POST /api/document-qna` - Ask questions about processed documents
- `GET /api/health` - Health check endpoint

## Troubleshooting

### Common Issues

1. **"Invalid API key" errors**: Ensure your Supabase service role key is correctly set in the backend `.env` file and that the `dotenv` package is installed.

2. **PDF processing fails**: Check that the PDF has 2 or fewer pages as the system has a page limit restriction.

3. **Translation not working**: Verify your Google Gemini API key is correctly configured.

4. **Database connection issues**: Double-check your Supabase URL and keys in both frontend and backend `.env` files.

### Need Help?

If you encounter any issues:
1. Check the browser console for frontend errors
2. Check the terminal where the backend server is running for error messages
3. Verify all environment variables are correctly set
4. Ensure all required dependencies are installed

## Technologies Used

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **AI Services**: Google Gemini API
- **PDF Processing**: pdf-parse
- **State Management**: React Query

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.