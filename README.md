# KAIROS Orchestration Kernel

KAIROS is a dashboard application designed to help hackathon teams organize tasks, manage team member profiles, and coordinate project planning.

## Project Structure

The project is split into two main directories:

- **frontend**: A React application built with Vite and styled using custom CSS.
- **backend**: A FastAPI server handling profiles, teams, sessions, and task synchronization.

## Setup Instructions

### Backend Setup

1. Navigate to the root directory.
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development database migration or check config files.
4. Run the FastAPI development server:
   ```bash
   python -m uvicorn backend.main:app --reload
   ```

### Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Key Features

- **Dashboard**: High-level telemetry displaying profile status, active tasks, session progress, and team details.
- **Teams**: Create or join teams with synchronization codes to share skills master profiles.
- **Profile**: Configure user information, role, experience level, and a visual synergy stack representation.
