-- Wipes one owner's rental work. Identity rows stay. Messaging history triggers are
-- paused only for this function because they reject DELETE.
CREATE FUNCTION trooi_reset_owner_work(target uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, gateway
AS $$
DECLARE
  org_ids uuid[] := '{}';
  property_ids uuid[] := '{}';
  room_ids uuid[] := '{}';
  listing_ids uuid[] := '{}';
  tenancy_ids uuid[] := '{}';
  conversation_ids uuid[] := '{}';
BEGIN
  IF target IS NULL THEN
    RETURN;
  END IF;
  SELECT coalesce(array_agg(organization_id), '{}') INTO org_ids
    FROM organizations WHERE primary_owner_user_id = target;
  SELECT coalesce(array_agg(property_id), '{}') INTO property_ids
    FROM properties WHERE organization_id = ANY(org_ids);
  SELECT coalesce(array_agg(room_id), '{}') INTO room_ids
    FROM rooms WHERE property_id = ANY(property_ids);
  SELECT coalesce(array_agg(listing_id), '{}') INTO listing_ids
    FROM listings WHERE room_id = ANY(room_ids);
  SELECT coalesce(array_agg(tenancy_id), '{}') INTO tenancy_ids
    FROM tenancies WHERE room_id = ANY(room_ids);
  SELECT coalesce(array_agg(conversation_id), '{}') INTO conversation_ids
    FROM messaging_conversations
    WHERE tenancy_id = ANY(tenancy_ids)
       OR inquiry_id IN (SELECT inquiry_id FROM inquiries WHERE listing_id = ANY(listing_ids));

  ALTER TABLE messaging_messages DISABLE TRIGGER messaging_messages_immutable;
  ALTER TABLE messaging_attachments DISABLE TRIGGER messaging_attachments_immutable;
  BEGIN
    DELETE FROM messaging_attachment_upload_intents WHERE conversation_id = ANY(conversation_ids);
    DELETE FROM messaging_attachments WHERE message_id IN (
      SELECT message_id FROM messaging_messages WHERE conversation_id = ANY(conversation_ids));
    DELETE FROM messaging_messages WHERE conversation_id = ANY(conversation_ids);
    DELETE FROM messaging_participants WHERE conversation_id = ANY(conversation_ids);
    DELETE FROM messaging_conversations WHERE conversation_id = ANY(conversation_ids);

    DELETE FROM gateway.gateway_checkouts WHERE tenancy_id = ANY(tenancy_ids);
    UPDATE receipts SET replacement_receipt_id = NULL
      WHERE payment_id IN (SELECT payment_id FROM payments WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM receipts WHERE payment_id IN (SELECT payment_id FROM payments WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM deposit_events WHERE deposit_id IN (SELECT deposit_id FROM deposits WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM deposit_payment_applications WHERE deposit_id IN (SELECT deposit_id FROM deposits WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM deposit_settlements WHERE deposit_id IN (SELECT deposit_id FROM deposits WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM deposits WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM payment_claims WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM payment_allocations WHERE payment_id IN (SELECT payment_id FROM payments WHERE tenancy_id = ANY(tenancy_ids));
    UPDATE payments SET replacement_payment_id = NULL WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM payments WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM charges WHERE billing_cycle_id IN (SELECT billing_cycle_id FROM billing_cycles WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM billing_cycles WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM meter_readings WHERE utility_connection_id IN (
      SELECT utility_connection_id FROM utility_connections WHERE room_id = ANY(room_ids));
    DELETE FROM utility_connections WHERE room_id = ANY(room_ids);
    DELETE FROM tenancy_join_invitations WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM terms_acknowledgements WHERE tenancy_terms_id IN (
      SELECT tenancy_terms_id FROM tenancy_terms WHERE tenancy_id = ANY(tenancy_ids));
    DELETE FROM tenancy_notices WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM reviews WHERE tenancy_id = ANY(tenancy_ids) OR property_id = ANY(property_ids);
    DELETE FROM tenancy_participants WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM tenancy_terms WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM tenancies WHERE tenancy_id = ANY(tenancy_ids);
    DELETE FROM trust_reports WHERE listing_id = ANY(listing_ids);
    DELETE FROM inquiries WHERE listing_id = ANY(listing_ids);
    DELETE FROM listing_status_events WHERE listing_id = ANY(listing_ids);
    DELETE FROM listing_asset_media WHERE listing_id = ANY(listing_ids);
    DELETE FROM listing_asset_media_intents WHERE listing_id = ANY(listing_ids);
    DELETE FROM listing_asset_details WHERE listing_id = ANY(listing_ids);
    DELETE FROM listings WHERE listing_id = ANY(listing_ids);
    DELETE FROM incident_events WHERE incident_id IN (SELECT incident_id FROM incidents WHERE room_id = ANY(room_ids));
    DELETE FROM incidents WHERE room_id = ANY(room_ids);
    DELETE FROM rooms WHERE room_id = ANY(room_ids);
    DELETE FROM properties WHERE property_id = ANY(property_ids);
    DELETE FROM organizations WHERE organization_id = ANY(org_ids);

    DELETE FROM owner_plan_entitlements WHERE owner_user_id = target;
    DELETE FROM owner_plan_checkouts WHERE owner_user_id = target;
    DELETE FROM owner_slot_entitlements WHERE owner_user_id = target;
    DELETE FROM owner_slot_checkouts WHERE owner_user_id = target;
    DELETE FROM identity_auto_checks WHERE user_id = target;
    DELETE FROM notifications WHERE recipient_user_id = target;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE messaging_messages ENABLE TRIGGER messaging_messages_immutable;
    ALTER TABLE messaging_attachments ENABLE TRIGGER messaging_attachments_immutable;
    RAISE;
  END;
  ALTER TABLE messaging_messages ENABLE TRIGGER messaging_messages_immutable;
  ALTER TABLE messaging_attachments ENABLE TRIGGER messaging_attachments_immutable;
END;
$$;
