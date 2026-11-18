
import bpy, bmesh, math, random
from mathutils import Vector, noise
import bpy, os
exec(open(os.path.join(bpy.path.abspath('//'), 'scripts', 'helpers.py')).read(), globals())  # helpers junto al .blend
ZB=0.02896
def outline(th, a, b, seed):
    random.seed(seed)
    ph=[random.random()*6.28 for _ in range(4)]
    r=1/math.sqrt((math.cos(th)/a)**2+(math.sin(th)/b)**2)
    r*=1+0.10*math.cos(th)            # forma de gota (pechuga)
    r*=1+0.035*math.sin(3*th+ph[0])+0.022*math.sin(5*th+ph[1])+0.012*math.sin(9*th+ph[2])
    return r
def slab(name, prof, a, b, seed, taper=0.14, steps=192):
    me=spin_profile(name, resample(prof, 44), steps)
    for v in me.vertices:
        x,y,z=v.co; r=math.hypot(x,y); th=math.atan2(y,x)
        R=outline(th,a,b,seed)
        t=1-taper*math.cos(th)*min(1,r)
        v.co=Vector((r*R*math.cos(th)-0.006, r*R*math.sin(th), z*t))
    remove_obj(name)
    ob=bpy.data.objects.new(name, me); coll('Hamburguesa').objects.link(ob)
    ob.location=(0,0,ZB); return ob
def tex(name, kind, **kw):
    t=bpy.data.textures.get(name) or bpy.data.textures.new(name, kind)
    if t.type!=kind: t.type=kind
    t=bpy.data.textures[name]
    for k,v in kw.items(): setattr(t,k,v)
    return t
def disp(ob, nm, t, s, mid=0.5, coords='LOCAL'):
    m=ob.modifiers.new(nm,'DISPLACE'); m.texture=t; m.strength=s; m.mid_level=mid; m.texture_coords=coords; return m

# ---------- POLLO A LA PLANCHA ----------
profG=[(0,0),(0.80,0.0),(0.93,0.0015),(0.995,0.006),(1.0,0.0095),(0.975,0.0135),(0.90,0.0170),(0.70,0.0205),(0.40,0.0228),(0,0.0236)]
g=slab('chicken_grilled', profG, 0.064, 0.051, 7)
sd=g.modifiers.new('Subdiv','SUBSURF'); sd.levels=sd.render_levels=1
disp(g,'Forma',tex('cg_forma','CLOUDS',noise_scale=0.025,noise_depth=2),0.0018)
disp(g,'Fibra',tex('cg_fibra','STUCCI',noise_scale=0.004,turbulence=4),0.00035)
g['stack_height']=0.0225
# ---------- POLLO CRISPY ----------
profC=[(0,0),(0.80,0.0),(0.93,0.0018),(0.995,0.0065),(1.0,0.0110),(0.975,0.0160),(0.90,0.0200),(0.70,0.0235),(0.40,0.0255),(0,0.0262)]
c=slab('chicken_crispy', profC, 0.066, 0.053, 11, taper=0.12)
sd=c.modifiers.new('Subdiv','SUBSURF'); sd.levels=sd.render_levels=2
disp(c,'Forma',tex('cc_forma','CLOUDS',noise_scale=0.022,noise_depth=2),0.0022)
disp(c,'Grumos',tex('cc_grumos','VORONOI',noise_scale=0.0055,distance_metric='DISTANCE',noise_intensity=1.0),0.0026,mid=0.35)
disp(c,'Migas',tex('cc_migas','CLOUDS',noise_scale=0.0018,noise_depth=1,noise_type='HARD_NOISE'),0.0007)
c['stack_height']=0.0255

