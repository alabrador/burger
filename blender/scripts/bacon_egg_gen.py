
import bpy, bmesh, math, random
from mathutils import Vector
import bpy, os
exec(open(os.path.join(bpy.path.abspath('//'), 'scripts', 'helpers.py')).read(), globals())  # helpers junto al .blend
def T(name, kind, **kw):
    t=bpy.data.textures.get(name) or bpy.data.textures.new(name, kind)
    t.type=kind; t=bpy.data.textures[name]
    for k,v in kw.items(): setattr(t,k,v)
    return t
def disp(ob, nm, t, s, mid=0.5, vg=None, coords='LOCAL'):
    m=ob.modifiers.new(nm,'DISPLACE'); m.texture=t; m.strength=s; m.mid_level=mid; m.texture_coords=coords
    if vg: m.vertex_group=vg
    return m
BZ=0.0548
# ================= TOCINO =================
def bacon_strip(name, seed, length=0.125, width=0.027):
    random.seed(seed); ph=[random.random()*6.28 for _ in range(8)]
    me=bpy.data.meshes.new(name); bm=bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=160, y_segments=28, size=0.5, calc_uvs=True)
    UVW=[]
    for v in bm.verts:
        u=v.co.x+0.5; w=v.co.y+0.5           # 0..1
        UVW.append((u,w))
        x=(u-0.5)*length
        # ancho irregular (encoge al freir)
        wid=width*(1+0.08*math.sin(u*9+ph[0])+0.05*math.sin(u*23+ph[1]))
        y=(w-0.5)*wid + 0.004*math.sin(u*4+ph[2])
        # ondas de freido + torsion + bordes ondulados
        z=0.0058*(1+math.sin(x/0.0135+ph[3]))*0.5*(1+0.3*math.sin(u*7+ph[4]))
        z+=0.0026*(w-0.5)*2*math.sin(x/0.022+ph[5])
        z+=0.0007*math.sin(u*60+ph[6])*abs(w-0.5)*2
        # puntas caen por el borde de la carne
        ex=max(0,abs(x)-0.047); z-=ex*ex*18
        v.co=Vector((x,y,z))
    bm.to_mesh(me); bm.free()
    uvl=me.uv_layers.new(name='UVMap')
    for l in me.loops: uvl.data[l.index].uv=UVW[l.vertex_index]
    for p in me.polygons: p.use_smooth=True
    remove_obj(name)
    ob=bpy.data.objects.new(name,me); coll('Hamburguesa').objects.link(ob)
    so=ob.modifiers.new('Grosor','SOLIDIFY'); so.thickness=0.0028; so.offset=1; so.use_even_offset=True
    sd=ob.modifiers.new('Subdiv','SUBSURF'); sd.levels=sd.render_levels=1
    disp(ob,'Rugosidad',T('bc_rug','CLOUDS',noise_scale=0.004,noise_depth=3),0.0006)
    disp(ob,'Arrugas',T('bc_arr','STUCCI',noise_scale=0.0025,turbulence=6),0.00035)
    return ob
b1=bacon_strip('bacon_strips',21); b1.location=(0,0.007,BZ); b1.rotation_euler[2]=0.42
b2=bacon_strip('bacon_strip_2',37); b2.parent=b1; b2.location=(0,-0.016,0.0026); b2.rotation_euler[2]=-0.80
b1['stack_height']=0.0075

