
import bpy, bmesh, math, random
from mathutils import Vector
import bpy, os
exec(open(os.path.join(bpy.path.abspath('//'), 'scripts', 'helpers.py')).read(), globals())  # helpers junto al .blend
def L(nt,a,b): nt.links.new(a,b)
def T(name, kind, **kw):
    t=bpy.data.textures.get(name) or bpy.data.textures.new(name, kind)
    t.type=kind; t=bpy.data.textures[name]
    for k,v in kw.items(): setattr(t,k,v)
    return t
def layers(bm):
    return bm.verts.layers.float.get('t') or bm.verts.layers.float.new('t'), bm.verts.layers.float.get('seed') or bm.verts.layers.float.new('seed')
def finish(name, bm, coll_name='Extras'):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=True
    remove_obj(name)
    ob=bpy.data.objects.new(name,me); coll(coll_name).objects.link(ob); return ob

def add_ring(bm, c, rin, rout, th, ell=(1,1), rot=0.0, seed=0, segs=120, wob=0.04):
    """aro con seccion rectangular redondeada; atributo t: 0 cara interior -> 1 piel exterior"""
    tl,sl=layers(bm); random.seed(seed); ph=[random.random()*6.28 for _ in range(4)]
    b=min(0.0006,(rout-rin)*0.3,th*0.3)
    prof=[(rin+b,0),(rout-b,0),(rout,b),(rout,th-b),(rout-b,th),(rin+b,th),(rin,th-b),(rin,b)]
    rows=[]
    for i in range(segs):
        a=i/segs*math.tau
        w=1+wob*math.sin(2*a+ph[0])+wob*0.5*math.sin(3*a+ph[1])
        row=[]
        for (r,z) in prof:
            rr=r*w; x=rr*math.cos(a)*ell[0]; y=rr*math.sin(a)*ell[1]
            xr=x*math.cos(rot)-y*math.sin(rot); yr=x*math.sin(rot)+y*math.cos(rot)
            zz=z+0.0004*math.sin(a*2+ph[2])
            v=bm.verts.new((c[0]+xr,c[1]+yr,c[2]+zz)); v[tl]=(r-rin)/(rout-rin); v[sl]=0; row.append(v)
        rows.append(row)
    n=len(prof)
    for i in range(segs):
        A=rows[i]; B=rows[(i+1)%segs]
        for j in range(n):
            bm.faces.new((A[j],A[(j+1)%n],B[(j+1)%n],B[j]))

def add_disc(bm, c, R, th, seed=0, segs=72, nr=14, crinkle=0.0, lam=0.0045, tilt=(0,0), ell=(1,1)):
    tl,sl=layers(bm); random.seed(seed); ph=random.random()*6.28; rot=random.random()*6.28
    def P(r,a,z):
        x=r*math.cos(a)*ell[0]; y=r*math.sin(a)*ell[1]
        xr=x*math.cos(rot)-y*math.sin(rot); yr=x*math.sin(rot)+y*math.cos(rot)
        zc=z+crinkle*math.sin(xr/lam*math.tau+ph)+tilt[0]*xr+tilt[1]*yr
        return (c[0]+xr,c[1]+yr,c[2]+zc)
    def cap(z, flip):
        ctr=bm.verts.new(P(0,0,z)); ctr[tl]=0; ctr[sl]=0
        rings=[]
        for k in range(1,nr+1):
            r=R*k/nr; row=[]
            for i in range(segs):
                v=bm.verts.new(P(r,i/segs*math.tau,z)); v[tl]=k/nr; v[sl]=0; row.append(v)
            rings.append(row)
        for i in range(segs):
            f=(ctr,rings[0][i],rings[0][(i+1)%segs]); bm.faces.new(f[::-1] if flip else f)
        for k in range(nr-1):
            for i in range(segs):
                f=(rings[k][i],rings[k+1][i],rings[k+1][(i+1)%segs],rings[k][(i+1)%segs]); bm.faces.new(f[::-1] if flip else f)
        return rings[-1]
    top=cap(th,False); bot=cap(0,True)
    for i in range(segs):
        bm.faces.new((bot[i],bot[(i+1)%segs],top[(i+1)%segs],top[i]))

