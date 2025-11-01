# ScottBot V5 – Master Merge Examples

These examples illustrate how the **master_merge_policy.json** applies in practice to produce different final outputs based on user preference modes.

---

## Example Input
**User:** “I ran 5km in 28 minutes today. Felt really strong.”

---

## Sub-Agent Extracts (simplified)
- **Wellness Agent Ack:** “Noted your 5km run today — strong effort!”
- **Goals Agent Ack:** “This run looks connected to your 10km training goal.”
- **Mindset Agent Ack:** “I hear you felt strong during this run.”

- **Wellness Analysis:** “Logged 5km in 28 minutes, solid aerobic pace.”
- **Goals Analysis:** “Pace shows progress toward 10km sub-50min goal.”
- **Mindset Analysis:** “Positive mood, confidence high.”

- **Reflection Prompts:**
  - Wellness → “How did this run compare to your recent workouts?”
  - Goals → “What did you notice about your pacing and stamina?”
  - Mindset → “What part of this run made you feel strongest?”

---

## Mode 1: Reflective
- **Policy:** Include ack + analysis + reflection + insights.
- **Master Output:**
> “Nice work on your 5km run today — you kept a solid pace and felt strong doing it. This shows you’re moving closer to your 10km sub-50min goal, and it’s great to hear the confidence coming through. Looking ahead, what did you notice about your pacing and stamina during this run?”

---

## Mode 2: Data-Driven
- **Policy:** Include ack + analysis + insights. Omit reflection prompts.
- **Master Output:**
> “Your 5km run today was logged at 28 minutes, which is a solid pace of 5:36/km. This indicates steady aerobic improvement and progress toward your 10km sub-50min goal. Confidence and motivation appear high.”

---

## Mode 3: Light-Touch
- **Policy:** Include ack + reflection prompt. Omit detailed analysis and insights.
- **Master Output:**
> “You felt strong during your 5km run today. What part of that run made you feel strongest?”

---

## Notes
- The merge policy ensures consistency while still allowing significant flexibility in user experience.
- Sub-agents provide structured building blocks; Master Agent assembles final narrative according to preference mode.
