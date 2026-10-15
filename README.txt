Ahmed ELsaman — Responsive Profile + Owner Editor

Public profile:
- Open index.html locally, or publish the project using GitHub Pages.

Owner editor:
- admin.html is the login-gated control panel for profile image, bio, contact links and social links.
- The editor requires a Supabase project and owner-only database/storage policies before publishing changes.
- Follow SETUP_AR.md for the exact setup, SQL policies and GitHub Pages deployment steps.

Important security notes:
- Never place a Supabase service_role/secret key in this project.
- Only use the public anon/publishable key in javascript/supabase-config.js.
- GitHub Pages files are public even if a route is not linked in navigation. Supabase Row Level Security and Storage policies protect actual writes; use a hosting access-control layer if the admin URL itself must be inaccessible to other visitors.

Features:
- Responsive light/dark themes and soft animated ambient background.
- Animated card and portrait frame, floating portrait with its light halo, reduced-motion support.
- Editable contact/social link collections and public profile picture upload.