def cut_material(name, cut_stops, side_in, side_out, rough=0.3, coat=0.5, sss=0.3, sss_r=(1,0.8,0.6), seeds=None, bump=0.3):
    m,nt,bs=new_mat(name); N=nt.nodes
    at=N.new('ShaderNodeAttribute'); at.attribute_name='t'
    sd=N.new('ShaderNodeAttribute'); sd.attribute_name='seed'
    geo=N.new('ShaderNodeNewGeometry'); tc=N.new('ShaderNodeTexCoord')
    nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=180; nz.inputs['Detail'].default_value=6; L(nt,tc.outputs['Object'],nz.inputs['Vector'])
    jit=N.new('ShaderNodeMath'); jit.operation='MULTIPLY_ADD'; L(nt,nz.outputs['Fac'],jit.inputs[0]); jit.inputs[1].default_value=0.08; L(nt,at.outputs['Fac'],jit.inputs[2])
    rc=ramp(nt,(0,0),cut_stops); L(nt,jit.outputs[0],rc.inputs['Fac'])
    sideR=ramp(nt,(0,0),[(0.45,side_in),(0.55,side_out)]); L(nt,at.outputs['Fac'],sideR.inputs['Fac'])
    sep=N.new('ShaderNodeSeparateXYZ'); L(nt,geo.outputs['Normal'],sep.inputs['Vector'])
    ab=N.new('ShaderNodeMath'); ab.operation='ABSOLUTE'; L(nt,sep.outputs['Z'],ab.inputs[0])
    mr=N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value=0.18; mr.inputs['From Max'].default_value=0.4; L(nt,ab.outputs[0],mr.inputs['Value'])
    mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; L(nt,mr.outputs['Result'],mx.inputs['Factor']); L(nt,sideR.outputs['Color'],mx.inputs[6]); L(nt,rc.outputs['Color'],mx.inputs[7])
    out=mx.outputs[2]
    if seeds:
        vo=N.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value=seeds['scale']; L(nt,tc.outputs['Object'],vo.inputs['Vector'])
        dm=N.new('ShaderNodeMapRange'); dm.inputs['From Min'].default_value=seeds['size']; dm.inputs['From Max'].default_value=seeds['size']*0.6; L(nt,vo.outputs['Distance'],dm.inputs['Value'])
        band=N.new('ShaderNodeMapRange'); band.interpolation_type='SMOOTHSTEP'
        lo,hi=seeds['band']
        b1=N.new('ShaderNodeMath'); b1.operation='COMPARE'; b1.inputs[1].default_value=(lo+hi)/2; b1.inputs[2].default_value=(hi-lo)/2; L(nt,at.outputs['Fac'],b1.inputs[0])
        m1=N.new('ShaderNodeMath'); m1.operation='MULTIPLY'; L(nt,dm.outputs['Result'],m1.inputs[0]); L(nt,b1.outputs[0],m1.inputs[1])
        m2=N.new('ShaderNodeMath'); m2.operation='MULTIPLY'; L(nt,m1.outputs[0],m2.inputs[0]); L(nt,mr.outputs['Result'],m2.inputs[1])
        sx=N.new('ShaderNodeMix'); sx.data_type='RGBA'; L(nt,m2.outputs[0],sx.inputs['Factor']); L(nt,out,sx.inputs[6]); sx.inputs[7].default_value=hexc(seeds['color'])
        out=sx.outputs[2]
    ss=N.new('ShaderNodeMix'); ss.data_type='RGBA'; L(nt,sd.outputs['Fac'],ss.inputs['Factor']); L(nt,out,ss.inputs[6]); ss.inputs[7].default_value=hexc('#efe4bf')
    L(nt,ss.outputs[2],bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Coat Weight'].default_value=coat; bs.inputs['Coat Roughness'].default_value=0.12
    bs.inputs['Subsurface Weight'].default_value=sss; bs.inputs['Subsurface Radius'].default_value=sss_r; bs.inputs['Subsurface Scale'].default_value=0.003
    n2=N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value=500; n2.inputs['Detail'].default_value=4; L(nt,tc.outputs['Object'],n2.inputs['Vector'])
    bp=N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=bump; bp.inputs['Distance'].default_value=0.0003; L(nt,n2.outputs['Fac'],bp.inputs['Height']); L(nt,bp.outputs['Normal'],bs.inputs['Normal'])
    return m

# ---------- CEBOLLA MORADA ----------
bm=bmesh.new()
slA=[(0.0338,0.0370),(0.0285,0.0316),(0.0234,0.0264),(0.0185,0.0214),(0.0138,0.0166),(0.0093,0.0120)]
for i,(a,b) in enumerate(slA): add_ring(bm,(-0.006,0.004,0.0),a,b,0.0028,ell=(1,0.9),rot=0.3,seed=10+i,wob=0.06)
slB=[(0.0294,0.0325),(0.0243,0.0273),(0.0193,0.0222)]
for i,(a,b) in enumerate(slB): add_ring(bm,(0.012,-0.009,0.0030),a,b,0.0028,ell=(1,0.86),rot=1.2,seed=30+i,wob=0.07)
on=finish('onion_red_rings',bm); on['stack_height']=0.005
mon=cut_material('Cebolla_Morada',[(0.0,'#e9d3e2'),(0.30,'#e2c2d8'),(0.55,'#c47aa9'),(0.75,'#93306f'),(1.0,'#5a0f45')],'#e7cfe0','#5c1046',rough=0.3,coat=0.3,sss=0.2,sss_r=(1,0.6,0.9))
on.data.materials.append(mon)

# ---------- PEPINILLOS ----------
bm=bmesh.new()
random.seed(4)
for i in range(5):
    a=i/5*math.tau+0.4; d=0.031
    add_disc(bm,(math.cos(a)*d,math.sin(a)*d,0.0002*i),0.0128,0.0030,seed=50+i,crinkle=0.00035,tilt=((random.random()-.5)*0.08,(random.random()-.5)*0.08),ell=(1,0.94))
add_disc(bm,(0.002,-0.001,0.0012),0.0124,0.0030,seed=58,crinkle=0.00035)
pk=finish('pickle_slices',bm); pk['stack_height']=0.0045
mpk=cut_material('Pepinillo',[(0.0,'#a9a650'),(0.40,'#a5a44c'),(0.48,'#c2bf74'),(0.62,'#bdb96d'),(0.70,'#8f9338'),(0.88,'#76802c'),(0.94,'#3a5212'),(1.0,'#2a400c')],'#a9a650','#2f4a12',rough=0.5,coat=0.12,sss=0.2,sss_r=(0.8,1,0.5),seeds={'scale':900,'size':0.25,'band':(0.47,0.63),'color':'#ecebc0'},bump=0.25)
pk.data.materials.append(mpk)

# ---------- JALAPENOS ----------
bm=bmesh.new(); tl,sl=layers(bm)
random.seed(9)
spots=[(0.0,0.0),(0.026,0.008),(-0.024,0.013),(0.010,-0.027),(-0.016,-0.024),(0.030,-0.016),(-0.034,-0.006),(0.004,0.030)]
for i,(x,y) in enumerate(spots):
    z=0.0001*i+(0.0025 if i==0 else 0)
    rin=0.0070+random.random()*0.001; rout=rin+0.0034
    add_ring(bm,(x,y,z),rin,rout,0.0030,ell=(1,0.86+random.random()*0.08),rot=random.random()*6,seed=70+i,segs=72,wob=0.05)
    for s in range(random.randint(2,5)):
        a=random.random()*math.tau; rr=rin*0.72
        res=bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=6,radius=0.0017)
        for v in res['verts']:
            v.co.z*=0.3; v.co.x*=1.0; v.co.y*=0.8
            v.co=v.co+Vector((x+math.cos(a)*rr, y+math.sin(a)*rr, z+0.0012)); v[sl]=1; v[tl]=0.5