def L(nt,a,b): nt.links.new(a,b)
m,nt,bs=new_mat('Tocino'); N=nt.nodes
uv=N.new('ShaderNodeUVMap'); tc=N.new('ShaderNodeTexCoord')
sep=N.new('ShaderNodeSeparateXYZ'); L(nt,uv.outputs['UV'],sep.inputs['Vector'])
nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=6; nz.inputs['Detail'].default_value=4; L(nt,uv.outputs['UV'],nz.inputs['Vector'])
dv=N.new('ShaderNodeMath'); dv.operation='MULTIPLY_ADD'; L(nt,nz.outputs['Fac'],dv.inputs[0]); dv.inputs[1].default_value=0.22; L(nt,sep.outputs['Y'],dv.inputs[2])
dv2=N.new('ShaderNodeMath'); dv2.operation='SUBTRACT'; L(nt,dv.outputs[0],dv2.inputs[0]); dv2.inputs[1].default_value=0.11
# bandas grasa / carne a lo ancho
band=ramp(nt,(0,0),[(0.00,'#d9a062'),(0.14,'#d39457'),(0.20,'#8c3419'),(0.40,'#6a1f0e'),(0.46,'#c98a4c'),(0.53,'#c7864a'),(0.59,'#7f2b14'),(0.84,'#5c1a0b'),(0.90,'#d29455'),(1.0,'#c88848')])
band.color_ramp.interpolation='EASE'
L(nt,dv2.outputs[0],band.inputs['Fac'])
# grasa vs carne mascara
fat=ramp(nt,(0,0),[(0.00,'#ffffff'),(0.15,'#ffffff'),(0.19,'#000000'),(0.42,'#000000'),(0.46,'#ffffff'),(0.54,'#ffffff'),(0.58,'#000000'),(0.85,'#000000'),(0.89,'#ffffff'),(1.0,'#ffffff')])
L(nt,dv2.outputs[0],fat.inputs['Fac'])
# tostado: bordes y crestas
geo=N.new('ShaderNodeNewGeometry')
pt=N.new('ShaderNodeMapRange'); pt.inputs['From Min'].default_value=0.5; pt.inputs['From Max'].default_value=0.56; L(nt,geo.outputs['Pointiness'],pt.inputs['Value'])
ed=N.new('ShaderNodeMath'); ed.operation='ABSOLUTE'
e0=N.new('ShaderNodeMath'); e0.operation='SUBTRACT'; L(nt,sep.outputs['Y'],e0.inputs[0]); e0.inputs[1].default_value=0.5; L(nt,e0.outputs[0],ed.inputs[0])
edm=N.new('ShaderNodeMapRange'); edm.inputs['From Min'].default_value=0.38; edm.inputs['From Max'].default_value=0.5; L(nt,ed.outputs[0],edm.inputs['Value'])
n2=N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value=90; n2.inputs['Detail'].default_value=6; L(nt,tc.outputs['Object'],n2.inputs['Vector'])
brn=N.new('ShaderNodeMath'); brn.operation='MAXIMUM'; L(nt,pt.outputs['Result'],brn.inputs[0]); L(nt,edm.outputs['Result'],brn.inputs[1])
brn2=N.new('ShaderNodeMath'); brn2.operation='MULTIPLY_ADD'; L(nt,n2.outputs['Fac'],brn2.inputs[0]); brn2.inputs[1].default_value=0.6; L(nt,brn.outputs[0],brn2.inputs[2])
brn3=N.new('ShaderNodeMapRange'); brn3.inputs['From Min'].default_value=0.45; brn3.inputs['From Max'].default_value=1.2; brn3.inputs['To Max'].default_value=0.85; L(nt,brn2.outputs[0],brn3.inputs['Value'])
mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; L(nt,brn3.outputs['Result'],mx.inputs['Factor']); L(nt,band.outputs['Color'],mx.inputs[6]); mx.inputs[7].default_value=hexc('#7a3a14')
L(nt,mx.outputs[2],bs.inputs['Base Color'])
rr=N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value=0.55; rr.inputs['To Max'].default_value=0.28; L(nt,fat.outputs['Color'],rr.inputs['Value']); L(nt,rr.outputs['Result'],bs.inputs['Roughness'])
bs.inputs['Coat Weight'].default_value=0.35; bs.inputs['Coat Roughness'].default_value=0.2
bs.inputs['Subsurface Weight'].default_value=0.15; bs.inputs['Subsurface Radius'].default_value=(1,0.6,0.3); bs.inputs['Subsurface Scale'].default_value=0.002
# relieve: fibras de carne a lo largo
fm=N.new('ShaderNodeMapping'); fm.inputs['Scale'].default_value=(30,400,1); L(nt,uv.outputs['UV'],fm.inputs['Vector'])
fb=N.new('ShaderNodeTexNoise'); fb.inputs['Scale'].default_value=1; fb.inputs['Detail'].default_value=6; L(nt,fm.outputs['Vector'],fb.inputs['Vector'])
bp=N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.45; bp.inputs['Distance'].default_value=0.0006; L(nt,fb.outputs['Fac'],bp.inputs['Height']); L(nt,bp.outputs['Normal'],bs.inputs['Normal'])
for o in (b1,b2): o.data.materials.clear(); o.data.materials.append(m)

