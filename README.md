# KAIROS Orchestration Kernel

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" />
</div>

<br />

KAIROS is an AI-powered hackathon project co-founder and execution engine. It is a comprehensive dashboard application designed to help hackathon teams organize tasks, manage team member profiles, and coordinate project planning with high-level telemetry and team synchronization.

## Live Deployments

- **Frontend Application:** [https://kairos-green-phi.vercel.app](https://kairos-green-phi.vercel.app)
- **Backend API:** [https://hacktuah-parth-gupta.onrender.com](https://hacktuah-parth-gupta.onrender.com)

## Key Features

- **AI Project Co-Founder:** Generate structured task pipelines, identify blockers, and build project roadmaps automatically.
- **Automated Pitch Deck Generation:** Leverage AI to compile your project data into professional PowerPoint (.pptx) presentations automatically.
- **PDF Blueprints:** Export full project blueprints into portable PDF format for quick sharing and submission.
- **High-Level Telemetry Dashboard:** Monitor profile statuses, track active tasks, visualize session progress, and view team details in real-time.
- **Team Synchronization:** Create or join teams using unique synchronization codes to share skills, roles, and project master profiles.
- **Dynamic Synergy Profiles:** Configure user roles, experience levels, and visual tech stack representations that automatically scale and adjust.

## Tech Stack

### Frontend
- React 18
- Vite
- Axios
- Custom CSS Architecture

### Backend
- Python 3.11+
- FastAPI
- Uvicorn
- python-pptx

## Prerequisites

Before setting up the project locally, ensure you have the following installed:
- Node.js (v18 or higher)
- Python (3.11 or higher)
- Git Large File Storage (Git LFS) - Required for downloading the PPTX template files.

## Local Setup

### Automated Setup

The easiest way to run the project locally is to use the provided setup scripts in the root directory. These scripts will automatically install all dependencies and start both the frontend and backend servers concurrently.

**For Windows:**
```cmd
setup_and_run.bat
```

**For macOS and Linux:**
```bash
bash setup_and_run.sh
```

### Manual Setup

If you prefer to start the services manually, follow these steps:

#### 1. Pull Git LFS Files
Ensure you have downloaded the large presentation templates:
```bash
git lfs install
git lfs pull
```

#### 2. Backend Setup
Navigate to the root directory and install the Python dependencies:
```bash
pip install -r requirements.txt
```
Run the FastAPI development server (runs on port 8000 by default):
```bash
python -m uvicorn backend.main:app --reload
```

#### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install the Node dependencies:
```bash
cd frontend
npm install
```
Start the Vite development server (runs on port 5173 by default):
```bash
npm run dev
```

## Project Structure

- **frontend/**: Contains the React application, Vite configuration, and custom CSS styling.
- **backend/**: Contains the FastAPI application, API routing, database models, and the PPTX generation engine.
  - **backend/app/static/ppt_templates/**: Stores the master PowerPoint templates used for generation.

## Deployment Notes

When deploying the backend to platforms like Render, ensure that your build command explicitly pulls Git LFS objects before installing requirements, as the presentation templates exceed standard file limits and are tracked via LFS.

Example Render Build Command:
```bash
git lfs install && git lfs pull && pip install -r requirements.txt
```
