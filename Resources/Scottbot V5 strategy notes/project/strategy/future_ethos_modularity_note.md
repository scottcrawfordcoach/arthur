# ScottBot V5 — Future Design Direction: Modular Coaching Ethos System

**Summary:**  
In future releases, ScottBot could support a *plug-and-play coaching ethos layer* — allowing the core architecture to remain consistent while swapping out guiding behavioral frameworks (ICF, Agile Coaching, NLP, etc.).

**Rationale:**  
This approach would enable white-label scalability, allowing coaches, organizations, or training programs to define their own tone, reflection depth, and questioning models while maintaining ScottBot’s underlying intelligence and data systems.

**Concept Overview:**
- Each ethos exists as a modular JSON or folder (e.g., `/ethos/icf/`, `/ethos/agile/`, `/ethos/nlp/`).
- The Coaching/Master Agent loads an ethos configuration dynamically at runtime.
- The ethos defines:
  - Tone and phrasing style.
  - Reflection/question structure.
  - Integration level with ICF rules, NLP meta-models, or Agile retrospectives.

**Example Future Use Cases:**
- `icf` → reflective, open-ended, client-led coaching.
- `agile` → structured sprint-based accountability.
- `nlp` → linguistically precise, meta-model questioning.
- Custom → white-label client uploads their ethos pack.

**Status:**  
Deferred for post-V5 exploration once core orchestration and ICF discipline are stable.
