const $ = (s) => $d.querySelector(s),
  $d = document;
const KEY = "tt.v1",
  COL = [
    "#6366f1",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
    "#ef4444",
    "#8b5cf6",
    "#64748b",
  ];
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
let S = { projects: [], entries: [], run: null, cfg: {} };
try {
  S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}"));
} catch (e) {}
S.cfg = Object.assign({ theme: "auto", cur: "₹", last: "" }, S.cfg);
if (!S.projects.length && !S.entries.length) {
  S.projects.push({
    id: uid(),
    name: "General",
    client: "",
    color: COL[0],
    rate: 0,
  });

  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.warn("Could not initialize Time Tracker storage:", e);
  }
}
let tab = "timer",
  mode = "week",
  off = 0,
  ed = null,
  pe = null,
  pc = COL[0],
  tt,
  undoSnap;
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
};
const snap = () => JSON.stringify({ p: S.projects, e: S.entries });
const p2 = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const dayOf = (ts) => ymd(new Date(ts)),
  dt = (s) => new Date(s + "T00:00:00");
const tm = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const hhmm = (ts) => {
  const d = new Date(ts);
  return p2(d.getHours()) + ":" + p2(d.getMinutes());
};
const fd = (d) =>
  d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const col = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#64748b");
function hm(ms) {
  if (ms > 0 && ms < 60000) return Math.round(ms / 1000) + "s";
  const m = Math.round(ms / 60000);
  return Math.floor(m / 60) + "h " + p2(m % 60) + "m";
}
function clk(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return (
    p2(Math.floor(s / 3600)) +
    ":" +
    p2(Math.floor((s % 3600) / 60)) +
    ":" +
    p2(s % 60)
  );
}
const money = (n) =>
  S.cfg.cur +
  (Math.round(n * 100) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
const proj = (id) =>
  S.projects.find((p) => p.id === id) || {
    name: "(deleted project)",
    client: "",
    color: "#94a3b8",
    rate: 0,
  };
const dur = (e) => e.end - e.start,
  sum = (l) => l.reduce((a, e) => a + dur(e), 0);
const amt = (e) =>
  e.bill === false ? 0 : (dur(e) / 36e5) * (+proj(e.pid).rate || 0);
function monday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function fmtDay(d) {
  const t = ymd(new Date());
  if (d === t) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d === ymd(y)) return "Yesterday";
  return dt(d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
function toast(msg, sn) {
  $("#tm").textContent = msg;
  undoSnap = sn;
  $("#undo").hidden = !sn;
  $("#toast").classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
$("#undo").onclick = () => {
  if (undoSnap) {
    const d = JSON.parse(undoSnap);
    S.projects = d.p;
    S.entries = d.e;
    save();
    render();
  }
  $("#toast").classList.remove("show");
};
function row(e, i) {
  const p = proj(e.pid),
    li = $d.createElement("li"),
    a = amt(e);
  li.style.setProperty("--i", Math.min(i, 8));
  li.innerHTML = `<i class="dot" style="background:${col(p.color)}"></i><div class="b"><div class="t">${esc(e.note || p.name)}</div><div class="m">${esc(p.name)} · ${tm(e.start)}–${tm(e.end)}${e.bill === false ? " · non-billable" : ""}</div></div><div class="r"><b>${hm(dur(e))}</b>${a ? `<small>${money(a)}</small>` : ""}</div>`;
  li.onclick = () => editE(e.id);
  return li;
}
function stats() {
  const n = Date.now(),
    t0 = ymd(new Date()),
    run = S.run ? n - S.run.start : 0,
    w0 = +monday(new Date());
  const td = S.entries.filter((e) => dayOf(e.start) === t0),
    wk = S.entries.filter((e) => e.start >= w0);
  $("#sT").textContent = hm(sum(td) + run);
  $("#sW").textContent = hm(sum(wk) + run);
  $("#sE").textContent = money(
    td.reduce((a, e) => a + amt(e), 0) +
      (S.run ? (run / 36e5) * (+proj(S.run.pid).rate || 0) : 0),
  );
}
function tick() {
  const n = Date.now();
  $("#clock").textContent = clk(S.run ? n - S.run.start : 0);
  document.title = S.run
    ? clk(n - S.run.start) + " · Time Tracker"
    : "Time Tracker";
  if (S.run) stats();
}
function rTimer() {
  const sel = $("#tp"),
    cur = S.run ? S.run.pid : sel.value || S.cfg.last;
  sel.innerHTML = S.projects
    .filter((p) => !p.arch || (S.run && p.id === S.run.pid))
    .map(
      (p) =>
        `<option value="${p.id}">${esc(p.name)}${p.client ? " · " + esc(p.client) : ""}</option>`,
    )
    .join("");
  sel.value = cur;
  if (!sel.value && sel.options.length) sel.selectedIndex = 0;
  sel.disabled = !!S.run;
  $("#hero").classList.toggle("run", !!S.run);
  $("#go").textContent = S.run ? "■ Stop" : "▶ Start";
  $("#dc").hidden = !S.run;
  $("#rs").textContent = S.run
    ? "Tracking " + proj(S.run.pid).name + " since " + tm(S.run.start)
    : "Ready to track";
  if (S.run) $("#tn").value = S.run.note || "";
  const ul = $("#today");
  ul.innerHTML = "";
  const t0 = ymd(new Date());
  const es = S.entries
    .filter((e) => dayOf(e.start) === t0)
    .sort((a, b) => b.start - a.start);
  es.forEach((e, i) => ul.append(row(e, i)));
  $("#te").hidden = es.length > 0;
}
function rLog() {
  const box = $("#log");
  box.innerHTML = "";
  const g = {};
  [...S.entries]
    .sort((a, b) => b.start - a.start)
    .forEach((e) => (g[dayOf(e.start)] = g[dayOf(e.start)] || []).push(e));
  const days = Object.keys(g).sort().reverse();
  $("#le").hidden = days.length > 0;
  days.forEach((d) => {
    const h = $d.createElement("div");
    h.className = "gh";
    h.innerHTML = `<span>${fmtDay(d)}</span><b>${hm(sum(g[d]))}</b>`;
    box.append(h);
    const ul = $d.createElement("ul");
    ul.className = "list";
    g[d].forEach((e, i) => ul.append(row(e, i)));
    box.append(ul);
  });
}
function period() {
  const n = new Date();
  let a, b;
  if (mode === "week") {
    a = monday(n);
    a.setDate(a.getDate() + off * 7);
    b = new Date(a);
    b.setDate(b.getDate() + 7);
  } else {
    a = new Date(n.getFullYear(), n.getMonth() + off, 1);
    b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
  }
  return [a, b];
}
function rRep() {
  $d.querySelectorAll("#rm button").forEach((b) =>
    b.classList.toggle("on", b.dataset.m === mode),
  );
  const [a, b] = period(),
    es = S.entries.filter((e) => e.start >= a && e.start < b),
    tot = sum(es),
    t0 = ymd(new Date());
  $("#rLab").textContent =
    mode === "week"
      ? fd(a) + " – " + fd(new Date(b - 864e5))
      : a.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  $("#rNext").disabled = off >= 0;
  $("#rH").textContent = hm(tot);
  $("#rM").textContent = money(es.reduce((s, e) => s + amt(e), 0));
  $("#rN").textContent = es.length;
  const days = [],
    by = {};
  for (let d = new Date(a); d < b; d.setDate(d.getDate() + 1))
    days.push(ymd(d));
  es.forEach((e) => (by[dayOf(e.start)] = (by[dayOf(e.start)] || 0) + dur(e)));
  const mx = Math.max(1, ...days.map((d) => by[d] || 0));
  $("#chart").innerHTML = days
    .map((d, i) => {
      const v = by[d] || 0;
      const lab =
        mode === "week"
          ? dt(d).toLocaleDateString(undefined, { weekday: "short" })
          : i % 5 === 0
            ? +d.slice(8)
            : "";
      return `<div class="c${d === t0 ? " now" : ""}"><em>${mode === "week" && v ? (v / 36e5).toFixed(1) : ""}</em><div class="bw"><div class="bar" style="height:${(v / mx) * 100}%;--i:${i}"></div></div><small>${lab}</small></div>`;
    })
    .join("");
  const pj = {};
  es.forEach((e) => {
    const o = (pj[e.pid] = pj[e.pid] || { ms: 0, a: 0 });
    o.ms += dur(e);
    o.a += amt(e);
  });
  const rows = Object.entries(pj).sort((x, y) => y[1].ms - x[1].ms);
  $("#bd").innerHTML = rows.length
    ? rows
        .map(([id, o]) => {
          const p = proj(id);
          return `<div class="br"><div class="bt"><i class="dot" style="background:${col(p.color)}"></i><span>${esc(p.name)}${p.client ? `<small> · ${esc(p.client)}</small>` : ""}</span><b>${hm(o.ms)}</b>${o.a ? `<small>${money(o.a)}</small>` : ""}</div><div class="pb"><div style="width:${(o.ms / tot) * 100}%;background:${col(p.color)}"></div></div></div>`;
        })
        .join("")
    : '<p class="empty">No time tracked in this period.</p>';
}
function rProj() {
  const tot = {};
  S.entries.forEach((e) => (tot[e.pid] = (tot[e.pid] || 0) + dur(e)));
  const ul = $("#pl");
  ul.innerHTML = "";
  [...S.projects]
    .sort((a, b) => !!a.arch - !!b.arch || a.name.localeCompare(b.name))
    .forEach((p, i) => {
      const li = $d.createElement("li");
      li.className = p.arch ? "arch" : "";
      li.style.setProperty("--i", Math.min(i, 8));
      li.innerHTML = `<i class="dot" style="background:${col(p.color)}"></i><div class="b"><div class="t">${esc(p.name)}</div><div class="m">${esc(p.client || "No client")} · ${+p.rate ? money(+p.rate) + "/hr" : "No rate"}${p.arch ? " · archived" : ""}</div></div><div class="r"><b>${hm(tot[p.id] || 0)}</b></div>`;
      li.onclick = () => editP(p.id);
      ul.append(li);
    });
}
function rSet() {
  $("#thSel").value = S.cfg.theme;
  $("#cur").value = S.cfg.cur;
}
const R = { timer: rTimer, log: rLog, rep: rRep, proj: rProj, set: rSet };
function render() {
  const N = {
    timer: "Timer",
    log: "Time log",
    rep: "Reports",
    proj: "Projects",
    set: "Settings",
  };
  $("#ttl").textContent = N[tab];
  $("#dt").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  $d.querySelectorAll("main>section").forEach(
    (s) => (s.hidden = s.id !== "t-" + tab),
  );
  $d.querySelectorAll("#nav button").forEach((b) =>
    b.classList.toggle("on", b.dataset.t === tab),
  );
  R[tab]();
  stats();
  tick();
}
function setTab(t) {
  tab = t;
  off = 0;
  render();
  const s = $("#t-" + t);
  s.style.animation = "none";
  void s.offsetWidth;
  s.style.animation = "";
  scrollTo({ top: 0 });
}
$d.querySelectorAll("#nav button").forEach(
  (b) => (b.onclick = () => setTab(b.dataset.t)),
);
// Timer controls
$("#go").onclick = () => {
  if (S.run) {
    const e = {
      id: uid(),
      pid: S.run.pid,
      start: S.run.start,
      end: Date.now(),
      note: $("#tn").value.trim(),
      bill: true,
    };
    S.run = null;
    $("#tn").value = "";
    if (e.end - e.start >= 1000) {
      S.entries.push(e);
      toast("Saved " + hm(dur(e)) + " ✔");
    }
  } else {
    if (!S.projects.some((p) => !p.arch) || !$("#tp").value) {
      toast("Create a project first");
      setTab("proj");
      return;
    }
    S.run = {
      pid: $("#tp").value,
      start: Date.now(),
      note: $("#tn").value.trim(),
    };
    S.cfg.last = S.run.pid;
  }
  save();
  render();
};
$("#dc").onclick = () => {
  if (confirm("Discard this running timer without saving?")) {
    S.run = null;
    $("#tn").value = "";
    save();
    render();
  }
};
$("#tn").oninput = () => {
  if (S.run) {
    S.run.note = $("#tn").value;
    save();
  }
};
$("#tp").onchange = () => {
  S.cfg.last = $("#tp").value;
  save();
};
// Reports
$d.querySelectorAll("#rm button").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.m;
      off = 0;
      render();
    }),
);
$("#rPrev").onclick = () => {
  off--;
  render();
};
$("#rNext").onclick = () => {
  off++;
  render();
};
// Entry editor
function editE(id) {
  if (!S.projects.length) return toast("Create a project first");
  const e = id
    ? S.entries.find((x) => x.id === id)
    : {
        id: "",
        pid: S.cfg.last || S.projects.find((p) => !p.arch).id,
        start: Date.now() - 36e5,
        end: Date.now(),
        note: "",
        bill: true,
      };
  if (!e) return;
  ed = e;
  $("#ePrj").innerHTML = S.projects
    .filter((p) => !p.arch || p.id === e.pid)
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join("");
  $("#ePrj").value = e.pid;
  $("#eDate").value = dayOf(e.start);
  $("#eStart").value = hhmm(e.start);
  $("#eEnd").value = hhmm(e.end);
  $("#eNote").value = e.note || "";
  $("#eBill").value = e.bill === false ? "0" : "1";
  $("#eErr").textContent = "";
  $("#eDel").hidden = !e.id;
  $("#de").returnValue = "";
  $("#de").showModal();
}
$("#addE").onclick = () => editE("");
$("#fe").addEventListener("submit", (ev) => {
  if (ev.submitter && ev.submitter.value !== "save") return;
  const d = $("#eDate").value;
  if (
    !(
      new Date(d + "T" + $("#eEnd").value) >
      new Date(d + "T" + $("#eStart").value)
    )
  ) {
    ev.preventDefault();
    $("#eErr").textContent = "End time must be after the start time.";
  }
});
$("#de").addEventListener("close", () => {
  const r = $("#de").returnValue,
    e = ed;
  if (!e) return;
  ed = null;
  const sn = snap();
  if (r === "save") {
    const d = $("#eDate").value;
    Object.assign(e, {
      pid: $("#ePrj").value,
      start: +new Date(d + "T" + $("#eStart").value),
      end: +new Date(d + "T" + $("#eEnd").value),
      note: $("#eNote").value.trim(),
      bill: $("#eBill").value === "1",
    });
    if (!e.id) {
      e.id = uid();
      S.entries.push(e);
    }
  } else if (r === "del") S.entries = S.entries.filter((x) => x !== e);
  else return;
  save();
  render();
  toast(
    r === "del" ? "Entry deleted" : "Entry saved ✔",
    r === "del" ? sn : null,
  );
});
// Project editor
function swatches() {
  const b = $("#pColors");
  b.innerHTML = "";
  COL.forEach((c) => {
    const s = $d.createElement("button");
    s.type = "button";
    s.className = "sw" + (c === pc ? " on" : "");
    s.style.background = c;
    s.setAttribute("aria-label", "Color " + c);
    s.onclick = () => {
      pc = c;
      swatches();
    };
    b.append(s);
  });
}
function editP(id) {
  pe = id
    ? S.projects.find((p) => p.id === id)
    : {
        id: "",
        name: "",
        client: "",
        rate: 0,
        color: COL[S.projects.length % COL.length],
      };
  pc = COL.includes(pe.color) ? pe.color : COL[0];
  swatches();
  $("#pName").value = pe.name;
  $("#pClient").value = pe.client || "";
  $("#pRate").value = pe.rate || "";
  $("#pArch").hidden = !pe.id;
  $("#pArch").textContent = pe.arch ? "Unarchive" : "Archive";
  $("#pDel").hidden = !pe.id || S.entries.some((e) => e.pid === pe.id);
  $("#dp").returnValue = "";
  $("#dp").showModal();
}
$("#addP").onclick = () => editP("");
$("#dp").addEventListener("close", () => {
  const r = $("#dp").returnValue,
    p = pe;
  if (!p) return;
  pe = null;
  const sn = snap();
  if (r === "save") {
    Object.assign(p, {
      name: $("#pName").value.trim(),
      client: $("#pClient").value.trim(),
      rate: +$("#pRate").value || 0,
      color: pc,
    });
    if (!p.id) {
      p.id = uid();
      S.projects.push(p);
    }
  } else if (r === "arch") p.arch = !p.arch;
  else if (r === "del") S.projects = S.projects.filter((x) => x !== p);
  else return;
  save();
  render();
  if (r === "del") toast("Project deleted", sn);
});
// Settings
const TH = ["auto", "light", "dark"];
function theme() {
  $d.documentElement.dataset.theme = TH.includes(S.cfg.theme)
    ? S.cfg.theme
    : "auto";
}
$("#thSel").onchange = (e) => {
  S.cfg.theme = e.target.value;
  save();
  theme();
};
$("#cur").oninput = (e) => {
  S.cfg.cur = e.target.value;
  save();
};
function dl(name, text, type) {
  const a = $d.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}
