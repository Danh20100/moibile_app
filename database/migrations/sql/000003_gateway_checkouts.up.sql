CREATE SCHEMA IF NOT EXISTS gateway;

CREATE TABLE gateway.gateway_checkouts (
    checkout_id uuid NOT NULL,
    tenancy_id uuid NOT NULL,
    created_by_user_id uuid NOT NULL,
    amount numeric(18,2) NOT NULL,
    reference_code text NOT NULL,
    provider text NOT NULL,
    provider_order_id text NOT NULL,
    provider_request_id text NOT NULL,
    status text NOT NULL,
    pay_url text,
    deeplink text,
    resulting_payment_id uuid,
    last_ipn_payload text,
    last_ipn_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT pk_gateway_checkouts PRIMARY KEY (checkout_id),
    CONSTRAINT ck_gateway_checkouts_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_gateway_checkouts_provider CHECK (provider = 'MOMO'),
    CONSTRAINT ck_gateway_checkouts_status CHECK (status IN ('CREATED', 'FAILED', 'EXPIRED', 'SUCCEEDED')),
    CONSTRAINT uq_gateway_checkouts_provider_order UNIQUE (provider_order_id),
    CONSTRAINT uq_gateway_checkouts_resulting_payment UNIQUE (resulting_payment_id)
);

CREATE INDEX ix_gateway_checkouts_tenancy ON gateway.gateway_checkouts (tenancy_id);

ALTER TABLE gateway.gateway_checkouts
    ADD CONSTRAINT fk_gateway_checkouts_tenancy
    FOREIGN KEY (tenancy_id) REFERENCES public.tenancies (tenancy_id) ON DELETE NO ACTION;

ALTER TABLE gateway.gateway_checkouts
    ADD CONSTRAINT fk_gateway_checkouts_payment
    FOREIGN KEY (resulting_payment_id) REFERENCES public.payments (payment_id) ON DELETE NO ACTION;
