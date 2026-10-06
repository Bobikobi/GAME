#!/usr/bin/env python3
"""Toy model of the game kernel under review: values, income bound, power. Scratch only."""
from fractions import Fraction as F
import random

# ---------- exact LP: max c.x  s.t.  A x <= b, x >= 0, b >= 0 (simplex, Bland's rule) ----------
def simplex(c, A, b):
    m, n = len(A), len(c)
    T = [[F(v) for v in A[i]] + [F(1) if j == i else F(0) for j in range(m)] + [F(b[i])] for i in range(m)]
    z = [-F(v) for v in c] + [F(0)] * (m + 1)
    basis = [n + i for i in range(m)]
    while True:
        e = next((j for j in range(n + m) if z[j] < 0), None)
        if e is None:
            break
        best = None
        for i in range(m):
            if T[i][e] > 0:
                ratio = T[i][-1] / T[i][e]
                if best is None or ratio < best[0] or (ratio == best[0] and basis[i] < basis[best[1]]):
                    best = (ratio, i)
        if best is None:
            return None  # unbounded
        r = best[1]
        piv = T[r][e]
        T[r] = [v / piv for v in T[r]]
        for i in range(m):
            if i != r and T[i][e] != 0:
                f = T[i][e]
                T[i] = [a - f * p for a, p in zip(T[i], T[r])]
        f = z[e]
        z = [a - f * p for a, p in zip(z, T[r])]
        basis[r] = e
    x = [F(0)] * (n + m)
    for i in range(m):
        x[basis[i]] = T[i][-1]
    return z[-1], x[:n]


class Act:
    def __init__(self, id, t, ins=None, outs=None, wait=0, respawn=0, shares=None):
        self.id = id
        self.t = F(t)                     # active seconds (acting + amortized walking)
        self.ins = {k: F(v) for k, v in (ins or {}).items()}
        self.outs = {k: F(v) for k, v in (outs or {}).items()}   # expected quantities
        self.wait = F(wait)               # elapsed, not active (growth); needs a plot
        self.respawn = F(respawn)         # elapsed before the node can be used again
        self.shares = {k: F(v) for k, v in (shares or {}).items()}


def base_content():
    return [
        Act("gather_berry", 6, outs={"berry": 3}, respawn=60),                       # yield above one
        Act("forage_seed", 40, outs={"seed": 1}),
        Act("plant", 2, ins={"seed": 1}, outs={"sprout": 1}, wait=20),               # cycle: seed -> sprout
        Act("harvest", 5, ins={"sprout": 1}, outs={"seed": 3}),                      # ... -> 3 seeds
        Act("thresh", 3, ins={"seed": 2}, outs={"flour": 1}),
        Act("bake_pie", 10, ins={"flour": 1, "berry": 3}, outs={"pie": 1}),
        Act("pickup_stone", 5, outs={"stone": 1}),
        Act("scavenge_ore", 60, outs={"ore": 1}),
        Act("mine_vein", 20, ins={"pick": F(1, 50)}, outs={"ore": 1}),                # tool wear
        Act("craft_pick", 15, ins={"ore": 3, "stone": 2}, outs={"pick": 1}),
        Act("dig_ruin", 30, ins={"pick": F(1, 50)},                                   # probabilistic drop table
            outs={"stone": F(7, 10), "ore": F(1, 4), "gem": F(1, 20)},
            shares={"stone": F(1, 10), "ore": F(3, 10), "gem": F(6, 10)}),
        Act("fish", 12, outs={"fish": 1}),
        Act("fillet", 4, ins={"fish": 1}, outs={"fillet": 1, "bone": 1},              # by-product
            shares={"fillet": F(4, 5), "bone": F(1, 5)}),
        Act("gather_crystal", 10, outs={"crystal": 1}, respawn=3600),                # long respawn
    ]


def cons(acts, mode, count_wait=True, count_respawn=False, mod=None):
    """Single-output constraints (act, out, time, ins, yield).
    naive: every output carries the full cost; time = active (+ wait) (+ respawn)
    hard : active time only; joint outputs split the cost by shares"""
    out = []
    for a in acts:
        sp, ym = (mod or {}).get(a.id, (F(1), F(1)))
        t = a.t / sp
        if mode == "naive":
            ct = t + (a.wait if count_wait else 0) + (a.respawn if count_respawn else 0)
            for o, y in a.outs.items():
                out.append((a.id, o, ct, a.ins, y * ym))
        else:
            n = len(a.outs)
            for o, y in a.outs.items():
                s = a.shares.get(o, F(1, n)) if n > 1 else F(1)
                out.append((a.id, o, s * t, {i: s * q for i, q in a.ins.items()}, y * ym))
    return out


