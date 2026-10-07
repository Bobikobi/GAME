"""Effort weights and the rarity budget (review sections 7.1 and 8).

Two owner decisions change what the shop pays for, and both must keep the
bounded-gold result (Theorem 3):

  effort weight   an activity of effort tier w in [w_min, 1] is valued at w * t
  rarity bonus    a capacity-limited source may add b "bonus seconds" to its value,
                  and the whole world may hand out at most BETA bonus seconds per second

Valuation uses the adjusted time w*t + b. Income is always measured on the REAL
activities (real seconds, real capacity), against the adjusted value table.

Run:  python3 -B toy_effort_rarity.py
"""
from fractions import Fraction as F

from toy_econ import Act, base_content, cons, fixed_point_lp, income

EASY, MID, CRAFT, HARD = F(2, 5), F(3, 5), F(4, 5), F(1)
WEIGHT = {
    "gather_berry": EASY, "pickup_stone": EASY, "forage_seed": EASY, "scavenge_ore": EASY,
    "plant": MID, "harvest": MID, "thresh": MID, "fish": MID,
    "bake_pie": CRAFT, "fillet": CRAFT, "craft_pick": CRAFT,
    "mine_vein": HARD, "dig_ruin": HARD, "gather_crystal": HARD,
}
K = F(1, 2)
PLOTS = 50
BETA = F(1, 10)          # rarity budget: bonus seconds per second, whole world
P = 3                    # rate clamp at the top level


def value_table(acts, bonus=None):
    """V from the adjusted times w*t + b (hardened valuation: active time, split joint outputs)."""
    bonus = bonus or {}
    adj = [Act(a.id, a.t * WEIGHT[a.id] + bonus.get(a.id, 0), a.ins, a.outs, a.wait, a.respawn, a.shares)
           for a in acts]
    return fixed_point_lp(cons(adj, "hard"))


def rate(acts, V, ids=None, mod=None, nodes=None):
    """Value earned per real active second (gold per second divided by k*r)."""
    sub = [a for a in acts if ids is None or a.id in ids]
    g, _ = income(sub, V, K, mod=mod, nodes=nodes, plots=PLOTS)
    return g / K


def capacity(acts, nodes):
    return {a.id: F(nodes.get(a.id, 1)) / a.respawn for a in acts if a.respawn > 0}


def budget_used(acts, bonus, nodes):
    """Bonus seconds per second the world can hand out; None when a bonus sits on an uncapped source."""
    cap = capacity(acts, nodes)
    if any(b and a not in cap for a, b in bonus.items()):
        return None
    return sum(cap[a] * b for a, b in bonus.items())


def f(x):
    return "%.3f" % float(x)


if __name__ == "__main__":
    acts = base_content()
    nodes = {"gather_berry": 10, "gather_crystal": 20}

    print("E6  effort weights only (easy 0.4, mid 0.6, craft 0.8, hard 1.0)")
    V = value_table(acts)
    beginner = {"gather_berry", "pickup_stone", "forage_seed", "scavenge_ore"}
    farmer = beginner | {"plant", "harvest", "thresh", "fish", "bake_pie", "fillet"}
    fast = {a.id: (F(P), F(1)) for a in acts}
    r_beg = rate(acts, V, beginner, nodes=nodes)
    r_all = rate(acts, V, None, nodes=nodes)
    r_top = rate(acts, V, None, mod=fast, nodes=nodes)
    print("  beginner, easy gathering only      x" + f(r_beg))
    print("  farmer and cook                    x" + f(rate(acts, V, farmer, nodes=nodes)))
    print("  everything unlocked                x" + f(r_all))
    print("  everything unlocked, build at P=%d  x%s   gap to beginner %s" % (P, f(r_top), f(r_top / r_beg)))

    print("E7  rarity bonus on the crystal, budget BETA = %s bonus seconds per second" % f(BETA))
    for n in (1, 5, 20):
        nd = dict(nodes, gather_crystal=n)
        b = BETA / capacity(acts, nd)["gather_crystal"]          # the largest bonus the budget allows
        bonus = {"gather_crystal": b}
        Vb = value_table(acts, bonus)
        used = budget_used(acts, bonus, nd)
        r1 = rate(acts, Vb, None, nodes=nd)
        r3 = rate(acts, Vb, None, mod=fast, nodes=nd)
        rich = dict(fast, gather_crystal=(F(1), F(P)))            # yield bonus on the rare source itself
        r3y = rate(acts, Vb, None, mod=rich, nodes=nd)
        assert r1 <= 1 + BETA and r3 <= P * (1 + BETA) and r3y <= P * (1 + BETA)
        print("  %2d nodes: bonus %4s s, crystal worth %7s (was %s), budget used %s"
              % (n, f(b), f(Vb["crystal"]), f(V["crystal"]), f(used)))
        print("            no build x%s (bound %s)   P=%d x%s   P=%d with crystal yield x%s (bound %s)"
              % (f(r1), f(1 + BETA), P, f(r3), P, f(r3y), f(P * (1 + BETA))))

    print("E8  what the budget check must refuse")
    bonus = {"fish": F(18)}                                        # a source with no capacity limit
    Vx = value_table(acts, bonus)
    assert budget_used(acts, bonus, nodes) is None
    print("  bonus on a source with no capacity limit (fish): no budget can cover it (REFUSE), income x%s"
          % f(rate(acts, Vx, None, nodes=nodes)))
    bonus = {"gather_crystal": F(18)}                              # fits 20 nodes exactly
    Vb = value_table(acts, bonus)
    for n in (20, 40, 200):                                        # a later extension adds nodes
        nd = dict(nodes, gather_crystal=n)
        used = budget_used(acts, bonus, nd)
        print("  same bonus, %3d nodes after a merge: budget used %s (%s), income x%s"
              % (n, f(used), "ok" if used <= BETA else "REFUSE", f(rate(acts, Vb, None, nodes=nd))))