def L(nt,a,b): nt.links.new(a,b)
# ---------- material plancha ----------
m,nt,bs=new_mat('Pollo_Plancha'); N=nt.nodes
tc=N.new('ShaderNodeTexCoord'); geo=N.new('ShaderNodeNewGeometry')
mp=N.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value[2]=math.radians(38); L(nt,tc.outputs['Object'],mp.inputs['Vector'])
wv=N.new('ShaderNodeTexWave'); wv.wave_type='BANDS'; wv.bands_direction='X'; wv.inputs['Scale'].default_value=1/0.019*0.5; wv.inputs['Distortion'].default_value=0.6; wv.inputs['Detail'].default_value=2
L(nt,mp.outputs['Vector'],wv.inputs['Vector'])
mk=N.new('ShaderNodeMapRange'); mk.inputs['From Min'].default_value=0.80; mk.inputs['From Max'].default_value=0.97; L(nt,wv.outputs['Fac'],mk.inputs['Value'])
sep=N.new('ShaderNodeSeparateXYZ'); L(nt,geo.outputs['Normal'],sep.inputs['Vector'])
top=N.new('ShaderNodeMapRange'); top.inputs['From Min'].default_value=0.55; top.inputs['From Max'].default_value=0.85; L(nt,sep.outputs['Z'],top.inputs['Value'])
nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=60; nz.inputs['Detail'].default_value=6; L(nt,tc.outputs['Object'],nz.inputs['Vector'])
brk=N.new('ShaderNodeMapRange'); brk.inputs['From Min'].default_value=0.35; brk.inputs['From Max'].default_value=0.55; L(nt,nz.outputs['Fac'],brk.inputs['Value'])
m1=N.new('ShaderNodeMath'); m1.operation='MULTIPLY'; L(nt,mk.outputs['Result'],m1.inputs[0]); L(nt,top.outputs['Result'],m1.inputs[1])
mark=N.new('ShaderNodeMath'); mark.operation='MULTIPLY'; L(nt,m1.outputs[0],mark.inputs[0]); L(nt,brk.outputs['Result'],mark.inputs[1])
# fibras
fm=N.new('ShaderNodeMapping'); fm.inputs['Scale'].default_value=(25,180,25); fm.inputs['Rotation'].default_value[2]=math.radians(-20); L(nt,tc.outputs['Object'],fm.inputs['Vector'])
fb=N.new('ShaderNodeTexNoise'); fb.inputs['Scale'].default_value=1.0; fb.inputs['Detail'].default_value=8; L(nt,fm.outputs['Vector'],fb.inputs['Vector'])
nb=N.new('ShaderNodeTexNoise'); nb.inputs['Scale'].default_value=18; nb.inputs['Detail'].default_value=4; L(nt,tc.outputs['Object'],nb.inputs['Vector'])
rp=ramp(nt,(0,0),[(0.30,'#f0d7aa'),(0.50,'#dcae6c'),(0.70,'#bd7e3d')]); L(nt,nb.outputs['Fac'],rp.inputs['Fac'])
# borde dorado (lados)
side=N.new('ShaderNodeMapRange'); side.inputs['From Min'].default_value=0.85; side.inputs['From Max'].default_value=0.35; L(nt,sep.outputs['Z'],side.inputs['Value'])
mx1=N.new('ShaderNodeMix'); mx1.data_type='RGBA'; L(nt,side.outputs['Result'],mx1.inputs['Factor']); L(nt,rp.outputs['Color'],mx1.inputs[6]); mx1.inputs[7].default_value=hexc('#c78a4a')
mx2=N.new('ShaderNodeMix'); mx2.data_type='RGBA'; L(nt,mark.outputs[0],mx2.inputs['Factor']); L(nt,mx1.outputs[2],mx2.inputs[6]); mx2.inputs[7].default_value=hexc('#3b200d')
# especias/pimienta
sp=N.new('ShaderNodeTexVoronoi'); sp.inputs['Scale'].default_value=420; L(nt,tc.outputs['Object'],sp.inputs['Vector'])
spm=N.new('ShaderNodeMapRange'); spm.inputs['From Min'].default_value=0.06; spm.inputs['From Max'].default_value=0.02; L(nt,sp.outputs['Distance'],spm.inputs['Value'])
spt=N.new('ShaderNodeMath'); spt.operation='MULTIPLY'; spt.inputs[1].default_value=0.55; L(nt,spm.outputs['Result'],spt.inputs[0])
mx3=N.new('ShaderNodeMix'); mx3.data_type='RGBA'; L(nt,spt.outputs[0],mx3.inputs['Factor']); L(nt,mx2.outputs[2],mx3.inputs[6]); mx3.inputs[7].default_value=hexc('#4a2a12')
L(nt,mx3.outputs[2],bs.inputs['Base Color'])
rr=N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value=0.38; rr.inputs['To Max'].default_value=0.75; L(nt,mark.outputs[0],rr.inputs['Value']); L(nt,rr.outputs['Result'],bs.inputs['Roughness'])
bs.inputs['Coat Weight'].default_value=0.18; bs.inputs['Coat Roughness'].default_value=0.25
bs.inputs['Subsurface Weight'].default_value=0.08; bs.inputs['Subsurface Radius'].default_value=(1,0.8,0.6); bs.inputs['Subsurface Scale'].default_value=0.003
bh=N.new('ShaderNodeMath'); bh.operation='MULTIPLY_ADD'; L(nt,fb.outputs['Fac'],bh.inputs[0]); bh.inputs[1].default_value=0.6; L(nt,mark.outputs[0],bh.inputs[2])
inv=N.new('ShaderNodeMath'); inv.operation='SUBTRACT'; L(nt,bh.outputs[0],inv.inputs[0]); L(nt,mark.outputs[0],inv.inputs[1]); L(nt,mark.outputs[0],inv.inputs[1])
bm_=N.new('ShaderNodeBump'); bm_.inputs['Strength'].default_value=0.35; bm_.inputs['Distance'].default_value=0.0006
neg=N.new('ShaderNodeMath'); neg.operation='MULTIPLY_ADD'; L(nt,mark.outputs[0],neg.inputs[0]); neg.inputs[1].default_value=-1.4; L(nt,fb.outputs['Fac'],neg.inputs[2])
L(nt,neg.outputs[0],bm_.inputs['Height']); L(nt,bm_.outputs['Normal'],bs.inputs['Normal'])
g.data.materials.clear(); g.data.materials.append(m)

