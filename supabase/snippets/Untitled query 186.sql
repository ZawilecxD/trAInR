SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'e8c2759e-23f9-4979-92bc-64119f21ba42';
INSERT INTO public.profiles (id, role, display_name)
VALUES (
  'e8c2759e-23f9-4979-92bc-64119f21ba42'::uuid,
  'trainer',
  'rls-test'
);