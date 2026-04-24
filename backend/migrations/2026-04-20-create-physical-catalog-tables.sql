-- Crea tabelle fisiche separate per catalogo (libri/tesi/cataloghi/riviste)
-- mantenendo la compatibilita' con la tabella principale "inventario".
-- Le API continuano ad usare "inventario", ma i dati vengono replicati
-- automaticamente nelle tabelle dedicate.

BEGIN;

CREATE TABLE IF NOT EXISTS inventario_libri (LIKE inventario INCLUDING ALL);
CREATE TABLE IF NOT EXISTS inventario_tesi (LIKE inventario INCLUDING ALL);
CREATE TABLE IF NOT EXISTS inventario_cataloghi (LIKE inventario INCLUDING ALL);
CREATE TABLE IF NOT EXISTS inventario_riviste (LIKE inventario INCLUDING ALL);

-- Evita accumuli da eventuali esecuzioni precedenti
TRUNCATE TABLE inventario_libri, inventario_tesi, inventario_cataloghi, inventario_riviste;

-- Backfill iniziale
INSERT INTO inventario_libri
SELECT * FROM inventario WHERE COALESCE(tipo_catalogo, 'libri') = 'libri';

INSERT INTO inventario_tesi
SELECT * FROM inventario WHERE COALESCE(tipo_catalogo, 'libri') = 'tesi';

INSERT INTO inventario_cataloghi
SELECT * FROM inventario WHERE COALESCE(tipo_catalogo, 'libri') = 'cataloghi';

INSERT INTO inventario_riviste
SELECT * FROM inventario WHERE COALESCE(tipo_catalogo, 'libri') = 'riviste';

CREATE OR REPLACE FUNCTION sync_inventario_catalog_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  tipo text;
  rec inventario%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM inventario_libri WHERE id = OLD.id;
    DELETE FROM inventario_tesi WHERE id = OLD.id;
    DELETE FROM inventario_cataloghi WHERE id = OLD.id;
    DELETE FROM inventario_riviste WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  rec := NEW;
  tipo := COALESCE(NEW.tipo_catalogo, 'libri');

  -- Svuota eventuali copie stale (es. cambio tipo in update)
  DELETE FROM inventario_libri WHERE id = NEW.id;
  DELETE FROM inventario_tesi WHERE id = NEW.id;
  DELETE FROM inventario_cataloghi WHERE id = NEW.id;
  DELETE FROM inventario_riviste WHERE id = NEW.id;

  IF tipo = 'tesi' THEN
    INSERT INTO inventario_tesi SELECT rec.*;
  ELSIF tipo = 'cataloghi' THEN
    INSERT INTO inventario_cataloghi SELECT rec.*;
  ELSIF tipo = 'riviste' THEN
    INSERT INTO inventario_riviste SELECT rec.*;
  ELSE
    INSERT INTO inventario_libri SELECT rec.*;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inventario_catalog_tables ON inventario;

CREATE TRIGGER trg_sync_inventario_catalog_tables
AFTER INSERT OR UPDATE OR DELETE ON inventario
FOR EACH ROW
EXECUTE FUNCTION sync_inventario_catalog_tables();

COMMIT;
