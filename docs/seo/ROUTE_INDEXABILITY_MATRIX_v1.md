# Route Indexability Matrix v1

| Route family | Index | Follow | Canonical | Sitemap | Notes |
|---|---:|---:|---:|---:|---|
| `/` | yes | yes | yes | yes | Main entity page |
| `/services/**` | yes | yes | yes | yes | Real public service content only |
| `/ai/**` | yes | yes | yes | yes | Public AI capability/product content |
| `/social/**` | yes | yes | yes | yes | Public channel/service content |
| `/automation/**` | yes | yes | yes | yes | Public workflow/use-case content |
| `/pricing` | yes | yes | yes | yes | Current pricing source of truth |
| `/blog/**` | yes | yes | yes | yes | Editorial content |
| `/faq` | yes | yes | yes | yes | Actual FAQ content |
| `/about`, `/contact` | yes | yes | yes | yes | Trust/entity pages |
| `/terms`, `/privacy` | configurable | yes | yes | optional | Legal pages; decide per jurisdiction/content strategy |
| `/auth/**` | no | no | no | no | Private/auth surface |
| `/dashboard/**` | no | no | no | no | Private application |
| `/workspace/**` | no | no | no | no | Private workspace selector |
| `/api/**` | no | no | no | no | Machine/API surface |

## Rule

Indexability is a product/content decision, not a blanket technical setting. A page is indexable only when it provides standalone public value and has a canonical URL.
