
PATH=[(0.0,0.0),(0.047,-0.0004),(0.0512,-0.0024),(0.0560,-0.0048),(0.0584,-0.0092),(0.0592,-0.0135),(0.0592,-0.0230)]
def path_at(s):
    acc=0
    for i in range(len(PATH)-1):
        a=Vector(PATH[i]); b=Vector(PATH[i+1]); l=(b-a).length
        if s<=acc+l or i==len(PATH)-2: return a.lerp(b,min(1,max(0,(s-acc)/l)))
        acc+=l
def gen_sauce(kind, seed, R0min=0.043, R0rng=0.006, ndrip=(4,7)):
    name='sauce_'+kind; old=bpy.data.objects[name]; mat=old.data.materials[0]
    rnd=random.Random(seed); S=20.0
    mb=bpy.data.metaballs.new('mb_'+kind); mb.resolution=0.012; mb.render_resolution=0.012; mb.threshold=0.6
    R0=R0min+rnd.random()*R0rng; ph=rnd.random()*6
    for i in range(90):
        a=rnd.random()*math.tau; r=R0*math.sqrt(rnd.random())*(1+0.16*math.sin(3*a+ph)+0.06*math.sin(7*a))
        el=mb.elements.new(); el.type='ELLIPSOID'; el.co=(S*r*math.cos(a),S*r*math.sin(a),0.0)
        el.radius=S*(0.0078+rnd.random()*0.003); el.size_x=1.0; el.size_y=1.0; el.size_z=0.24
    nd=rnd.randint(*ndrip)
    for d in range(nd):
        a0=d/nd*math.tau+rnd.uniform(-0.35,0.35); w=rnd.uniform(0.85,1.2)
        s0=R0*0.85; send=0.0525+rnd.uniform(0.004,0.019)   # longitud a lo largo del perfil
        n=26
        for k in range(n+1):
            t=k/n; s=s0+(send-s0)*t; p=path_at(s)
            off=0.0012   # medio embebido en la carne: queda plano contra la superficie
            el=mb.elements.new(); el.type='BALL'; el.co=(S*(p.x+off)*math.cos(a0),S*(p.x+off)*math.sin(a0),S*p.y); el.radius=S*w*(0.0040-0.0010*t)
        p=path_at(send)
        el=mb.elements.new(); el.type='BALL'; el.co=(S*(p.x+0.0016)*math.cos(a0),S*(p.x+0.0016)*math.sin(a0),S*(p.y-0.0006)); el.radius=S*w*0.0047
    tmp=bpy.data.objects.new('mbtmp_'+kind,mb); bpy.data.collections['Hamburguesa'].objects.link(tmp)
    bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get(); me=bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp,do_unlink=True); bpy.data.metaballs.remove(mb)
    me.transform(Matrix.Diagonal((1/S,1/S,1/S,1)))
    for p in me.polygons: p.use_smooth=True
    me.materials.append(mat)
    oldme=old.data; old.data=me; bpy.data.meshes.remove(oldme); me.name=name
    return len(me.vertices)
