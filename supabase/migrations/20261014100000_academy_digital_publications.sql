-- Biblioteca digital da Academia: metadados, permissões e direitos de acesso.
-- Migração PREPARADA, não executar antes do corte de arquitetura Sagamente.
BEGIN;
CREATE TABLE IF NOT EXISTS public.academy_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  summary text,
  author text,
  kind text NOT NULL CHECK (kind IN ('ebook','audiobook')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  cover_url text,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.academy_publication_assets (
  publication_id uuid PRIMARY KEY REFERENCES public.academy_publications(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL CHECK (length(trim(drive_file_id)) BETWEEN 8 AND 255),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','audio/mpeg')),
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Um produto pode dar direito a várias obras (combo).
CREATE TABLE IF NOT EXISTS public.academy_publication_products (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  publication_id uuid NOT NULL REFERENCES public.academy_publications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_id,publication_id)
);
CREATE TABLE IF NOT EXISTS public.academy_publication_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.academy_publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('order','manual')),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT academy_entitlement_source_order CHECK ((source='order' AND order_id IS NOT NULL) OR (source='manual' AND order_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_entitlement_order_unique ON public.academy_publication_entitlements(user_id,publication_id,order_id) WHERE source='order';
CREATE UNIQUE INDEX IF NOT EXISTS academy_entitlement_manual_unique ON public.academy_publication_entitlements(user_id,publication_id) WHERE source='manual';
CREATE INDEX IF NOT EXISTS academy_entitlements_lookup_idx ON public.academy_publication_entitlements(user_id,publication_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS public.academy_publication_tickets (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.academy_publications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_publication_ticket_expiry_idx ON public.academy_publication_tickets(expires_at);
-- Postgres/RLS: capa e metadados públicos, NUNCA IDs dos arquivos do Drive.
ALTER TABLE public.academy_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_publication_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_publication_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_publication_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_publication_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_publications_catalog ON public.academy_publications FOR SELECT TO anon,authenticated USING (status='published' OR public.is_active_admin());
CREATE POLICY academy_publications_admin ON public.academy_publications FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY academy_publication_assets_admin ON public.academy_publication_assets FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY academy_publication_products_admin ON public.academy_publication_products FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY academy_publication_entitlement_own ON public.academy_publication_entitlements FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY academy_publication_entitlement_admin ON public.academy_publication_entitlements FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
-- Media tickets never directly selectable by browser; issued and resolved only in Edge Function under service role.
REVOKE ALL ON public.academy_publication_tickets FROM anon, authenticated;
-- Concessão automática apenas quando o PEDIDO chega a 'paid' no fluxo confiável existente.
CREATE OR REPLACE FUNCTION public.sync_academy_publication_order_access(p_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record;
BEGIN
 SELECT id,customer_id,payment_status INTO o FROM public.orders WHERE id=p_order_id;
 IF NOT FOUND OR o.customer_id IS NULL THEN RETURN; END IF;
 IF o.payment_status='paid' THEN
  INSERT INTO public.academy_publication_entitlements(publication_id,user_id,source,order_id,revoked_at)
  SELECT DISTINCT ap.publication_id,o.customer_id,'order',o.id,NULL
  FROM public.order_items oi JOIN public.academy_publication_products ap ON ap.product_id=oi.product_id
  WHERE oi.order_id=o.id AND oi.item_type='product'
  ON CONFLICT (user_id,publication_id,order_id) WHERE source='order'
  DO UPDATE SET revoked_at=NULL;
 ELSIF o.payment_status IN ('refunded','cancelled','rejected') THEN
  UPDATE public.academy_publication_entitlements e SET revoked_at=now()
  WHERE e.order_id=o.id AND e.source='order' AND e.revoked_at IS NULL;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_academy_publication_order_access(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.academy_publication_order_status_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
  PERFORM public.sync_academy_publication_order_access(NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER academy_entitlements_from_payment AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.academy_publication_order_status_trigger();
CREATE OR REPLACE FUNCTION public.academy_publication_order_item_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.sync_academy_publication_order_access(NEW.order_id);
 RETURN NEW;
END $$;
CREATE TRIGGER academy_entitlements_from_order_item AFTER INSERT OR UPDATE OF product_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.academy_publication_order_item_trigger();
COMMIT;