def knuth(cs):
    """Dijkstra/Knuth order: finalize the cheapest item whose rule has all inputs finalized."""
    V = {}
    while True:
        best = None
        for (_, o, t, ins, y) in cs:
            if o in V or not all(i in V for i in ins):
                continue
            cand = (t + sum(q * V[i] for i, q in ins.items())) / y
            if best is None or cand < best[0]:
                best = (cand, o)
        if best is None:
            return V
        V[best[1]] = best[0]


def T(cs, V):
    N = {}
    for (_, o, t, ins, y) in cs:
        if all(i in V for i in ins):
            cand = (t + sum(q * V[i] for i, q in ins.items())) / y
            if o not in N or cand < N[o]:
                N[o] = cand
    return N


def fixed_point_lp(cs):
    """Greatest V with y*V(out) - sum q*V(in) <= t for every rule (max sum V)."""
    items = sorted({c[1] for c in cs} | {i for c in cs for i in c[3]})
    idx = {it: j for j, it in enumerate(items)}
    A, b = [], []
    for (_, o, t, ins, y) in cs:
        row = [F(0)] * len(items)
        row[idx[o]] += y
        for i, q in ins.items():
            row[idx[i]] -= q
        A.append(row)
        b.append(t)
    res = simplex([1] * len(items), A, b)
    return None if res is None else dict(zip(items, res[1]))


def reachable(acts):
    R, changed = set(), True
    while changed:
        changed = False
        for a in acts:
            if all(i in R for i in a.ins) and not set(a.outs) <= R:
                R |= set(a.outs)
                changed = True
    return R


def income(acts, V, k, r=F(1), mod=None, plots=4, nodes=None, can_buy=True):
    """Max gold per second of real time for one player (LP over all mixed strategies).
    Physics: one second of attention per second, plots for waits, node counts for respawn.
    Shop buys from the player at k*r*V and sells to the player at r*V."""
    items = sorted({o for a in acts for o in a.outs} | {i for a in acts for i in a.ins})
    nA, nI = len(acts), len(items)
    idx = {it: j for j, it in enumerate(items)}
    n = nA + 2 * nI
    c = [F(0)] * n
    for it, j in idx.items():
        if it in V:
            c[nA + nI + j] = k * r * V[it]
            c[nA + j] = -r * V[it]
    A, b = [], []
    m = lambda a: (mod or {}).get(a.id, (F(1), F(1)))
    A.append([a.t / m(a)[0] for a in acts] + [F(0)] * (2 * nI)); b.append(F(1))
    for it, j in idx.items():
        row = [a.ins.get(it, F(0)) - a.outs.get(it, F(0)) * m(a)[1] for a in acts] + [F(0)] * (2 * nI)
        row[nA + j] = F(-1) if (can_buy and it in V) else F(0)
        row[nA + nI + j] = F(1)
        A.append(row); b.append(F(0))
    if any(a.wait for a in acts):
        A.append([a.wait for a in acts] + [F(0)] * (2 * nI)); b.append(F(plots))
    for ai, a in enumerate(acts):
        if a.respawn > 0:
            row = [F(0)] * n
            row[ai] = F(1)
            A.append(row); b.append(F((nodes or {}).get(a.id, 1)) / a.respawn)
    res = simplex(c, A, b)
    if res is None:
        return None, None
    plan = {acts[i].id: res[1][i] for i in range(nA) if res[1][i] > 0}
    return res[0], plan


def fl(x, d=3):
    return "inf" if x is None else ("%." + str(d) + "f") % float(x)


def show(V, keys=None):
    return "  ".join("%s=%s" % (k, fl(V[k], 2)) for k in (keys or sorted(V)))


