# Entity Graph Spec v1

The platform should expose consistent first-party entities across navigation, visible content, metadata and JSON-LD.

## Core entities
- Organization: Digital Platform
- Product: each public service/AI capability
- Service category: AI, Social, Automation, Digital Services
- Channel: Instagram, Telegram, TikTok, YouTube, X
- Workspace: authenticated customer context
- Article: editorial/reference content

## Relationship model
Organization -> offers -> Product
Product -> belongsTo -> Category
Product -> supports -> Channel
Product -> hasUseCase -> Use Case
Product -> hasFAQ -> FAQ item
Product -> relatedTo -> Product/Article

## Consistency requirements
- Same canonical naming across page H1, title metadata, JSON-LD and internal links.
- Do not create multiple near-identical entities for spelling variants.
- Slugs are stable; redirects are required for intentional changes.
