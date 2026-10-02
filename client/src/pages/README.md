# Client App Notes

The client currently exposes the Home launcher, Citizen view, Worker view, Login, and NotFound. Worker routes use the shared role guard; the Citizen view remains public.

Shared styles live in `styles/`, reusable controls in `components/ui/`, and authentication/session plumbing in `context/` and `services/`.