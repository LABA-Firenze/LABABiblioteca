ALTER TABLE inventario
ADD COLUMN IF NOT EXISTS tipo_catalogo VARCHAR(20) DEFAULT 'libri';

UPDATE inventario
SET tipo_catalogo = 'libri'
WHERE tipo_catalogo IS NULL OR tipo_catalogo = '';

CREATE INDEX IF NOT EXISTS idx_inventario_tipo_catalogo
ON inventario(tipo_catalogo);
