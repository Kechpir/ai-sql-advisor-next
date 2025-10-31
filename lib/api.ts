const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('jwt');
  } catch {
    return null;
  }
}

const json = (body: any) => JSON.stringify(body);

function headers() {
  const jwt = getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt || ANON}`,
    apikey: ANON,
  };
}

// === SCHEMA FETCHING ===
export async function fetchSchema(dbUrl: string, schema = 'public') {
  const r = await fetch(`${BASE}/fetch_schema`, {
    method: 'POST',
    headers: headers(),
    body: json({ db_url: dbUrl, schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// === LOCAL SCHEMA FETCHING ===
export async function fetchLocalSchema(connectionString: string, schema = 'public') {
  const r = await fetch(`${BASE}/fetch_local_schema`, {
    method: 'POST',
    headers: headers(),
    body: json({ connectionString, schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// === SQL GENERATION ===
export async function generateSql(nl: string, schemaJson: any, dialect: string = 'postgres') {
  const r = await fetch(`${BASE}/generate_sql`, {
    method: 'POST',
    headers: headers(),
    body: json({ nl, schema: schemaJson, dialect }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// === SCHEMAS CRUD API ===
const SCHEMAS = `${BASE}/schemas`;

export async function listSchemas() {
  const r = await fetch(SCHEMAS, { method: 'GET', headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function saveSchema(name: string, schema: any) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'save', name, schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getSchema(name: string) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'get', name }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateSchema(name: string, new_schema: any) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'update', name, new_schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function diffSchema(name: string, new_schema: any) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'diff', name, new_schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteSchema(name: string) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'delete', name }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
