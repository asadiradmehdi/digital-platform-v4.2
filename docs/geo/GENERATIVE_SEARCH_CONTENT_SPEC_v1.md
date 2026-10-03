# Generative Search Content Spec v1

## Objective

Build public content that can be correctly interpreted by AI search/answer systems without trying to manipulate them.

## Page contract

Every important public page should expose, in server-rendered HTML:

1. Entity name.
2. What it is.
3. Who it is for.
4. What it does.
5. Key capabilities.
6. Requirements/limitations.
7. Pricing or a canonical pricing reference when applicable.
8. Supported channels/regions when applicable.
9. Last reviewed/updated date when useful.
10. Canonical URL.
11. Related internal pages.
12. Structured data appropriate to the page.

## Answer blocks

Use short factual blocks near the top:

- Definition
- Who it is for
- Main capabilities
- How it works
- Requirements
- Pricing model
- Important limitations

Long-form explanation can follow. Do not hide the answer below decorative UI.

## Citation-friendly writing

Claims that could be repeated by an AI system should have a first-party source page and, when material, an evidence/methodology section. Avoid unsupported superlatives such as “best”, “cheapest”, “fastest” unless a transparent, reproducible methodology exists and is documented.

## Freshness

Dynamic claims must be generated from the same source of truth used by the application. Do not duplicate prices or limits manually across dozens of pages.

## Content taxonomy

- Pillar pages: AI, Social, Automation, Services.
- Category pages: platform/channel/service families.
- Product/service pages: exact offer and requirements.
- Use-case pages: problem → workflow → outcome.
- Editorial pages: educational, comparison, implementation and troubleshooting content.
- Reference pages: terminology, policies, API docs and capability matrices.

## Anti-spam constraints

No mass-generated near-duplicate pages, keyword stuffing, hidden content, fake testimonials, fabricated citations, or schema that contradicts visible content.