jl=finish('jalapeno_rings',bm); jl['stack_height']=0.0045
mjl=cut_material('Jalapeno',[(0.0,'#d3dca6'),(0.10,'#86ad48'),(0.5,'#5d8c2b'),(0.84,'#46761f'),(0.9,'#1f4a0e'),(1.0,'#163a09')],'#c4d890','#17470d',rough=0.3,coat=0.45,sss=0.15,sss_r=(0.6,1,0.4),bump=0.15)
jl.data.materials.append(mjl)

# ---------- CEBOLLA CARAMELIZADA ----------
remove_obj('onion_caramelized')
cu=bpy.data.curves.new('onion_caramelized','CURVE'); cu.dimensions='3D'; cu.bevel_depth=0.0021; cu.bevel_resolution=3; cu.use_fill_caps=True
random.seed(12)
for k in range(70):
    rad=0.004+random.random()*0.011; ang=math.radians(60+random.random()*150); a0=random.random()*math.tau
    d=math.sqrt(random.random())*0.032; ca=random.random()*math.tau; cx,cy=math.cos(ca)*d,math.sin(ca)*d
    hz=0.0016+(1-d/0.04)*0.009*random.random()
    sp=cu.splines.new('POLY'); n=16; sp.points.add(n-1)
    for j in range(n):
        a=a0+ang*j/(n-1); r=rad*(1+0.15*math.sin(j*0.9+k))
        sp.points[j].co=(cx+math.cos(a)*r, cy+math.sin(a)*r, hz+0.0006*math.sin(j*0.7+k), 1)
        sp.points[j].radius=0.75+0.35*math.sin(j/(n-1)*math.pi)