if __name__ == "__main__":
    acts = base_content()
    K = F(1, 2)
    print("== E1 value function: Knuth order vs exact fixed point ==")
    cA = cons(acts, "naive", count_wait=True)
    VA = knuth(cA)
    VB = fixed_point_lp(cA)
    print("A kernel as written, Knuth order :", show(VA))
    print("B same rules, exact fixed point  :", show(VB))
    V = dict(VA)
    trace = []
    for i in range(40):
        V = T(cA, V)
        if i in (0, 1, 2, 5, 10, 20, 39):
            trace.append("%d:%s" % (i + 1, fl(V["seed"], 4)))
    print("   iteration from Knuth values, seed:", " ".join(trace), "-> limit", fl(VB["seed"], 4))
    resid = max(abs(T(cA, VB)[i] - VB[i]) for i in VB)
    print("   residual of B under T:", resid, "| residual of A (Knuth) under T:", fl(max(abs(T(cA, VA)[i] - VA[i]) for i in VA), 2))
    Z = {i: F(0) for i in VB}
    for _ in range(400):
        Z = T(cA, Z)
    print("   iteration from zero reaches the same point (uniqueness):", all(abs(Z[i] - VB[i]) < F(1, 10**6) for i in VB))
    # integer iteration, both rounding directions
    import math
    for name, rnd in (("floor", math.floor), ("ceil", math.ceil)):
        x = 40
        for _ in range(50):
            x = min(40, rnd(F(x + 27, 3)))
        print("   integer iteration seed=min(40,(seed+27)/3) with %s -> %d" % (name, x))
    print("   plank demo (no cycle, yield 4): ", end="")
    pl = [Act("find_plank", 10, outs={"plank": 1}), Act("cut_log", 12, outs={"log": 1}), Act("saw", 2, ins={"log": 1}, outs={"plank": 4})]
    cp = cons(pl, "naive")
    print("Knuth plank=%s exact plank=%s" % (fl(knuth(cp)["plank"], 2), fl(fixed_point_lp(cp)["plank"], 2)))
    no_forage = [a for a in acts if a.id != "forage_seed"]
    print("   without forage_seed: reachable has seed? %s ; equations still give seed=%s" % (
        "seed" in reachable(no_forage), fl(fixed_point_lp(cons(no_forage, "naive"))["seed"], 2)))

    print("\n== E2 income bound under each valuation (multiple of k*r; 1.000 means the claim holds) ==")
    VC = fixed_point_lp(cons(acts, "naive", count_wait=True, count_respawn=True))
    VD = fixed_point_lp(cons(acts, "naive", count_wait=False))
    VH = fixed_point_lp(cons(acts, "hard"))
    print("C exact, respawn counted as waiting:", show(VC, ["berry", "crystal", "seed"]))
    print("D exact, active time only, full cost per output:", show(VD, ["stone", "ore", "gem", "fillet", "bone", "seed"]))
    print("H hardened (active time, split outputs):", show(VH))
    for name, VV in (("A", VA), ("B", VB), ("C", VC), ("D", VD), ("H", VH)):
        row = []
        for nodes in (1, 5, 20):
            g, plan = income(acts, VV, K, plots=4, nodes={"gather_crystal": nodes, "gather_berry": 10})
            row.append("crystal nodes=%d: x%s" % (nodes, fl(g / K, 3)))
        g, plan = income(acts, VV, K, plots=4, nodes={"gather_crystal": 1, "gather_berry": 10})
        print("%s  %s   best plan: %s" % (name, " | ".join(row), ", ".join("%s %s/s" % (a, fl(x, 3)) for a, x in sorted(plan.items()))))
    for kk in (F(1, 2), F(9, 10)):
        only = [a for a in acts if a.id in ("fish", "fillet")]
        g, plan = income(only, VD, kk)
        print("   fish+fillet only, valuation D, k=%s: x%s of k*r  (%s gold/s at r=1)" % (kk, fl(g / kk, 3), fl(g, 3)))
    dual = max((sum(y * VH[o] for o, y in a.outs.items()) - sum(q * VH[i] for i, q in a.ins.items())) / a.t for a in acts)
    print("   H: max over activities of (value out - value in)/active time =", dual)

    print("\n== E3 power: benchmark reading vs real income ratio (hardened values, k=1/2) ==")
    def bench(mod):
        Vb = fixed_point_lp(cons(acts, "hard", mod=mod))
        t = lambda i: next(a for a in acts if a.id == i).t / (mod or {}).get(i, (F(1), F(1)))[0]
        actions = 20 * t("gather_berry") + 5 * t("bake_pie") + 3 * t("dig_ruin")
        outputs = 60 * Vb["berry"] + 5 * Vb["pie"] + 3 * t("dig_ruin")
        return actions, outputs, Vb
    b0a, b0o, _ = bench(None)
    builds = {
        "deep digger: dig time -40%": {"dig_ruin": (F(5, 3), F(1))},
        "angler: fishing time -50%": {"fish": (F(2), F(1))},
        "green thumb: harvest 3->4 seeds": {"harvest": (F(1), F(4, 3))},
        "berry basket: gather yield +50%": {"gather_berry": (F(1), F(3, 2))},
        "digger + miner pair": {"dig_ruin": (F(5, 3), F(1)), "mine_vein": (F(5, 3), F(1))},
    }
    print("benchmark base: %s s by actions, %s s by outputs" % (fl(b0a, 1), fl(b0o, 1)))
    for name, mod in builds.items():
        ba, bo, Vb = bench(mod)
        g, _ = income(acts, VH, K, mod=mod, nodes={"gather_berry": 10})
        ratio = max(VH[i] / Vb[i] for i in VH)
        print("%-34s saved: %5s%% (actions) %5s%% (outputs) | real income x%s | max V/V_build x%s" % (
            name, fl(100 * (b0a - ba) / b0a, 1), fl(100 * (b0o - bo) / b0o, 1), fl(g / K, 3), fl(ratio, 3)))
    print("   thin-margin cycle: harvest gives 1.05 seeds, node adds +5% yield:")
    thin = [Act("forage_seed", 400, outs={"seed": 1}), Act("plant", 2, ins={"seed": 1}, outs={"sprout": 1}),
            Act("harvest", 5, ins={"sprout": 1}, outs={"seed": F(105, 100)})]
    v0 = fixed_point_lp(cons(thin, "hard"))["seed"]
    v1 = fixed_point_lp(cons(thin, "hard", mod={"harvest": (F(1), F(110, 105))}))["seed"]
    print("   seed costs %s s -> %s s for the build: a +4.8%% yield node gives x%s income" % (fl(v0, 1), fl(v1, 1), fl(v0 / v1, 2)))
    print("   input-heavy recipe with a yield bonus (cut gem: 1 gem + 2 s -> 1 cut gem, node +20% output):")
    gem_acts = acts + [Act("cut_gem", 2, ins={"gem": 1}, outs={"cut_gem": 1})]
    Vg = fixed_point_lp(cons(gem_acts, "hard"))
    for kk in (F(1, 2), F(3, 4), F(9, 10)):
        g, plan = income(gem_acts, Vg, kk, mod={"cut_gem": (F(1), F(6, 5))}, nodes={"gather_berry": 10})
        print("     k=%s: income x%s of k*r   plan: %s" % (kk, fl(g / kk, 2), ", ".join(sorted(plan))))

    print("\n== E4 clamp theorem, random builds (cap P = 3/2) ==")
    rnd = random.Random(7)
    P = F(3, 2)
    worst_ok, worst_bad, bad = F(0), F(0), 0
    for trial in range(300):
        mod = {}
        for a in acts:
            sp = F(rnd.choice([10, 11, 12, 13, 14, 15]), 10)
            ym = F(1)
            if not a.ins and rnd.random() < 0.5:           # rate bonus on an input-free activity
                ym = F(rnd.choice([10, 11, 12, 13, 14, 15]), 10)
                sp = min(sp, P / ym)
            mod[a.id] = (sp, ym)
        g, _ = income(acts, VH, K, mod=mod, nodes={"gather_berry": 10, "gather_crystal": 20}, plots=50)
        worst_ok = max(worst_ok, g / K)
    for trial in range(300):
        mod = {a.id: (F(1), F(rnd.choice([10, 12, 15]), 10)) for a in acts if a.ins}   # yield on recipes with inputs
        g, _ = income(acts, VH, K, mod=mod, nodes={"gather_berry": 10, "gather_crystal": 20}, plots=50)
        worst_bad = max(worst_bad, g / K)
        bad += g / K > P
    print("clamped builds (time anywhere, rate only on input-free activities): worst income x%s <= P=%s : %s" % (fl(worst_ok, 4), P, worst_ok <= P))
    print("yield bonuses up to x1.5 on recipes with inputs: worst income x%s ; builds above P: %d of 300" % (fl(worst_bad, 3), bad))

    print("\n== E5 check (a) by small steps ==")
    cur = list(acts)
    v_prev = fixed_point_lp(cons(cur, "hard"))["berry"]
    v_anchor = v_prev
    for step in range(1, 8):
        cur = cur + [Act("bush_%d" % step, F(6) * F(901, 1000) ** step, outs={"berry": 3})]
        v = fixed_point_lp(cons(cur, "hard"))["berry"]
        print("extension %d: berry %s -> %s  step %s%% (limit 10%%: %s) | from anchor %s%% (%s)" % (
            step, fl(v_prev, 3), fl(v, 3), fl(100 * (v_prev - v) / v_prev, 1), "pass" if (v_prev - v) / v_prev <= F(1, 10) else "FAIL",
            fl(100 * (v_anchor - v) / v_anchor, 1), "pass" if (v_anchor - v) / v_anchor <= F(1, 10) else "blocked"))
        v_prev = v