$("#xCsv").onclick = () => {
  const q = (v) => {
    v = String(v);
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const rows = [
    [
      "Date",
      "Project",
      "Client",
      "Start",
      "End",
      "Hours",
      "Billable",
      "Rate",
      "Amount",
      "Note",
    ],
  ];
  [...S.entries]
    .sort((a, b) => a.start - b.start)
    .forEach((e) => {
      const p = proj(e.pid);
      rows.push([
        dayOf(e.start),
        p.name,
        p.client,
        hhmm(e.start),
        hhmm(e.end),
        (dur(e) / 36e5).toFixed(2),
        e.bill === false ? "No" : "Yes",
        +p.rate || 0,
        amt(e).toFixed(2),
        e.note || "",
      ]);
    });
  dl(
    "time-entries-" + ymd(new Date()) + ".csv",
    rows.map((r) => r.map(q).join(",")).join("\n"),
    "text/csv",
  );
};
$("#xBk").onclick = () =>
  dl(
    "time-tracker-backup-" + ymd(new Date()) + ".json",
    JSON.stringify(S, null, 2),
    "application/json",
  );
$("#iBk").onclick = () => $("#file").click();
$("#file").onchange = async (e) => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(d.projects) || !Array.isArray(d.entries)) throw 0;
    if (confirm("Replace all current data with this backup?")) {
      S.projects = d.projects;
      S.entries = d.entries;
      S.run = null;
      S.cfg = Object.assign(S.cfg, d.cfg);
      save();
      theme();
      render();
    }
  } catch (x) {
    alert("This is not a valid backup file.");
  }
  e.target.value = "";
};
$("#clrE").onclick = () => {
  if (!S.entries.length) return toast("No entries to delete");
  if (confirm("Delete ALL time entries? Projects are kept.")) {
    const sn = snap();
    S.entries = [];
    save();
    render();
    toast("All entries deleted", sn);
  }
};
theme();
render();
setInterval(tick, 1000);
// ---- PWA plumbing ----
if ("serviceWorker" in navigator)
  addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
const off$ = $("#offline"),
  setOn = () => (off$.hidden = navigator.onLine);
addEventListener("online", setOn);
addEventListener("offline", setOn);
setOn();
let deferred;
const btn = $("#install");
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  btn.hidden = false;
});
btn.onclick = async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  btn.hidden = true;
};
addEventListener("appinstalled", () => (btn.hidden = true));
