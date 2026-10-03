# Search V5

Search remains deterministic and bounded. It adds routed intents for “what do I need to craft X?”,
“craft 20 X”, “what can I automate?”, “what blocks electricity?”, “what can I do now?” and known
unlock questions. No LLM or free-form rule generation is involved.

Craft quantities are capped at 999 in routes. Entity slugs are normalized with the same bounded
Unicode-safe policy as catalog search. Answers link to Crafting Planner V2, Automation Planner V3,
My Pokopia or source-backed item pages; they do not answer with invented totals.

Regression tests cover the new intents and the existing real-corpus search matrix.
