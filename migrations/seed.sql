-- COA
CREATE TABLE IF NOT EXISTS ${schemaName}.coa (
	account_id serial4 NOT NULL,
	account_code varchar(6) NOT NULL,
	account_name citext NOT NULL,
	is_active bool DEFAULT true NULL,
  is_ar bool DEFAULT false NULL,
  is_ap bool DEFAULT false NULL,
	"type" varchar(6) DEFAULT NULL::character varying NULL,
	bank_id int4 NULL,
	normal_balance int4 NOT NULL,
	statement_type int4 NOT NULL,
	CONSTRAINT ix_chartofaccounts_accountcode UNIQUE (account_code),
	CONSTRAINT pk_chartofaccounts PRIMARY KEY (account_id)
);

-- contact
CREATE TABLE ${schemaName}.contact (
	contact_id serial4 NOT NULL,
	contact_name citext NOT NULL,
	contact_phone citext NULL,
	contact_email citext NULL,
	contact_address citext NULL,
  contact_type int4 NULL,
	created_at timestamptz NULL,
	updated_at timetz NULL,
	CONSTRAINT contact_pk PRIMARY KEY (contact_id)
);

-- journal header
CREATE TABLE ${schemaName}.journal_header (
	journal_id serial4 NOT NULL,
	transaction_date timestamptz NOT NULL,
	created_date timestamptz NOT NULL,
	source_doc_no varchar(50) NULL,
	notes citext NULL,
	is_opening_balance bool DEFAULT false NULL,
	CONSTRAINT pk_journal_header PRIMARY KEY (journal_id)
);
CREATE INDEX idx_journal_header_list_search ON ${schemaName}.journal_header USING gin (source_doc_no gin_trgm_ops, notes gin_trgm_ops);
CREATE INDEX idx_journal_header_trxdate ON ${schemaName}.journal_header USING btree (transaction_date);
CREATE INDEX idx_jurnal_id ON ${schemaName}.journal_header USING btree (journal_id);


-- bigamount
CREATE DOMAIN ${schemaName}.bigamount AS numeric(20,4);

-- journal detail
CREATE TABLE ${schemaName}.journal_detail (
	journal_detail_id serial4 NOT NULL,
	journal_id int4 NOT NULL,
	account_id int4 NOT NULL,
	description citext NULL,
	debit ${schemaName}."bigamount" NULL,
	credit ${schemaName}."bigamount" NULL,
	is_reconciled bool DEFAULT false NOT NULL,
	is_reconciled bool DEFAULT false NOT NULL,
	notes citext NULL,
	CONSTRAINT pk_journal_detail PRIMARY KEY (journal_detail_id),
	CONSTRAINT generaljournal_detail_chartofaccounts FOREIGN KEY (account_id) REFERENCES ${schemaName}.coa(account_id) ON DELETE RESTRICT,
	CONSTRAINT generaljournal_detail_generaljournal_header FOREIGN KEY (journal_id) REFERENCES ${schemaName}.journal_header(journal_id) ON DELETE CASCADE
);
CREATE INDEX idx_journal_detail_journalid ON ${schemaName}.journal_detail USING btree (journal_id);

-- acct movement
CREATE TABLE ${schemaName}.acct_movement (
	acct_movement_id serial4 NOT NULL,
	account_id int4 NOT NULL,
	account_code varchar NOT NULL,
	account_name citext NOT NULL,
	source_doc_no varchar NULL,
	journal_no text NOT NULL,
	notes citext NULL,
	debit numeric NULL,
	credit numeric NULL,
	balance numeric NULL,
	transaction_date timestamptz NOT NULL,
	created_date timestamptz DEFAULT now() NULL,
	journal_detail_id int4 NULL,
	CONSTRAINT acct_movement_pkey PRIMARY KEY (acct_movement_id),
	CONSTRAINT acct_mov_journal FOREIGN KEY (journal_detail_id) REFERENCES ${schemaName}.journal_detail(journal_detail_id) ON DELETE CASCADE
);
CREATE INDEX idx_acct_movement_account_id ON ${schemaName}.acct_movement USING btree (account_id);
CREATE INDEX idx_acct_movement_journal ON ${schemaName}.acct_movement USING btree (journal_detail_id);
CREATE INDEX idx_acct_movement_transaction_date ON ${schemaName}.acct_movement USING btree (transaction_date);

