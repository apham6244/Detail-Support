-- ============================================================================
-- Attach Stripe Price IDs to the plan catalog.
--
-- NOT a numbered migration on purpose: Price IDs are environment-specific
-- (test mode and live mode have different ones), so this must not run
-- automatically everywhere. Run it by hand, per environment, in the Supabase
-- SQL editor. Re-running is safe.
--
-- The app cannot do this itself: public.plans has a SELECT policy and no
-- UPDATE policy, so a write through PostgREST silently affects zero rows and
-- still returns 200. The catalog is deliberately owned by an operator, not by
-- the application.
--
-- ⚠️  ORDER MATTERS. Setting a Price ID on any paid tier flips
--     billing_is_live() to true, which DISARMS the manual plan switcher for
--     every plan. If the server has no STRIPE_SECRET_KEY at that moment,
--     checkout returns 503 and nobody can change plans at all. Put the keys in
--     server/.env and restart the API BEFORE running this.
--
-- Price IDs are public identifiers (they ride in Checkout URLs), not secrets —
-- unlike sk_… / whsec_…, which belong only in server/.env.
--
-- Current values: Stripe TEST mode, captured 2026-07-17.
-- ============================================================================

begin;

-- Pro — $5/month. Founding members check out against the founding price so the
-- rate promised at signup survives any future list-price rise.
update public.plans
   set stripe_price_id          = 'price_1Tu4LtRq531xK5mmGb7F3ubj',
       stripe_price_id_founding = 'price_1Tu4PERq531xK5mmHb45uHUZ'
 where plan = 'pro';

-- Team — $15/month.
update public.plans
   set stripe_price_id          = 'price_1Tu4N8Rq531xK5mmgUiVsrUc',
       stripe_price_id_founding = 'price_1Tu4PdRq531xK5mm42UI4aMi'
 where plan = 'team';

-- Free must never carry a Price ID: it is what effective_plan() falls back to.
update public.plans
   set stripe_price_id = null, stripe_price_id_founding = null
 where plan = 'free';

-- Fail loudly rather than half-configuring: a paid tier with no price is
-- unbuyable AND unswitchable once billing goes live.
do $guard$
declare v_missing int;
begin
  select count(*) into v_missing
    from public.plans
   where plan <> 'free' and coalesce(stripe_price_id, '') = '';
  if v_missing > 0 then
    raise exception 'Refusing to go live: % paid tier(s) still have no Price ID.', v_missing;
  end if;
end $guard$;

commit;

-- Verify: expect both paid tiers priced, free empty, and billing live.
select plan, monthly_price, stripe_price_id, stripe_price_id_founding
  from public.plans order by sort_order;
select public.billing_is_live() as billing_is_live_expect_true;
