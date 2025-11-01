# ScottBot V5 – Architecture Refinement Notes

**Date:** 2025-10-04

## Refinement Overview
Through iteration, we’ve clarified the ScottBot V5 multi-agent system into a cleaner, more efficient structure:

- **Receptionist Agent (lightweight)**
  - Categorizes and tags user input.
  - Decides which sub-agents to call.
  - Runs on small/cheap LLM (e.g., GPT-4.1-mini).

- **Sub-Agents (specialists)**
  - Handle domain-specific tasks (Wellness, Nutrition, Goals, Mindset, etc.).
  - Produce structured JSON outputs following the universal schema.
  - Mostly run on lightweight LLMs or even SQL/API functions.

- **Coaching/Master Agent (GPT-5)**
  - The single heavy model.
  - Synthesizes sub-agent outputs + original input.
  - Applies coaching discipline (ICF alignment).
  - Produces the final user-facing response.

This replaces the earlier concept of separate “Master” and “Coaching” agents — they are now unified.

---

## Architecture Flow
1. **User input → Receptionist Agent**
   - Tags input (nutrition, mindset, goal, etc.).
   - Decides which sub-agents to call.

2. **Receptionist → Sub-Agents**
   - Nutrition, Goals, Mindset, Wellness, etc. return structured outputs.

3. **Sub-Agent outputs → Coaching/Master Agent**
   - Receives original input + receptionist tags + structured outputs.
   - Synthesizes into polished, ICF-aligned response.
   - Finalizes ack → analysis → reflection prompt.

---

## Universal Schema for Sub-Agent Outputs
```json
{
  "agent_name": "string",
  "ack": "string",
  "analysis": {
    "summary": "string",
    "details": "string",
    "goal_match": "string (optional)",
    "new_goal_suggestion": "string (optional)"
  },
  "reflection_prompt": "string",
  "db_action": {
    "action_type": "string",     
    "target_table": "string",    
    "payload": {}                
  },
  "insights": [
    { "type": "string", "description": "string" }
  ],
  "raw_response": "string"
}
```

---

## Example Run: Logging a Workout
**User Input:** “I ran 5km in 28 minutes today. Felt really strong.”

### Receptionist Output
```json
{ "tags": ["wellness", "goal", "mindset"] }
```

### Wellness Agent Output
```json
{
  "agent_name": "Wellness",
  "ack": "Noted your 5km run today — strong effort!",
  "analysis": {
    "summary": "Logged a 5km run in 28 minutes.",
    "details": "This pace (5:36/km) suggests solid aerobic fitness.",
    "goal_match": "running distance/time",
    "new_goal_suggestion": null
  },
  "reflection_prompt": "How did this run compare to your recent workouts?",
  "db_action": {
    "action_type": "write_log",
    "target_table": "exercise_logs",
    "payload": { "type": "run", "distance_km": 5, "time_minutes": 28, "feeling": "strong" }
  },
  "insights": [{ "type": "trend", "description": "Improved pace compared to last logged run." }],
  "raw_response": "Great job on your 5km run today! That’s a strong effort at a solid pace. This could connect with your running goals — we can explore how it fits in."
}
```

### Goals Agent Output
```json
{
  "agent_name": "Goals",
  "ack": "This run looks connected to your 10km training goal.",
  "analysis": {
    "summary": "Run shows progress toward endurance/time goals.",
    "details": "Pace indicates you’re building speed capacity for 10km under 50 minutes.",
    "goal_match": "10km sub-50min",
    "new_goal_suggestion": "Try extending one run each week toward 7–8km."
  },
  "reflection_prompt": "What did you notice about your pacing and stamina during this run?",
  "db_action": {
    "action_type": "update_goal",
    "target_table": "goals",
    "payload": { "goal_id": "10k_sub50", "progress_update": "5km in 28min logged", "adherence_percent": 64 }
  },
  "insights": [],
  "raw_response": "Strong step toward your 10km sub-50min goal! You’re pacing well. Consider gradually increasing distance to 7–8km as a bridge."
}
```

### Mindset Agent Output
```json
{
  "agent_name": "Mindset",
  "ack": "I hear you felt strong during this run.",
  "analysis": {
    "summary": "Positive mood and sense of strength during exercise.",
    "details": "This suggests confidence and motivation are high.",
    "goal_match": null,
    "new_goal_suggestion": null
  },
  "reflection_prompt": "What part of this run made you feel strongest?",
  "db_action": { "action_type": "write_log", "target_table": "mood_logs", "payload": { "mood": "strong", "context": "post-run" } },
  "insights": [],
  "raw_response": "It’s powerful that you felt strong during your workout. That confidence can carry over into other areas."
}
```

### Coaching/Master Agent Final Output
> “Nice work on your 5km run today — you kept a solid pace and felt strong doing it. That’s a clear sign you’re progressing toward your 10km goal. I hear that confidence coming through too — powerful stuff. Looking ahead, how would it feel to stretch one of your runs a bit longer, say 7–8km, as a next step?”

---

## Benefits of This Refinement
- One powerful GPT-5 agent handles synthesis + coaching.
- Receptionist + Sub-agents are cheap, efficient.
- Easier to maintain modular sub-agents (just add JSONs).
- Consistent UX since Coaching/Master curates all final outputs.
