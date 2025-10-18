import cockpit from "cockpit";
import React, { useEffect, useMemo, useState } from "react";

type Vhost = { name: string; path: string; enabled: boolean };

function run(cmd: string, args: string[] = []) {
  return cockpit
    .spawn(["/usr/local/libexec/cockpit-apache-helper", cmd, ...args], {
      superuser: "try",
      err: "message",
    })
    .then((out) => out);
}

const THEMES = {
  light: {
    "--bg": "#f6f7f9",
    "--panel": "#ffffff",
    "--text": "#0b1220",
    "--muted": "#6b7280",
    "--border": "#e5e7eb",
    "--ok": "#2e7d32",
    "--bad": "#b71c1c",
    "--btn": "#0f172a",
    "--btnText": "#ffffff",
    "--inputBg": "#ffffff",
  },
  dark: {
    "--bg": "#0d1117",
    "--panel": "#161b22",
    "--text": "#e6edf3",
    "--muted": "#9aa4af",
    "--border": "#2d333b",
    "--ok": "#22c55e",
    "--bad": "#ef4444",
    "--btn": "#334155",
    "--btnText": "#e6edf3",
    "--inputBg": "#0f141a",
  },
} as const;

function useTheme() {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [theme, setTheme] = useState<keyof typeof THEMES>(
    prefersDark ? "dark" : "light"
  );

  useEffect(() => {
    const vars = THEMES[theme];
    Object.entries(vars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
  }, [theme]);

  return { theme, setTheme };
}

function useVhosts() {
  const [list, setList] = useState<Vhost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    run("list")
      .then((out) => setList(JSON.parse(out)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);
  return { list, loading, error, refresh };
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const { list, loading, error, refresh } = useVhosts();

  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const [lastTest, setLastTest] = useState<string>("");
  const [lastReload, setLastReload] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.path.toLowerCase().includes(q)
    );
  }, [list, search]);

  const openVhost = (name: string) => {
    setActive(name);
    setMsg("Loading…");
    run("read", [name])
      .then((text) => setContent(text))
      .then(() => setMsg(""))
      .catch((e) => setMsg(String(e)));
  };

  const saveVhost = () => {
    if (!active) return;
    setMsg("Saving…");
    run("write", [active, content])
      .then(() => setMsg("Saved."))
      .catch((e) => setMsg(String(e)));
  };

  const enable = (n: string) => run("enable", [n]).then(refresh);
  const disable = (n: string) => run("disable", [n]).then(refresh);

  const test = () =>
    run("test")
      .then((out) => {
        setMsg(out);
        setLastTest(new Date().toLocaleString());
      })
      .catch((e) => setMsg(String(e)));

  const reload = () =>
    run("reload")
      .then((out) => {
        setMsg(out || "Reloaded");
        setLastReload(new Date().toLocaleString());
      })
      .catch((e) => setMsg(String(e)));

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
        color: "var(--text)",
        background: "var(--bg)",
        minHeight: "100vh"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Apache Manager</h1>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid var(--border)`,
            background: "var(--panel)",
            color: "var(--text)",
            cursor: "pointer",
          }}
          title="Toggle light/dark"
        >
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left Panel */}
        <div
          style={{
            background: "var(--panel)",
            border: `1px solid var(--border)`,
            borderRadius: 12,
            padding: 12,
            overflowY: "auto",
            maxHeight: "80vh",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={test}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid var(--border)`,
                  background: "var(--btn)",
                  color: "var(--btnText)",
                }}
              >
                apache2ctl -t
              </button>
              <button
                onClick={reload}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid var(--border)`,
                  background: "var(--btn)",
                  color: "var(--btnText)",
                }}
              >
                Reload Apache
              </button>
            </div>
            <button
              onClick={refresh}
              title="Refresh list"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid var(--border)`,
                background: "var(--panel)",
                color: "var(--text)",
              }}
            >
              ↻
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 10,
            }}
          >
            {lastTest && <div>Last test: {lastTest}</div>}
            {lastReload && <div>Reloaded: {lastReload}</div>}
          </div>

          <input
            type="search"
            placeholder="Search by name or path…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid var(--border)`,
              background: "var(--inputBg)",
              color: "var(--text)",
              outline: "none",
              marginBottom: 10,
            }}
          />

          {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
          {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              maxHeight: 420,
              overflowY: "auto",
            }}
          >
            {filtered.map((v) => (
              <li
                key={v.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: `1px solid var(--border)`,
                  padding: "8px 10px",
                }}
              >
                <button
                  onClick={() => openVhost(v.name)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateRows: "auto auto",
                  }}
                >
                  <strong>{v.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {v.path}
                  </div>
                </button>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 10,
                      background: v.enabled ? "var(--ok)" : "var(--bad)",
                    }}
                  />
                  <button
                    onClick={() =>
                      v.enabled ? disable(v.name) : enable(v.name)
                    }
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: `1px solid var(--border)`,
                      background: "var(--panel)",
                      color: "var(--text)",
                    }}
                  >
                    {v.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            ))}
            {filtered.length === 0 && !loading && (
              <li style={{ padding: 10, color: "var(--muted)" }}>
                No vhosts match “{search}”.
              </li>
            )}
          </ul>

          {!!msg && (
            <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{msg}</p>
          )}
        </div>

        {/* Right editor with scroll space */}
        <div
          style={{
            background: "var(--panel)",
            border: `1px solid var(--border)`,
            borderRadius: 12,
            padding: 12,
            minHeight: 300
          }}
        >
          {!active && (
            <p style={{ color: "var(--muted)" }}>Select a vhost to view/edit.</p>
          )}
          {active && (
            <>
              <h3>Edit: {active}</h3>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "60vh", // ✅ flexible height
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  background: "var(--inputBg)",
                  color: "var(--text)",
                  border: `1px solid var(--border)`,
                  borderRadius: 8,
                  padding: 10,
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  onClick={saveVhost}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid var(--border)`,
                    background: "var(--btn)",
                    color: "var(--btnText)",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => openVhost(active)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid var(--border)`,
                    background: "var(--panel)",
                    color: "var(--text)",
                  }}
                >
                  Revert
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
