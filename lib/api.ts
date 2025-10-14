const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const json = (body: any) => JSON.stringify(body);
const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ANON}`,
  'apikey': ANON,
});

export async function fetchSchema(dbUrl: string, schema = 'public') {
  const r = await fetch(`${BASE}/fetch_schema`, {
    method: 'POST',
    headers: headers(),
    body: json({ db_url: dbUrl, schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { dialect, schema, countTables, tables{...}, warning? }
}

export async function generateSql(nl: string, schemaJson: any, dialect = 'postgres') {
  const r = await fetch(`${BASE}/generate_sql`, {
    method: 'POST',
    headers: headers(),
    body: json({ nl, schema: schemaJson, dialect }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { sql, usage, blocked?, reason? }
}