# ---------- material crispy ----------
m,nt,bs=new_mat('Pollo_Crispy'); N=nt.nodes
tc=N.new('ShaderNodeTexCoord'); geo=N.new('ShaderNodeNewGeometry')
pt=N.new('ShaderNodeMapRange'); pt.inputs['From Min'].default_value=0.47; pt.inputs['From Max'].default_value=0.58; L(nt,geo.outputs['Pointiness'],pt.inputs['Value'])
nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=35; nz.inputs['Detail'].default_value=6; L(nt,tc.outputs['Object'],nz.inputs['Vector'])
ad=N.new('ShaderNodeMath'); ad.operation='MULTIPLY_ADD'; L(nt,pt.outputs['Result'],ad.inputs[0]); ad.inputs[1].default_value=0.65; L(nt,nz.outputs['Fac'],ad.inputs[2])
ad2=N.new('ShaderNodeMath'); ad2.operation='SUBTRACT'; L(nt,ad.outputs[0],ad2.inputs[0]); ad2.inputs[1].default_value=0.3
rp=ramp(nt,(0,0),[(0.05,'#e8bb63'),(0.35,'#d39a3e'),(0.62,'#b0661f'),(0.90,'#7a3c10')]); L(nt,ad2.outputs[0],rp.inputs['Fac'])
L(nt,rp.outputs['Color'],bs.inputs['Base Color'])
vo=N.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value=650; L(nt,tc.outputs['Object'],vo.inputs['Vector'])
n2=N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value=900; n2.inputs['Detail'].default_value=3; L(nt,tc.outputs['Object'],n2.inputs['Vector'])
hh=N.new('ShaderNodeMath'); hh.operation='MULTIPLY_ADD'; L(nt,vo.outputs['Distance'],hh.inputs[0]); hh.inputs[1].default_value=-1.0; L(nt,n2.outputs['Fac'],hh.inputs[2])
bm_=N.new('ShaderNodeBump'); bm_.inputs['Strength'].default_value=0.5; bm_.inputs['Distance'].default_value=0.0004
L(nt,hh.outputs[0],bm_.inputs['Height']); L(nt,bm_.outputs['Normal'],bs.inputs['Normal'])
rg=N.new('ShaderNodeMapRange'); rg.inputs['To Min'].default_value=0.30; rg.inputs['To Max'].default_value=0.60; L(nt,n2.outputs['Fac'],rg.inputs['Value']); L(nt,rg.outputs['Result'],bs.inputs['Roughness'])
bs.inputs['Coat Weight'].default_value=0.25; bs.inputs['Coat Roughness'].default_value=0.35
c.data.materials.clear(); c.data.materials.append(m)
for o in (g,c): o.hide_render=True; o.hide_set(True)