# ================= HUEVO FRITO =================
EZ=BZ+0.0062
random.seed(5); eph=[random.random()*6.28 for _ in range(6)]
def eout(th):
    return 0.054*(1+0.07*math.sin(2*th+eph[0])+0.055*math.sin(3*th+eph[1])+0.03*math.sin(7*th+eph[2])+0.015*math.sin(13*th+eph[3])+0.008*math.sin(23*th+eph[4]))
prof=[(0,0.0046),(0.30,0.0045),(0.70,0.0036),(0.90,0.0024),(0.97,0.0014),(1.0,0.0006),(0.97,0.0),(0.6,0.0),(0,0.0)]
me=spin_profile('egg_fried', resample(prof,40), 200)
ev=me.attributes.new('borde','FLOAT','POINT')
for i,v in enumerate(me.vertices):
    x,y,z=v.co; r=math.hypot(x,y); th=math.atan2(y,x); R=eout(th)
    v.co=Vector((r*R*math.cos(th), r*R*math.sin(th), z))
    ev.data[i].value=max(0,min(1,(r-0.72)/0.28))
remove_obj('egg_fried')
eg=bpy.data.objects.new('egg_fried',me); coll('Hamburguesa').objects.link(eg); eg.location=(0,0,EZ)
vg=eg.vertex_groups.new(name='borde')
for i,v in enumerate(me.vertices): vg.add([i], ev.data[i].value**1.5, 'REPLACE')
sd=eg.modifiers.new('Subdiv','SUBSURF'); sd.levels=sd.render_levels=1
disp(eg,'Ondas',T('eg_ond','CLOUDS',noise_scale=0.012,noise_depth=2),0.0012)
disp(eg,'Encaje',T('eg_enc','VORONOI',noise_scale=0.0025,distance_metric='DISTANCE',noise_intensity=1.0),0.0016,mid=0.55,vg='borde')
disp(eg,'Burbujas',T('eg_bur','VORONOI',noise_scale=0.004,distance_metric='DISTANCE',noise_intensity=1.0),0.00025,mid=0.5)
eg['stack_height']=0.006
# yema
remove_obj('egg_yolk')
ym=bpy.data.meshes.new('egg_yolk'); bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=64,v_segments=32,radius=0.021); bm.to_mesh(ym); bm.free()
for p in ym.polygons: p.use_smooth=True
yk=bpy.data.objects.new('egg_yolk',ym); coll('Hamburguesa').objects.link(yk); yk.parent=eg
yk.location=(0.007,-0.006,0.0006); yk.scale=(1.0,0.96,0.6)
disp(yk,'Irreg',T('eg_yk','CLOUDS',noise_scale=0.02,noise_depth=1),0.0008)
# material clara
m,nt,bs=new_mat('Huevo_Clara'); N=nt.nodes
at=N.new('ShaderNodeAttribute'); at.attribute_name='borde'
tc=N.new('ShaderNodeTexCoord')
n1=N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value=55; n1.inputs['Detail'].default_value=6; L(nt,tc.outputs['Object'],n1.inputs['Vector'])
e1=N.new('ShaderNodeMath'); e1.operation='MULTIPLY_ADD'; L(nt,n1.outputs['Fac'],e1.inputs[0]); e1.inputs[1].default_value=0.7; L(nt,at.outputs['Fac'],e1.inputs[2])
er=ramp(nt,(0,0),[(0.55,'#f1ede4'),(0.95,'#f1e3c6'),(1.15,'#c88d4a'),(1.4,'#8a5426')])
e2=N.new('ShaderNodeMath'); e2.operation='MULTIPLY'; e2.inputs[1].default_value=0.95; L(nt,e1.outputs[0],e2.inputs[0]); L(nt,e2.outputs[0],er.inputs['Fac'])
L(nt,er.outputs['Color'],bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value=0.3; bs.inputs['Coat Weight'].default_value=0.3; bs.inputs['Coat Roughness'].default_value=0.12
bs.inputs['Subsurface Weight'].default_value=0.35; bs.inputs['Subsurface Radius'].default_value=(1,0.95,0.85); bs.inputs['Subsurface Scale'].default_value=0.004
bb=N.new('ShaderNodeTexVoronoi'); bb.inputs['Scale'].default_value=260; L(nt,tc.outputs['Object'],bb.inputs['Vector'])
bp=N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.25; bp.inputs['Distance'].default_value=0.0004; L(nt,bb.outputs['Distance'],bp.inputs['Height']); L(nt,bp.outputs['Normal'],bs.inputs['Normal'])
eg.data.materials.clear(); eg.data.materials.append(m)
# material yema
m,nt,bs=new_mat('Huevo_Yema'); N=nt.nodes
tc=N.new('ShaderNodeTexCoord'); n1=N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value=30; L(nt,tc.outputs['Object'],n1.inputs['Vector'])
yr=ramp(nt,(0,0),[(0.3,'#e07400'),(0.55,'#f08c00'),(0.75,'#ffa514')]); L(nt,n1.outputs['Fac'],yr.inputs['Fac']); L(nt,yr.outputs['Color'],bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value=0.12; bs.inputs['Coat Weight'].default_value=1.0; bs.inputs['Coat Roughness'].default_value=0.04
bs.inputs['Subsurface Weight'].default_value=0.2; bs.inputs['Subsurface Radius'].default_value=(1,0.5,0.08); bs.inputs['Subsurface Scale'].default_value=0.005
yk.data.materials.clear(); yk.data.materials.append(m)

# ---- v2: alturas y yema con base plana ----
import bpy
O=bpy.data.objects
O['bacon_strips']['stack_height']=0.0100
EZ=0.0548+0.0105
O['egg_fried'].location.z=EZ
yk=O['egg_yolk']
for v in yk.data.vertices:
    if v.co.z<-0.006: v.co.z=-0.006
yk.scale=(1.0,0.96,0.5); yk.location.z=0.0035

# ---- v3: tocino mas ondulado y bandas visibles, borde dorado del huevo ----
import bpy
N=bpy.data.materials['Tocino'].node_tree.nodes
for n in N:
    if n.type=='MAP_RANGE' and abs(n.inputs['To Max'].default_value-0.85)<1e-3:
        n.inputs['To Max'].default_value=0.45; n.inputs['From Min'].default_value=0.7
    if n.type=='MAP_RANGE' and abs(n.inputs['From Min'].default_value-0.5)<1e-3 and abs(n.inputs['From Max'].default_value-0.56)<1e-3:
        n.inputs['From Min'].default_value=0.53; n.inputs['From Max'].default_value=0.6
N=bpy.data.materials['Huevo_Clara'].node_tree.nodes
r=[n for n in N if n.type=='VALTORGB'][0].color_ramp.elements
for e,(p,c) in zip(r,[(0.42,'#f1ede4'),(0.62,'#eedfc2'),(0.78,'#d29a55'),(0.93,'#8f5527')]): e.position=p; e.color=hexc(c)
bpy.data.objects['egg_fried'].modifiers['Ondas'].strength=0.002

# ---- v4: yema mas intensa, tocino mas dorado ----
import bpy
N=bpy.data.materials['Huevo_Yema'].node_tree.nodes
b=[n for n in N if n.type=='BSDF_PRINCIPLED'][0]; b.inputs['Subsurface Weight'].default_value=0.08
r=[n for n in N if n.type=='VALTORGB'][0].color_ramp.elements
for e,(p,c) in zip(r,[(0.3,'#d96500'),(0.55,'#ea7d00'),(0.75,'#f99a0a')]): e.position=p; e.color=hexc(c)
N=bpy.data.materials['Tocino'].node_tree.nodes
band=[n for n in N if n.type=='VALTORGB'][0].color_ramp.elements
cols=['#c98a4c','#c28047','#7c2a12','#5e1a0b','#b8743c','#b6723a','#712411','#521609','#c0803f','#b87a3e']
for e,c in zip(band,cols): e.color=hexc(c)

# ---- v5: clara y yema con 2 ranuras de material (para unir al hornear)
for n,i in (('egg_fried',0),('egg_yolk',1)):
    me=bpy.data.objects[n].data; me.materials.clear(); me.materials.append(bpy.data.materials['Huevo_Clara']); me.materials.append(bpy.data.materials['Huevo_Yema'])
    for p in me.polygons: p.material_index=i
