"""Stop a cape and tabard from being skinned to the legs.

Run:  blender -b -P cape_fix.py -- <rigged.glb> <out.glb>

Cloth vertices are found by the base colour texture (the red of the cape and tabard) and by
height (below the hip joint). Behind the body they are bound to the hips alone; in front they
keep half of their leg weights so the tabard still follows a stride. Prints DIAG lines.
"""
import sys
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]


def diag(*a):
    print("DIAG", *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SRC)
objs = [o for o in bpy.data.objects if o not in before]
arm = [o for o in objs if o.type == "ARMATURE"][0]
meshes = [o for o in objs if o.type == "MESH"]
assert meshes, "no mesh in the file"
diag("mesh objects", [(o.name, len(o.data.vertices)) for o in meshes])
mesh = max(meshes, key=lambda o: len(o.data.vertices))
me = mesh.data

# the base colour image: of the images in the file, the one with the most red pixels
# (the cape and tabard are red; the normal map is blue, the metal-rough map green-blue)
img = None
best = -1
report = []
for cand in bpy.data.images:
    if cand.size[0] < 256 or cand.size[1] < 256:
        continue
    cw, ch = cand.size
    buf = np.empty(cw * ch * 4, dtype=np.float32)
    cand.pixels.foreach_get(buf)
    sample = buf.reshape(ch, cw, 4)[::8, ::8, :3]
    rr, gg, bb = sample[..., 0], sample[..., 1], sample[..., 2]
    redcount = int(((rr > 0.30) & (rr > 1.5 * gg) & (rr > 1.5 * bb)).sum())
    report.append((cand.name, cw, ch, redcount))
    if redcount > best:
        best, img = redcount, cand
diag("images (name, w, h, red samples)", report, "using", img.name if img else None)
assert img is not None, "no base colour image found"
W, H = img.size
px = np.empty(W * H * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)
diag("texture", img.name, W, H)

# one uv per vertex (first loop that touches it)
uv_layer = me.uv_layers.active.data
uv = np.zeros((len(me.vertices), 2), dtype=np.float64)
seen = np.zeros(len(me.vertices), dtype=bool)
for poly in me.polygons:
    for li in poly.loop_indices:
        vi = me.loops[li].vertex_index
        if not seen[vi]:
            uv[vi] = uv_layer[li].uv[:]
            seen[vi] = True
tx = (np.floor(uv[:, 0] * W).astype(int)) % W
ty = (np.floor(uv[:, 1] * H).astype(int)) % H
rgb = px[ty, tx, :3]
r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
red = (r > 0.30) & (r > 1.5 * g) & (r > 1.5 * b)

mw = mesh.matrix_world
co = np.array([v.co[:] for v in me.vertices], dtype=np.float64)
co = co @ np.array(mw.to_3x3()).T + np.array(mw.translation)
hips = [bn for bn in arm.data.bones if bn.name.endswith("Hips")][0]
lo, hi = co.min(axis=0), co.max(axis=0)
height = float(hi[2] - lo[2])
# the hip line from the mesh itself (bone and mesh spaces differ in this export)
hips_z = float(lo[2] + 0.52 * height)
center_y = float(np.median(co[:, 1]))
below = co[:, 2] < hips_z
behind = co[:, 1] > center_y + 0.04 * height
cape = red & below & behind
tabard = red & below & ~behind
diag("mesh bounds z", round(float(lo[2]), 3), round(float(hi[2]), 3), "height", round(height, 3),
     "mesh scale", tuple(round(x, 3) for x in mesh.matrix_world.to_scale()),
     "armature scale", tuple(round(x, 3) for x in arm.matrix_world.to_scale()))
diag("red verts", int(red.sum()), "of", len(red), "cape (behind, below hips)", int(cape.sum()), "tabard (front, below hips)", int(tabard.sum()), "hips z", round(hips_z, 3))

vg_hips = mesh.vertex_groups.get(hips.name) or mesh.vertex_groups.new(name=hips.name)
deform_groups = {g.index for g in mesh.vertex_groups if (arm.data.bones.get(g.name) and arm.data.bones[g.name].use_deform)}
changed = 0
for vi in np.where(cape)[0]:
    v = me.vertices[int(vi)]
    for gr in list(v.groups):
        if gr.group in deform_groups:
            mesh.vertex_groups[gr.group].remove([int(vi)])
    vg_hips.add([int(vi)], 1.0, "REPLACE")
    changed += 1
for vi in np.where(tabard)[0]:
    v = me.vertices[int(vi)]
    tot = sum(gr.weight for gr in v.groups if gr.group in deform_groups) or 1.0
    for gr in list(v.groups):
        if gr.group in deform_groups:
            mesh.vertex_groups[gr.group].add([int(vi)], gr.weight / tot * 0.5, "REPLACE")
    hw = 0.5
    for gr in v.groups:
        if gr.group == vg_hips.index:
            hw = 0.5 + gr.weight
    vg_hips.add([int(vi)], min(hw, 1.0), "REPLACE")
    changed += 1
diag("vertices reweighted", changed)

mode = "NLA_TRACKS" if (arm.animation_data and len(arm.animation_data.nla_tracks)) else "ACTIONS"
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
                          export_animation_mode=mode, export_skins=True, export_image_format="AUTO",
                          export_yup=True, export_apply=False, export_force_sampling=True,
                          export_optimize_animation_size=True)
diag("wrote", OUT, "mode", mode)
