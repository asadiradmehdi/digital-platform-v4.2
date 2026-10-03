# Design Tokens

Single semantic source of truth for Web/PWA/Mobile product identity.

## Rules
- Components consume semantic roles, not raw hex values, whenever practical.
- Mobile may adapt layout to native conventions but must preserve the same semantic hierarchy.
- New colors/radii/spacing values require a token change, not one-off page CSS.
- Persian text uses the project Persian font; IDs, URLs, API keys and model identifiers use isolated LTR rendering.
- Every component defines loading, empty, error, success, disabled and focus behavior where applicable.
