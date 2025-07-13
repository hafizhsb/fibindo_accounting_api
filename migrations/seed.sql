-- account header
CREATE TABLE IF NOT EXISTS ${schemaName}.account_header (
	account_header_id serial4 NOT NULL,
	account_header_code citext NOT NULL,
	account_header_name citext NOT NULL,
	is_active bool DEFAULT true NULL,
	deleted_at timestamptz NULL,
	deleted_by citext NULL,
	CONSTRAINT account_header_pk PRIMARY KEY (account_header_id)
);

-- account categories
CREATE TABLE IF NOT EXISTS ${schemaName}.account_category (
	account_category_id serial4 NOT NULL,
	account_category_name citext NULL,
	account_category_code citext NULL,
	created_at timestamptz NULL,
	deleted_at timestamptz NULL,
	account_header_id int4 NULL,
	deleted_by citext NULL,
	is_active bool DEFAULT true NULL,
	CONSTRAINT account_category_pk PRIMARY KEY (account_category_id),
	CONSTRAINT account_category_account_header_fk FOREIGN KEY (account_header_id) REFERENCES ${schemaName}.account_header(account_header_id)
);

-- COA
CREATE TABLE IF NOT EXISTS ${schemaName}.coa (
	account_id serial4 NOT NULL,
	account_code varchar(30) NOT NULL,
	account_name citext NOT NULL,
	is_active bool DEFAULT true NULL,
	is_ar bool DEFAULT false NULL,
	is_ap bool DEFAULT false NULL,
	"type" varchar(6) DEFAULT NULL::character varying NULL,
	bank_id int4 NULL,
	normal_balance int4 NOT NULL,
	statement_type int4 NOT NULL,
	account_category_id int4 NULL,
	parent_id int4 DEFAULT 0 NULL,
	is_system bool DEFAULT false NULL,
	deleted_by citext NULL,
	deleted_at timestamp NULL,
	CONSTRAINT pk_chartofaccounts PRIMARY KEY (account_id),
	CONSTRAINT coa_account_category_fk FOREIGN KEY (account_category_id) REFERENCES ${schemaName}.account_category(account_category_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX uidx_coa_accountcode ON ${schemaName}.coa USING btree (account_code) WHERE (deleted_at IS NULL);


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

-- DROP FUNCTION schema_1.update_acct_movement();

CREATE OR REPLACE FUNCTION schema_1.update_acct_movement()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
      BEGIN
        IF(TG_OP = 'INSERT') THEN
          CASE TG_TABLE_NAME
            WHEN 'journal_detail' THEN
              INSERT INTO schema_1.acct_movement
                (transaction_date, account_id, account_code, account_name, source_doc_no,
                  journal_no, notes, debit, credit, balance, journal_detail_id, contact_id)
              SELECT
                jh.transaction_date, c.account_id, c.account_code, c.account_name, jh.source_doc_no,
                lpad(((jh.journal_id)::character varying (50))::text, 10, (
                SELECT 'GJ'::text || '-0000000000'::text)) AS journal_no,
                jh.notes,
                sum((jd.debit)::numeric) AS debit,
                sum((jd.credit)::numeric) AS credit,
                (COALESCE(sum((jd.debit)::numeric), (0)::numeric) - COALESCE(sum((jd.credit)::numeric), (0)::numeric)) AS balance, new.journal_detail_id, new.contact_id
              FROM (SELECT NEW.*) jd
              JOIN schema_1.journal_header jh ON jd.journal_id = jh.journal_id
              JOIN schema_1.coa c ON c.account_id = jd.account_id
              GROUP BY jh.transaction_date, c.account_id, c.account_code, c.account_name, jh.source_doc_no, jh.journal_id, jh.notes, new.journal_detail_id;
          END CASE;

          RETURN NEW;
        ELSIF(TG_OP = 'UPDATE') THEN
          CASE TG_TABLE_NAME
            WHEN 'journal_detail' THEN
              WITH balance_cte AS (
                SELECT (COALESCE(sum((debit)::numeric), (0)::numeric) - COALESCE(sum((credit)::numeric), (0)::numeric)) AS balance FROM schema_1.journal_detail WHERE journal_detail_id = new.journal_detail_id AND journal_id = new.journal_id
              )

              UPDATE schema_1.acct_movement
              SET
                transaction_date = h.transaction_date,
                account_id = c.account_id,
                account_code = c.account_code,
                account_name = c.account_name,
                notes = h.notes,
                debit = new.debit,
                credit = new.credit,
                balance = (SELECT balance FROM balance_cte),
				contact_id = new.contact_id
              FROM schema_1.journal_header h
              JOIN schema_1.coa c ON c.account_id = new.account_id
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


-- restart sequencee
-- ALTER SEQUENCE ${schemaName}.coa_account_id_seq RESTART WITH 1;
-- ALTER SEQUENCE ${schemaName}.journal_detail_journal_detail_id_seq RESTART WITH 1;
-- ALTER SEQUENCE ${schemaName}.journal_header_journal_id_seq RESTART WITH 1;
-- ALTER SEQUENCE ${schemaName}.acct_movement_acct_movement_id_seq RESTART WITH 1;

-- contact
-- 1: Pelanggan, 2: Pemasok, 3. Pelanggan dan Pemasok
CREATE TABLE IF NOT EXISTS ${schemaName}.contact (
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

-- SEED Master Data

-- account header
INSERT INTO ${schemaName}.account_header (account_header_id, account_header_code, account_header_name, is_active, deleted_at, deleted_by) VALUES(1, '1', 'Aset', true, NULL, NULL);
INSERT INTO ${schemaName}.account_header (account_header_id, account_header_code, account_header_name, is_active, deleted_at, deleted_by) VALUES(2, '2', 'Liabilitas', true, NULL, NULL);
INSERT INTO ${schemaName}.account_header (account_header_id, account_header_code, account_header_name, is_active, deleted_at, deleted_by) VALUES(3, '3', 'Ekuitas', true, NULL, NULL);
INSERT INTO ${schemaName}.account_header (account_header_id, account_header_code, account_header_name, is_active, deleted_at, deleted_by) VALUES(4, '4', 'Pendapatan', true, NULL, NULL);
INSERT INTO ${schemaName}.account_header (account_header_id, account_header_code, account_header_name, is_active, deleted_at, deleted_by) VALUES(5, '5', 'Beban', true, NULL, NULL);

-- account categories
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(1, 'Aset Lancar', '11', 'now()', NULL, 1, NULL, true);
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(2, 'Aset Tidak Lancar', '12', 'now()', NULL, 1, NULL, true);
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(3, 'Liabilitas Jangka Pendek', '21', 'now()', NULL, 2, NULL, true);
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(4, 'Liabilitas Jangka Panjang', '22', 'now()', NULL, 2, NULL, true);
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(5, 'Ekuitas', '31', 'now()', NULL, 3, NULL, true);
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(6, 'Pendapatan', '41', 'now()', NULL, 4, NULL, true);
INSERT INTO ${schemaName}.account_category (account_category_id, account_category_name, account_category_code, created_at, deleted_at, account_header_id, deleted_by, is_active) VALUES(7, 'Beban Usaha', '51', 'now()', NULL, 5, NULL, true);

-- Journal Header
INSERT INTO ${schemaName}.journal_header (journal_id, transaction_date, created_date, source_doc_no, notes, is_opening_balance) VALUES(-1, 'now()', 'now()', '_JRN-BB_', 'Saldo Awal Akun', true) ON CONFLICT (journal_id) DO NOTHING;

-- account (coa)
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(1, '111', 'Kas dan Setara Kas', true, false, false, NULL, NULL, 1, 1, 1, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(2, '113', 'Piutang', true, true, false, NULL, NULL, 1, 1, 1, 0, true, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(3, '114', 'Penyisihan Piutang', true, false, false, NULL, NULL, 1, 1, 1, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(4, '117', 'Persediaan', true, false, false, NULL, NULL, 1, 1, 1, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(5, '118', 'Beban Dibayar Dimuka', true, false, false, NULL, NULL, 1, 1, 1, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(6, '119', 'Pajak Dibayar Dimuka', true, false, false, NULL, NULL, 1, 1, 1, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(7, '1110', 'Aset lancar lainnya', true, false, false, NULL, NULL, 1, 1, 1, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(8, '121', 'Aset Tetap', true, false, false, NULL, NULL, 1, 1, 2, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(9, '122', 'Akumulasi Penyusutan', true, false, false, NULL, NULL, 1, 1, 2, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(10, '123', 'Investasi Jangka Panjang', true, false, false, NULL, NULL, 1, 1, 2, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(11, '124', 'Aset Tidak Berwujud', true, false, false, NULL, NULL, 1, 1, 2, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(12, '125', 'Aset Pajak Tangguhan', true, false, false, NULL, NULL, 1, 1, 2, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(13, '126', 'Aset Tidak Lancar Lainnya', true, false, false, NULL, NULL, 1, 1, 2, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(14, '211', 'Utang', true, false, true, NULL, NULL, 2, 1, 3, 0, true, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(15, '213', 'Biaya Yang Masih Harus Dibayar', true, false, false, NULL, NULL, 2, 1, 3, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(16, '214', 'Liabilitas lancar lainnya', true, false, false, NULL, NULL, 2, 1, 3, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(17, '222', 'Utang jangka Panjang', true, false, true, NULL, NULL, 2, 1, 4, 0, true, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(18, '223', 'Liabilitas tidak lancar lainnya', true, false, false, NULL, NULL, 2, 1, 4, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(19, '311', 'Modal Saham', true, false, false, NULL, NULL, 2, 1, 5, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(20, '312', 'Agio Saham (Tambahan Modal Disetor)', true, false, false, NULL, NULL, 2, 1, 5, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(21, '313', 'Laba Ditahan', true, false, false, NULL, NULL, 2, 1, 5, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(22, '314', 'Pendapatan Komprehensif Lainnya', true, false, false, NULL, NULL, 2, 1, 5, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(23, '315', 'Ekuitas Lainnya', true, false, false, NULL, NULL, 2, 1, 5, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(24, '401', 'Pendapatan', true, false, false, NULL, NULL, 2, 2, 6, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(25, '410', 'Pendapatan lainnya', true, false, false, NULL, NULL, 1, 2, 6, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(26, '511', 'Beban Pemasaran', true, false, false, NULL, NULL, 1, 2, 7, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(27, '512', 'Beban Umum dan Administrasi', true, false, false, NULL, NULL, 1, 2, 7, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(28, '513', 'Beban Pokok Pendapatan', true, false, false, NULL, NULL, 2, 2, 7, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(29, '514', 'Beban Lainnya', true, false, false, NULL, NULL, 1, 2, 7, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;
INSERT INTO ${schemaName}.coa (account_id, account_code, account_name, is_active, is_ar, is_ap, "type", bank_id, normal_balance, statement_type, account_category_id, parent_id, is_system, deleted_by, deleted_at) VALUES(30, '515', 'Beban (Manfaat) Pajak Penghasilan', true, false, false, NULL, NULL, 1, 2, 7, 0, false, NULL, NULL) ON CONFLICT (account_id) DO NOTHING;

-- journal detail
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(1, -1, 1, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(2, -1, 2, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(3, -1, 3, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(4, -1, 4, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(5, -1, 5, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(6, -1, 6, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(7, -1, 7, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(8, -1, 8, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(9, -1, 9, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(10, -1, 10, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(11, -1, 11, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(12, -1, 12, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(13, -1, 13, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(14, -1, 14, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(15, -1, 15, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(16, -1, 16, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(17, -1, 17, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(18, -1, 18, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(19, -1, 19, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(20, -1, 20, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(21, -1, 21, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(22, -1, 22, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(23, -1, 23, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(24, -1, 24, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(25, -1, 25, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(26, -1, 26, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(27, -1, 27, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(28, -1, 28, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(29, -1, 29, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;
INSERT INTO ${schemaName}.journal_detail (journal_detail_id, journal_id, account_id, description, debit, credit, is_reconciled, notes) VALUES(30, -1, 30, 'Saldo Awal', 0.0000, 0.0000, false, NULL) ON CONFLICT (journal_detail_id) DO NOTHING;

-- Add colom
ALTER TABLE ${schemaName}.journal_header ADD journal_no citext NULL;
ALTER TABLE ${schemaName}.journal_header ADD CONSTRAINT journal_header_unique UNIQUE (journal_no);
ALTER TABLE ${schemaName}.journal_header ADD journal_attachment_url citext NULL;


ALTER TABLE ${schemaName}.journal_detail ADD contact_id int4 NULL;
ALTER TABLE ${schemaName}.journal_detail ADD CONSTRAINT journal_detail_contact_fk FOREIGN KEY (contact_id) REFERENCES schema_1.contact(contact_id) ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE ${schemaName}.acct_movement ADD contact_id int4 NULL;
ALTER TABLE ${schemaName}.acct_movement ADD CONSTRAINT acct_movement_contact_fk FOREIGN KEY (contact_id) REFERENCES schema_1.contact(contact_id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- alter journal detail to default 0
ALTER TABLE ${schemaName}.journal_detail ALTER credit set default 0
ALTER TABLE ${schemaName}.journal_detail ALTER debit set default 0