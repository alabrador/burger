import os

import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Quaternion
OUT = os.path.join(os.path.expanduser("~"), "Documents", "burger-3d")

def resample(pts, n):
    segs=[(Vector(pts[i]),Vector(pts[i+1])) for i in range(len(pts)-1)]
    L=[(b-a).length for a,b in segs]; tot=sum(L); outp=[]
    for k in range(n+1):
        d=tot*k/n
        for idx,((a,b),l) in enumerate(zip(segs,L)):
            if d<=l or idx==len(segs)-1:
                t=min(1,d/l) if l>0 else 0; p=a.lerp(b,t); outp.append((p.x,p.y)); break
            d-=l
    return outp

def spin_profile(name, pts, steps=128):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in pts]
    edges = [bm.edges.new((verts[i], verts[i+1])) for i in range(len(verts)-1)]
    bmesh.ops.spin(bm, geom=verts+edges, cent=(0,0,0), axis=(0,0,1), angle=math.tau, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    return me

def node(nt, t, loc, **kw):
    n = nt.nodes.new(t); n.location = loc
    for k,v in kw.items(): setattr(n,k,v)
    return n
def hexc(h, a=1.0):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    lin=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]; return (*lin,a)
def ramp(nt, loc, stops):
    r=node(nt,'ShaderNodeValToRGB',loc); el=r.color_ramp.elements
    while len(el)>len(stops): el.remove(el[-1])
    while len(el)<len(stops): el.new(0.5)
    for e,(p,c) in zip(el,stops): e.position=p; e.color=hexc(c)
    return r
def new_mat(name):
    m=bpy.data.materials.get(name)
    if m: bpy.data.materials.remove(m)
    m=bpy.data.materials.new(name)
    try: m.use_nodes=True
    except Exception: pass
    nt=m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); o=nt.nodes.new('ShaderNodeOutputMaterial'); o.location=(300,0)
    nt.links.new(b.outputs[0],o.inputs['Surface'])
    return m,nt,b
def coll(name):
    sc=bpy.context.scene
    c=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in sc.collection.children: sc.collection.children.link(c)
    return c
def assign_by_normal(ob, mats, rule):
    ob.data.materials.clear()
    for m in mats: ob.data.materials.append(m)
    for p in ob.data.polygons: p.material_index=rule(p.normal)
def remove_obj(name):
    o=bpy.data.objects.get(name)
    if o:
        for ch in list(o.children): bpy.data.objects.remove(ch, do_unlink=True)
        bpy.data.objects.remove(o, do_unlink=True)