-- update_acct_movement();

CREATE OR REPLACE FUNCTION ${schemaName}.update_acct_movement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        IF(TG_OP = 'INSERT') THEN
          CASE TG_TABLE_NAME
            WHEN 'journal_detail' THEN
              INSERT INTO ${schemaName}.acct_movement
                (transaction_date, account_id, account_code, account_name, source_doc_no,
                  journal_no, notes, debit, credit, balance, journal_detail_id)
              SELECT
                jh.transaction_date, c.account_id, c.account_code, c.account_name, jh.source_doc_no,
                lpad(((jh.journal_id)::character varying (50))::text, 10, (
                SELECT 'GJ'::text || '-0000000000'::text)) AS journal_no,
                jh.notes,
                sum((jd.debit)::numeric) AS debit,
                sum((jd.credit)::numeric) AS credit,
                (COALESCE(sum((jd.debit)::numeric), (0)::numeric) - COALESCE(sum((jd.credit)::numeric), (0)::numeric)) AS balance, new.journal_detail_id
              FROM (SELECT NEW.*) jd
              JOIN ${schemaName}.journal_header jh ON jd.journal_id = jh.journal_id
              JOIN ${schemaName}.coa c ON c.account_id = jd.account_id
              GROUP BY jh.transaction_date, c.account_id, c.account_code, c.account_name, jh.source_doc_no, jh.journal_id, jh.notes, new.journal_detail_id;
          END CASE;

          RETURN NEW;
        ELSIF(TG_OP = 'UPDATE') THEN
          CASE TG_TABLE_NAME
            WHEN 'journal_detail' THEN
              WITH balance_cte AS (
                SELECT (COALESCE(sum((debit)::numeric), (0)::numeric) - COALESCE(sum((credit)::numeric), (0)::numeric)) AS balance FROM ${schemaName}.journal_detail WHERE journal_detail_id = new.journal_detail_id AND journal_id = new.journal_id
              )

              UPDATE ${schemaName}.acct_movement
              SET
                transaction_date = h.transaction_date,
                account_id = c.account_id,
                account_code = c.account_code,
                account_name = c.account_name,
                notes = h.notes,
                debit = new.debit,
                credit = new.credit,
                balance = (SELECT balance FROM balance_cte)
              FROM ${schemaName}.journal_header h
              JOIN ${schemaName}.coa c ON c.account_id = new.account_id
              WHERE h.journal_id = new.journal_id AND journal_detail_id = new.journal_detail_id;
          END CASE;

          RETURN NEW;
        END IF;
      END
    $function$
;

-- trigger
create trigger update_acct_movement after
insert
    or
update
    on
    ${schemaName}.journal_detail for each row execute function ${schemaName}.update_acct_movement();



-- account header
CREATE TABLE IF NOT EXISTS ${schemaName}.account_header (
	account_header_id serial4 NOT NULL,
	account_header_code citext NOT NULL,
	account_header_name citext NOT NULL,
	is_ar bool NULL,
	is_ap bool NULL,
	is_active bool DEFAULT true NULL,
	CONSTRAINT account_header_pk PRIMARY KEY (account_header_id)
);

ALTER TABLE ${schemaName}.coa ADD account_header_id int4 NULL;
ALTER TABLE ${schemaName}.coa ADD CONSTRAINT coa_account_header_fk FOREIGN KEY (account_header_id) REFERENCES schema_1.account_header(account_header_id) ON DELETE RESTRICT ON UPDATE CASCADE;
