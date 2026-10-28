// Compare deux inventaires produits par inventory.sql (production vs dépôt rejoué).

// Les définitions déparsées varient selon la version de Postgres et le search_path : on ignore le
// préfixe public., les casts superflus et les espaces.
const norm = (v) =>
  v == null
    ? v
    : String(v)
        .replace(/\bpublic\./g, "")
        .replace(/::(text|character varying|app_role|uuid|jsonb|timestamp with time zone)\b/g, "")
        .replace(/\s+/g, " ")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .trim();

const SECTIONS = {
  tables: { key: (x) => x.name, fields: ["rls"] },
  views: { key: (x) => x, fields: [] },
  columns: { key: (x) => `${x.t}.${x.c}`, fields: ["type", "nullable", "default"] },
  policies: {
    key: (x) => `${x.t} · ${x.name}`,
    fields: ["cmd", "roles", "permissive", "qual", "check"],
  },
  constraints: { key: (x) => `${x.t} · ${x.name}`, fields: ["type", "def"] },
  triggers: { key: (x) => `${x.t} · ${x.name}`, fields: ["def"] },
  functions: { key: (x) => `${x.name}(${x.args})`, fields: ["secdef", "md5", "config"] },
  indexes: { key: (x) => `${x.t} · ${x.name}`, fields: ["def"] },
  storage_policies: { key: (x) => `${x.t} · ${x.name}`, fields: ["cmd", "roles", "qual", "check"] },
  buckets: { key: (x) => x.id, fields: ["public", "size", "mime"] },
  enums: { key: (x) => x.type, fields: ["labels"] },
  grants_anon_auth: { key: (x) => `${x.t} · ${x.role} · ${x.priv}`, fields: [] },
  migrations: { key: (x) => x, fields: [] },
  publication: { key: (x) => x, fields: [] },
  cron: { key: (x) => x.name, fields: ["schedule", "cmd"] },
};

// Triggers internes de Supabase sur le stockage : présents en production, jamais dans le dépôt.
const isSupabaseInternal = (section, key) =>
  section === "triggers" && (key.startsWith("storage.") || key.startsWith("auth."));

/** @returns {Record<string, { onlyProd: object[], onlyRepo: object[], changed: object[] }>} */
export function diffInventories(prod, repo) {
  const report = {};
  for (const [section, { key, fields }] of Object.entries(SECTIONS)) {
    const p = new Map((prod[section] ?? []).map((x) => [key(x), x]));
    const r = new Map((repo[section] ?? []).map((x) => [key(x), x]));
    const onlyProd = [...p.keys()]
      .filter((k) => !r.has(k) && !isSupabaseInternal(section, k))
      .map((k) => ({ key: k, prod: p.get(k) }));
    const onlyRepo = [...r.keys()]
      .filter((k) => !p.has(k))
      .map((k) => ({ key: k, repo: r.get(k) }));
    const changed = [];
    for (const [k, pv] of p) {
      const rv = r.get(k);
      if (!rv) continue;
      const diffs = fields.filter(
        (f) => norm(JSON.stringify(pv[f])) !== norm(JSON.stringify(rv[f])),
      );
      if (diffs.length) {
        changed.push({
          key: k,
          fields: Object.fromEntries(diffs.map((f) => [f, { prod: pv[f], repo: rv[f] }])),
        });
      }
    }
    report[section] = { onlyProd, onlyRepo, changed };
  }
  return report;
}
