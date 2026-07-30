import json
import logging
import asyncio
from typing import AsyncGenerator
from backend.app.core.router import MultiModelRouter

logger = logging.getLogger("kairos.agents")
router = MultiModelRouter()

class CoachAgent:
    @staticmethod
    async def generate_roadmap(
        hackathon_name: str,
        problem_statement: str,
        user_idea: str,
        team_profile_json: dict,
        model_preference: str = "claude"
    ) -> AsyncGenerator[str, None]:
        """
        Runs a multi-stage Agent Loop (Draft -> Self-Reflection -> Refine) to build the roadmap.
        Streams the critique directly, then performs background reflection and outputs the final JSON.
        """
        # Step 1: Stream Critique (Route to Groq -> Fallback to HF)
        critique_system_prompt = (
            "You are KAIROS, a pragmatic, experienced hackathon coach and co-founder.\n"
            "Analyze the user's hackathon project idea, highlighting scope risks, technical gaps, and feature cuts.\n"
            "Output your critique as clean, bulleted markdown. Keep it extremely brief and direct (max 5 bullet points).\n"
            "Do NOT write any introductory or concluding filler text."
        )
        critique_prompt = (
            f"Hackathon Name: {hackathon_name}\n"
            f"Problem Statement: {problem_statement}\n"
            f"User Idea: {user_idea}\n"
            f"Team Profile: {json.dumps(team_profile_json)}"
        )

        yield f"data: {json.dumps({'type': 'system_info', 'content': '💡 Analyzing project scope and drafting MVP critique...'})}\n\n"
        
        async for chunk in router.stream_complete(critique_system_prompt, critique_prompt, "critique"):
            yield chunk

        # Add spacing in the stream
        sep_data = json.dumps({'type': 'text_delta', 'content': '\n\n---\n\n'})
        yield f"data: {sep_data}\n\n"

        # Step 2: Generate Draft Milestones (Background) (Route to Groq -> Fallback to HF)
        yield f"data: {json.dumps({'type': 'system_info', 'content': '🔍 Creating initial roadmap milestones draft...'})}\n\n"
        
        draft_system_prompt = (
            "You are KAIROS, a pragmatic hackathon coach.\n"
            "Generate a raw JSON array of milestones for the hackathon project.\n"
            "Keep the milestones compact (maximum 4 phases) to fit a tight hackathon timeline.\n"
            "Do NOT wrap it in code blocks or headers. Output ONLY a valid JSON array matching this schema:\n"
            "[\n"
            "  {\n"
            "    \"phase\": \"Phase 1: MVP Core\",\n"
            "    \"title\": \"Title of Phase\",\n"
            "    \"deliverable\": \"Primary concrete deliverable\",\n"
            "    \"duration_estimate\": \"e.g., 6 hours\",\n"
            "    \"dependencies\": [],\n"
            "    \"risk_level\": \"low|medium|high\"\n"
            "  }\n"
            "]"
        )
        
        draft_json = ""
        async for chunk in router.stream_complete(draft_system_prompt, critique_prompt, "roadmap"):
            if chunk.startswith("data:"):
                try:
                    payload = json.loads(chunk[5:].strip())
                    if payload.get("type") == "text_delta":
                        draft_json += payload.get("content", "")
                except:
                    pass

        # Step 3: Run Self-Reflection/Critique (Background) (Route to Groq -> Fallback to HF)
        yield f"data: {json.dumps({'type': 'system_info', 'content': '🔍 KAIROS Coach is reviewing milestones for time feasibility & team capabilities...'})}\n\n"
        
        reflection_system_prompt = (
            "You are KAIROS, a pragmatic hackathon manager.\n"
            "Critique the drafted milestones against the team profile and the typical 24-48 hour hackathon timeline.\n"
            "Is the workload distributed fairly? Are the time estimates realistic? Are the deliverables too complex for a hackathon MVP?\n"
            "Output your constructive feedback as a few concise bullet points (max 3)."
        )
        reflection_prompt = (
            f"Drafted Milestones:\n{draft_json}\n\n"
            f"Team Profile: {json.dumps(team_profile_json)}\n"
            f"Hackathon Name: {hackathon_name}"
        )
        
        reflection_feedback = ""
        async for chunk in router.stream_complete(reflection_system_prompt, reflection_prompt, "reflection"):
            if chunk.startswith("data:"):
                try:
                    payload = json.loads(chunk[5:].strip())
                    if payload.get("type") == "text_delta":
                        reflection_feedback += payload.get("content", "")
                except:
                    pass

        # Step 4: Refined Finalization (Streaming output to user) (Route to Groq -> Fallback to HF)
        yield f"data: {json.dumps({'type': 'system_info', 'content': '✍️ KAIROS Coach is optimizing and generating the final roadmap...'})}\n\n"
        
        refinement_system_prompt = (
            "You are KAIROS, the master hackathon coach.\n"
            "Using the original roadmap draft and the reflection feedback, produce the final optimized roadmap JSON.\n"
            "Make sure the workload is realistic, balanced, and fits the hackathon timeframe (max 4 milestones total).\n"
            "Output exactly the marker '[ROADMAP_JSON_START]' on a new line, followed by the JSON array of milestones, and end with the marker '[ROADMAP_JSON_END]' on a new line."
        )
        refinement_prompt = (
            f"Original Draft:\n{draft_json}\n\n"
            f"Reflection Feedback:\n{reflection_feedback}\n\n"
            "Please output the optimized milestones array wrapped inside [ROADMAP_JSON_START] and [ROADMAP_JSON_END]."
        )

        async for chunk in router.stream_complete(refinement_system_prompt, refinement_prompt, "refinement"):
            yield chunk

    @staticmethod
    async def generate_pitch(
        project_name: str,
        problem_statement: str,
        user_idea: str,
        milestones: list,
        tasks: list,
        blockers: list,
        team_profile_json: dict,
        model_preference: str = "claude"
    ) -> AsyncGenerator[str, None]:
        """
        Runs the Pitch Architect agent to generate Demo Flow, Pitch Outline, and Showcase Slides.
        Routes to Nvidia NIM first -> Fallback to HF.
        """
        system_prompt = (
            "You are KAIROS, a master pitch coach for hackathons.\n"
            "Your job is to draft a high-impact presentation structure for judges based on the actual roadmap, team progress, and technical challenges faced.\n"
            "Keep the output extremely structured, concise, and direct (max 1500 tokens total). Avoid verbose narratives.\n\n"
            "Your output must contain exactly three parts:\n"
            "1. DEMO FLOW: A clear, step-by-step user journey mapping exactly what the end-user will follow when interacting with the project (e.g., 'Step 1: User logs in -> Step 2: Uploads data -> Step 3: System processes and displays results').\n"
            "2. PITCH OUTLINE: A highly detailed slide-by-slide structure (Slide 1: Problem, Slide 2: Solution, Slide 3: Architecture, etc.). Provide deep, rich content and specific bullet points for each slide so it can be directly used as robust presentation content.\n"
            "3. FINAL PITCH SHOWCASE: A high-energy, continuous VERBAL SPEECH (script) meant to be spoken aloud by the presenter on stage. Do NOT just list slide bullets again. Write it like an engaging story with a strong hook, smooth transitions from the problem to the solution/demo, mentioning how challenges were overcome, and ending with a powerful closing statement.\n\n"
            "Stream your response clearly with markdown headers (## Demo Flow, ## Pitch Outline, ## Final Pitch Showcase)."
        )
        
        prompt = (
            f"Project Name: {project_name}\n"
            f"Problem Statement: {problem_statement}\n"
            f"Project Idea: {user_idea}\n"
            f"Roadmap Milestones: {json.dumps(milestones, indent=2)}\n"
            f"Tasks & Completion Progress: {json.dumps(tasks, indent=2)}\n"
            f"Blockers & Roadblocks Encountered: {json.dumps(blockers, indent=2)}\n"
            f"Team Strengths & Roles: {json.dumps(team_profile_json, indent=2)}\n"
        )
        
        async for chunk in router.stream_complete(system_prompt, prompt, "pitch"):
            yield chunk

    @staticmethod
    async def chat_coach(
        history: list,
        new_message: str,
        project_context: dict,
        model_preference: str = "claude"
    ) -> AsyncGenerator[str, None]:
        """
        Standard Q&A coach chat.
        Routes to local Ollama first -> Fallback to Groq.
        """
        system_prompt = (
            "You are KAIROS, the team's AI Hackathon Coach.\n"
            "Your goal is to guide the developers through coding challenges, API configurations, and deployment strategies.\n"
            "Keep your answers short, direct, and pragmatic (max 3 sentences). Avoid long coding templates unless explicitly asked.\n"
            "LATENCY INSTRUCTION:\n"
            "If you are a reasoning model (like DeepSeek R1), keep your internal thinking process (<think> tags) extremely short, concise, and under 2-3 sentences. Do not write long chains of thought.\n\n"
            f"Project context:\n{json.dumps(project_context, indent=2)}"
        )
        
        # Format history for LLM
        prompt = ""
        for msg in history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            prompt += f"{role}: {msg.get('content')}\n"
        prompt += f"User: {new_message}\nAssistant:"
        
        async for chunk in router.stream_complete(system_prompt, prompt, "chat"):
            yield chunk

    @staticmethod
    async def analyze_concept_gaps(
        hackathon_name: str,
        problem_statement: str,
        user_idea: str,
        team_profile_json: dict,
        model_preference: str = "claude"
    ) -> AsyncGenerator[str, None]:
        """
        Reviews a project concept/idea and identifies missing architectural/design/feature pieces.
        """
        system_prompt = (
            "You are KAIROS, a senior technical co-founder and hackathon strategist.\n"
            "Review the user's project concept, idea, and problem statement to identify missing pieces.\n"
            "Specifically call out: \n"
            "1. Architectural/infrastructure missing elements (e.g. databases, auth, hosting, external APIs).\n"
            "2. Critical user flows or features omitted in the current idea.\n"
            "3. Integration risks.\n"
            "Output your analysis in structured, clean markdown. Keep it action-oriented and concise (max 300 words)."
        )
        prompt = (
            f"Hackathon Name: {hackathon_name}\n"
            f"Problem Statement: {problem_statement}\n"
            f"Project Idea: {user_idea}\n"
            f"Team Profile: {json.dumps(team_profile_json)}"
        )
        async for chunk in router.stream_complete(system_prompt, prompt, "critique"):
            yield chunk

    @staticmethod
    async def recalibrate_roadmap(
        hackathon_name: str,
        problem_statement: str,
        user_idea: str,
        current_milestones: list,
        active_tasks: list,
        open_blockers: list,
        slipping_tasks: list,
        team_profile_json: dict,
        model_preference: str = "claude"
    ) -> AsyncGenerator[str, None]:
        """
        Recalibrates the milestones array based on progress (slipping tasks, active blockers, completed tasks).
        Outputs the updated JSON array wrapped in [ROADMAP_JSON_START] and [ROADMAP_JSON_END].
        """
        system_prompt = (
            "You are KAIROS, the master hackathon planner.\n"
            "Given the original roadmap milestones, tasks, open blockers, slipping tasks, and team skills, recalibrate the remaining milestones.\n"
            "Ensure the plan adjusts for delays (slipping tasks/blockers) by descoping features or re-scheduling tasks to fit the remaining time.\n"
            "Output exactly the marker '[ROADMAP_JSON_START]' on a new line, followed by the updated JSON array of milestones, and end with the marker '[ROADMAP_JSON_END]' on a new line.\n"
            "The JSON array schema must match:\n"
            "[\n"
            "  {\n"
            "    \"phase\": \"Phase name\",\n"
            "    \"title\": \"Title of Phase\",\n"
            "    \"deliverable\": \"Primary concrete deliverable\",\n"
            "    \"duration_estimate\": \"e.g., 6 hours\",\n"
            "    \"dependencies\": [],\n"
            "    \"risk_level\": \"low|medium|high\"\n"
            "  }\n"
            "]"
        )
        prompt = (
            f"Hackathon: {hackathon_name}\n"
            f"Problem Statement: {problem_statement}\n"
            f"User Idea: {user_idea}\n"
            f"Current Milestones: {json.dumps(current_milestones, indent=2)}\n"
            f"Active Tasks: {json.dumps(active_tasks, indent=2)}\n"
            f"Open Blockers: {json.dumps(open_blockers, indent=2)}\n"
            f"Slipping Tasks: {json.dumps(slipping_tasks, indent=2)}\n"
            f"Team Profile: {json.dumps(team_profile_json, indent=2)}"
        )
        async for chunk in router.stream_complete(system_prompt, prompt, "refinement"):
            yield chunk
