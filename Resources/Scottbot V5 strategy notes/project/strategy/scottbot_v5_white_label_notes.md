# ScottBot V5 – White-Label Rollout Notes

## Overview
ScottBot V5 is designed with modular agents, allowing for different bundles of functionality to be offered to individuals, coaches, and organizations. White-labeling becomes possible by restructuring the Master Agent (to reflect the new owner’s tone/brand) and enabling specific sets of sub-agents.

## Tiered Model

### Tier 1 — Personal Journal (Basic)
- **For:** Individuals wanting structured journaling and habit awareness.
- **Agents:** Master, Mindset, Wellness, Data Handling.
- **Features:** Mood & habit tracking, light insights, journaling prompts.

### Tier 2 — Growth Journal (Pro)
- **For:** Individuals seeking guided progress.
- **Agents:** Master, Mindset, Wellness, Health, Goals, Review, Data Handling.
- **Optional:** Coaching Agent (ACC/PCC lite mode).
- **Features:** Goal-setting, weekly reviews, personalized prompts.

### Tier 3 — Coaching Companion (Premium)
- **For:** Individuals wanting full coaching-style engagement.
- **Agents:** Master, Mindset, Wellness, Health, Goals, Review, Coaching, Data Handling.
- **Features:** ICF-style coaching flows (ACC/PCC/MCC), coaching-level preference settings, integrated progress reviews.

### Tier 4 — Coach/Admin Platform (White-Label Pro)
- **For:** Professional coaches providing ScottBot to their clients.
- **Client-Facing Agents:** Mindset, Wellness, Health, Goals, Review, Coaching.
- **Admin Agents:** Coaching Session Audit, Client Progress Insights.
- **Features:** Admin dashboard with session audits (ICF adherence), client progress reporting, goal adherence summaries, white-label branding.

### Tier 5 — Enterprise / Org Model
- **For:** Coaching firms, wellness orgs, training institutions.
- **Agents:** Full set (client + admin) + custom plug-in agents.
- **Features:** Multi-client dashboards, advanced analytics, integrations (LMS, HR, wearables), organization-wide branding.

## Design Benefits
- Same core architecture supports all tiers.
- New white-label = update Master behavior.json + select agent bundle.
- Allows future scalability into professional/enterprise space without re-engineering core logic.
