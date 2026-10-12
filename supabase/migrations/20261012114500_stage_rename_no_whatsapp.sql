-- Renaming a material group changes its label only. Do not create project
-- notifications or WhatsApp outbox entries when the status and visibility stay equal.
DO $guard$
DECLARE v_definition text;
BEGIN
 SELECT pg_get_functiondef('public.notify_project_stage_change()'::regprocedure) INTO v_definition;
 IF position('or old.name is distinct from new.name' IN v_definition)>0 THEN
   EXECUTE replace(v_definition,
     'or old.name is distinct from new.name',
     'or false /* rename alone does not notify customer */');
 ELSIF position('rename alone does not notify customer' IN v_definition)=0 THEN
   RAISE EXCEPTION 'Unexpected stage notification function; migration requires review';
 END IF;
END $guard$;
