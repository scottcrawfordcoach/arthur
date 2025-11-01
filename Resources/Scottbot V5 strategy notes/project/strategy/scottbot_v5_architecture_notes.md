# ScottBot V5 – Multi-Agent Architecture Notes

## Core Architecture
- **Master Agent** acts as orchestrator:
  - Routes user input to sub-agents based on tags.
  - Applies hard rules (ICF tone, no projection, structure).
  - Tracks and applies user preferences (reflective, data-driven, light-touch).
  - Normalizes final output: ack → content → reflection prompt.

- **Sub-agents** are policy-guided LLM calls with their own behavior.json files.
  - Each returns structured output using a universal schema.
  - Sub-agents can run on lightweight models (e.g., GPT-4.1-mini) to reduce cost.
  - Master ensures all outputs are polished and consistent.

- **Data Handling Agent**:
  - Executes all DB read/write safely.
  - Handles onboarding and user preference persistence.
  - Normalizes log inputs.
  - Acts as interoperability layer (Garmin, Apple Health, etc.).

## Tagging Schema
- Tags classify input into categories (nutrition, mood, recovery, etc.).
- Cross-cutting tags: goal_progress, goal_achievement, prefs_update, insight_trigger.
- Data Handler assigns tags, Master routes agents accordingly.

## Routing Matrix
- Tags map directly to relevant agents.
- Example: `nutrition:skipped_meal` → Nutrition Agent; `goal_progress` → Goal Agent.
- Multi-category entries trigger multiple agents.

## Merging Algorithm (Master)
1. Gather all agent outputs.
2. Extract DB actions → forward to Data Handling Agent.
3. Merge acknowledgements into single statement.
4. Merge analysis summaries into narrative (deduplicate where possible).
5. Select/merge reflection prompts (prioritize Goal Agent prompts if present).
6. Apply user preference mode (reflective / data-driven / light-touch).
7. Output polished response in standardized structure.

## Universal Schema (sub-agent outputs)
- ack: string
- analysis: summary, details, goal_match, new_goal_suggestion
- reflection_prompt: string
- db_action: structured object
- insights: optional structured trends
- raw_response: boilerplate full text

## Benefits of Modular Design
- Sub-agents stay simple, Master handles integration.
- Behavior.json modularity: adding new agent = add new policy + update routing config.
- Cost control: sub-agents use smaller models, Master uses GPT-5 only for polish.
- User customization: Master toggles output blocks on/off per mode.

## Future Extensibility
- New agents can be added easily (creativity, spirituality, etc.).
- Shared context layer could allow interplay between agents.
- Coaching Agent adds internal audit for ICF compliance.
- Review and Insights Agents optional for long-term progress tracking.
