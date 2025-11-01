# ScottBot V5 – Strategy Notes Index

This folder contains design and strategy notes for the development of ScottBot V5.

## Files

- **scottbot_v5_architecture_notes.md**  
  Initial multi-agent system design including Master Agent, sub-agents, tagging schema, routing, merging algorithm, and universal schema.

- **scottbot_v5_architecture_refinement.md**  
  Refined architecture replacing the dual Master/Coaching split with a single Coaching/Master Agent. Receptionist agent introduced for lightweight categorization and routing.

- **scottbot_v5_coaching_agent_notes.md**  
  Coaching Agent design notes, including ICF alignment, ACC/PCC/MCC flow modes, universal rules, and audit system.

- **scottbot_v5_white_label_notes.md**  
  White-label rollout strategy, including tiered models for individuals, coaches, and enterprise organizations.

- **CHANGELOG.md**  
  Chronological record of major design decisions and refinements.

## Purpose
- Provides reference documentation for V5 architecture and coaching design.
- Ensures strategy discussions are preserved in versioned, accessible form.
- Serves as design guide when scaffolding new edge functions and behavior policies.

## Next Steps
- Flesh out universal boilerplate response templates for each category.
- Define master merge policy file (`master_merge_policy.json`).
- Begin scaffolding stub agents with placeholder behavior.json files.