cm=bpy.data.objects.new('onion_caramelized',cu); coll('Extras').objects.link(cm); cm.scale=(1,1,0.34)
cm['stack_height']=0.0055
m,nt,bs=new_mat('Cebolla_Caramelizada'); N=nt.nodes
tc=N.new('ShaderNodeTexCoord'); nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=60; nz.inputs['Detail'].default_value=5; L(nt,tc.outputs['Object'],nz.inputs['Vector'])
rp=ramp(nt,(0,0),[(0.3,'#2e1003'),(0.5,'#4a1d06'),(0.68,'#6b300c'),(0.8,'#8a4a1a')]); L(nt,nz.outputs['Fac'],rp.inputs['Fac']); L(nt,rp.outputs['Color'],bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value=0.2; bs.inputs['Coat Weight'].default_value=0.9; bs.inputs['Coat Roughness'].default_value=0.1
bs.inputs['Subsurface Weight'].default_value=0.3; bs.inputs['Subsurface Radius'].default_value=(1,0.5,0.2); bs.inputs['Subsurface Scale'].default_value=0.002
cu.materials.append(m)

# ---------- QUESO SUIZO ----------
src=bpy.data.objects['cheese_cheddar']
remove_obj('cheese_swiss')
me=src.data.copy(); me.name='cheese_swiss'
bm=bmesh.new(); bm.from_mesh(me)
random.seed(21)
holes=[]
for i in range(11):
    holes.append((random.uniform(-0.05,0.05),random.uniform(-0.05,0.05),random.uniform(0.003,0.0085)))
dele=[f for f in bm.faces if any((f.calc_center_median().x-hx)**2+(f.calc_center_median().y-hy)**2<hr*hr for hx,hy,hr in holes)]
bmesh.ops.delete(bm,geom=dele,context='FACES')
bm.to_mesh(me); bm.free()
sw=bpy.data.objects.new('cheese_swiss',me); coll('Hamburguesa').objects.link(sw)
sw.location=src.location.copy(); sw.rotation_euler=src.rotation_euler.copy(); sw.rotation_euler[2]+=0.5
for md in src.modifiers:
    n=sw.modifiers.new(md.name,md.type)
    for p in ('target','wrap_method','wrap_mode','offset','thickness','offset','use_even_offset','levels','render_levels','use_rim','use_rim_only'):
        if hasattr(md,p):
            try: setattr(n,p,getattr(md,p))
            except Exception: pass
sw['stack_height']=0.0016
m,nt,bs=new_mat('Queso_Suizo'); N=nt.nodes
tc=N.new('ShaderNodeTexCoord'); nz=N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=40; nz.inputs['Detail'].default_value=4; L(nt,tc.outputs['Object'],nz.inputs['Vector'])
rp=ramp(nt,(0,0),[(0.35,'#e6c46a'),(0.65,'#d9b555')]); L(nt,nz.outputs['Fac'],rp.inputs['Fac']); L(nt,rp.outputs['Color'],bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value=0.35; bs.inputs['Coat Weight'].default_value=0.25; bs.inputs['Coat Roughness'].default_value=0.2
bs.inputs['Subsurface Weight'].default_value=0.35; bs.inputs['Subsurface Radius'].default_value=(1,0.85,0.5); bs.inputs['Subsurface Scale'].default_value=0.003
sw.data.materials.clear(); sw.data.materials.append(m)
sw.hide_render=True
for n in ('onion_red_rings','pickle_slices','jalapeno_rings'):
    o=bpy.data.objects[n]; sd=o.modifiers.new('Subdiv','SUBSURF'); sd.levels=sd.render_levels=1