# ---- v2: mas tostado, irregular y crujiente ----
import bpy
O=bpy.data.objects
def T(name, kind, **kw):
    t=bpy.data.textures.get(name) or bpy.data.textures.new(name, kind)
    t.type=kind; t=bpy.data.textures[name]
    for k,v in kw.items(): setattr(t,k,v)
    return t
g=O['chicken_grilled']
g.modifiers['Forma'].strength=0.0034; g.modifiers['Forma'].texture.noise_scale=0.03
if 'Bultos' not in g.modifiers:
    m=g.modifiers.new('Bultos','DISPLACE'); m.texture=T('cg_bultos','CLOUDS',noise_scale=0.011,noise_depth=3); m.strength=0.0012; m.texture_coords='LOCAL'
g.modifiers['Subdiv'].levels=g.modifiers['Subdiv'].render_levels=2
mat=bpy.data.materials['Pollo_Plancha']; nt=mat.node_tree; N=nt.nodes; L=nt.links.new
r=N['Rampa de color'].color_ramp.elements
for e,(p,c) in zip(r,[(0.30,'#e2b06a'),(0.50,'#c98a45'),(0.72,'#a2602a')]): e.position=p; e.color=hexc(c)
N['Mezclar'].inputs[7].default_value=hexc('#9a5726')
N['Mezclar.001'].inputs[7].default_value=hexc('#24130a')
N['Mapear rango'].inputs['From Min'].default_value=0.74
if 'halo' not in N:
    hm=N.new('ShaderNodeMapRange'); hm.name='halo'; hm.inputs['From Min'].default_value=0.45; hm.inputs['From Max'].default_value=0.85
    L(N['Ondas'].outputs['Fac'],hm.inputs['Value'])
    h1=N.new('ShaderNodeMath'); h1.operation='MULTIPLY'; L(hm.outputs['Result'],h1.inputs[0]); L(N['Mapear rango.001'].outputs['Result'],h1.inputs[1])
    h2=N.new('ShaderNodeMath'); h2.operation='MULTIPLY'; L(h1.outputs[0],h2.inputs[0]); L(N['Mapear rango.002'].outputs['Result'],h2.inputs[1])
    h3=N.new('ShaderNodeMath'); h3.operation='MULTIPLY'; h3.inputs[1].default_value=0.75; L(h2.outputs[0],h3.inputs[0])
    hx=N.new('ShaderNodeMix'); hx.data_type='RGBA'; L(h3.outputs[0],hx.inputs['Factor']); L(N['Mezclar'].outputs[2],hx.inputs[6]); hx.inputs[7].default_value=hexc('#7a4119')
    L(hx.outputs[2],N['Mezclar.001'].inputs[6])
N['Relieve'].inputs['Strength'].default_value=0.6
N['Mapeo.001'].inputs['Scale'].default_value=(40,260,40)
b=N['BSDF Principista']; b.inputs['Coat Weight'].default_value=0.32; b.inputs['Coat Roughness'].default_value=0.2

c=O['chicken_crispy']
c.modifiers['Subdiv'].levels=c.modifiers['Subdiv'].render_levels=3
c.modifiers['Forma'].strength=0.0024
gm=c.modifiers['Grumos']; gm.texture=T('cc_crag','MUSGRAVE',musgrave_type='RIDGED_MULTIFRACTAL',noise_scale=0.0065,octaves=5,lacunarity=2.2,offset=1.0,gain=2.0,noise_basis='VORONOI_F2_F1'); gm.strength=0.0016; gm.mid_level=0.55
if 'Lumps' not in c.modifiers:
    m=c.modifiers.new('Lumps','DISPLACE'); m.texture=T('cc_lumps','CLOUDS',noise_scale=0.0075,noise_depth=3,noise_type='HARD_NOISE'); m.strength=0.0028; m.mid_level=0.45; m.texture_coords='LOCAL'
    m=c.modifiers.new('Escamas','DISPLACE'); m.texture=T('cc_escamas','VORONOI',noise_scale=0.0028,distance_metric='DISTANCE',noise_intensity=1.0); m.strength=0.0011; m.mid_level=0.3; m.texture_coords='LOCAL'
c.modifiers['Migas'].strength=0.0006
mat=bpy.data.materials['Pollo_Crispy']; N=mat.node_tree.nodes
r=[n for n in N if n.type=='VALTORGB'][0].color_ramp.elements
for e,(p,col) in zip(r,[(0.05,'#e5a94c'),(0.35,'#c97a26'),(0.62,'#a2561a'),(0.90,'#6a300d')]): e.position=p; e.color=hexc(col)

# ---- v3 plancha: menos plastico, mas textura ----
import bpy
g=bpy.data.objects['chicken_grilled']
g.modifiers['Fibra'].strength=0.0009; g.modifiers['Bultos'].strength=0.0022; g.modifiers['Forma'].strength=0.004
N=bpy.data.materials['Pollo_Plancha'].node_tree.nodes
b=N['BSDF Principista']; b.inputs['Coat Weight'].default_value=0.08; b.inputs['Coat Roughness'].default_value=0.3
N['Mapear rango.005'].inputs['To Min'].default_value=0.52; N['Mapear rango.005'].inputs['To Max'].default_value=0.8
N['Relieve'].inputs['Strength'].default_value=1.0; N['Relieve'].inputs['Distance'].default_value=0.0012
N['Ruido.002'].inputs['Scale'].default_value=9; N['Ruido.002'].inputs['Detail'].default_value=8
N['Voronoi'].inputs['Scale'].default_value=300; N['Operar.002'].inputs[1].default_value=0.85
N['Mezclar.002'].inputs[7].default_value=hexc('#2f2410')
r=N['Rampa de color'].color_ramp.elements
for e,(p,c) in zip(r,[(0.28,'#e8bd7c'),(0.50,'#c88640'),(0.75,'#93531f')]): e.position=p; e.color=hexc(c)

# ---- v4 plancha: lados mas dorados ----
import bpy
N=bpy.data.materials['Pollo_Plancha'].node_tree.nodes
N['Mezclar'].inputs[7].default_value=hexc('#b97c40')
r=N['Rampa de color'].color_ramp.elements
for e,(p,c) in zip(r,[(0.28,'#efcb91'),(0.52,'#d09350'),(0.78,'#9c5c26')]): e.position=p; e.color=hexc(c)

# ---- v5: crispy subdiv 2 para hornear sin huecos ----
bpy.data.objects['chicken_crispy'].modifiers['Subdiv'].levels=2
bpy.data.objects['chicken_crispy'].modifiers['Subdiv'].render_levels=2
